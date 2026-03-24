const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// Login user
async function login(req, res) {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "email và password là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        const rs = await pool.query(
            `
            SELECT 
                u.user_id,
                u.username,
                u.email,
                u.password AS password_hash,
                u.status AS user_status,

                fs.franchise_store_id,
                fs.status AS franchise_staff_status,

                fstore.status AS franchise_store_status,

                ks.central_kitchen_id,
                ks.status AS kitchen_staff_status,

                ck.status AS central_kitchen_status,

                m.manager_code,
                m.is_admin
            FROM "user" u
            LEFT JOIN franchise_staff fs 
                ON fs.user_id = u.user_id
            LEFT JOIN franchise_store fstore 
                ON fstore.franchise_store_id = fs.franchise_store_id
            LEFT JOIN kitchen_staff ks 
                ON ks.user_id = u.user_id
            LEFT JOIN central_kitchen ck 
                ON ck.central_kitchen_id = ks.central_kitchen_id
            LEFT JOIN manager m 
                ON m.user_id = u.user_id
            WHERE u.email = $1
            LIMIT 1
            `,
            [email]
        );

        if (rs.rowCount === 0) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Email không tồn tại",
                error_code: "INVALID_LOGIN",
            });
        }

        const user = rs.rows[0];

        if (user.user_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản đang inactive",
                error_code: "USER_INACTIVE",
            });
        }

        if (user.franchise_store_id && user.franchise_staff_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Nhân viên cửa hàng đang inactive",
                error_code: "FRANCHISE_STAFF_INACTIVE",
            });
        }

        if (user.franchise_store_id && user.franchise_store_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Cửa hàng đang inactive, không thể đăng nhập",
                error_code: "STORE_INACTIVE",
            });
        }

        if (user.central_kitchen_id && user.kitchen_staff_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Nhân viên bếp đang inactive",
                error_code: "KITCHEN_STAFF_INACTIVE",
            });
        }

        if (user.central_kitchen_id && user.central_kitchen_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Bếp trung tâm đang inactive, không thể đăng nhập",
                error_code: "CENTRAL_KITCHEN_INACTIVE",
            });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Sai mật khẩu",
                error_code: "INVALID_LOGIN",
            });
        }

        await pool.query(
            `UPDATE "user" SET last_login_at = NOW() WHERE user_id = $1`,
            [user.user_id]
        );

        let role = "user";
        let central_kitchen_id = null;

        if (user.manager_code) {
            role = user.is_admin ? "admin" : "manager";
            central_kitchen_id = user.manager_central_kitchen_id;
        } else if (user.franchise_store_id) {
            role = "franchise_staff";
        } else if (user.central_kitchen_id) {
            role = "kitchen_staff";
            central_kitchen_id = user.central_kitchen_id;
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role,
                franchise_store_id: user.franchise_store_id ?? null,
                central_kitchen_id: central_kitchen_id,
                manager_code: user.manager_code ?? null,
                is_admin: user.manager_code ? !!user.is_admin : null,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            success: true,
            data: {
                token,
                user: {
                    user_id: user.user_id,
                    username: user.username,
                    email: user.email,
                    role,
                    status: user.user_status,
                    franchise_store_id: user.franchise_store_id ?? null,
                    central_kitchen_id: user.central_kitchen_id ?? null,
                },
            },
            message: null,
        });
    } catch (e) {
        console.error("LOGIN ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function me(req, res) {
    try {
        const userId = req.user?.user_id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Chưa đăng nhập",
                error_code: "UNAUTHORIZED",
            });
        }

        const rs = await pool.query(
            `
            SELECT
                u.user_id,
                u.username,
                u.email,
                u.status,

                fs.franchise_store_id,
                fstore.store_code AS franchise_store_code,
                fstore.name       AS franchise_store_name,
                fs.staff_code     AS franchise_staff_code,
                fs.status         AS franchise_staff_status,

                ks.central_kitchen_id,
                ck.kitchen_code   AS central_kitchen_code,
                ck.name           AS central_kitchen_name,
                ks.staff_code     AS kitchen_staff_code,
                ks.status         AS kitchen_staff_status,
                
                m.manager_code,
                m.is_admin

            FROM "user" u
            LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
            LEFT JOIN franchise_store fstore ON fstore.franchise_store_id = fs.franchise_store_id

            LEFT JOIN kitchen_staff ks ON ks.user_id = u.user_id
            LEFT JOIN central_kitchen ck ON ck.central_kitchen_id = ks.central_kitchen_id
            
            LEFT JOIN manager m ON m.user_id = u.user_id

            WHERE u.user_id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (rs.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        const u = rs.rows[0];

        let role = "user";
        if (u.manager_code) role = u.is_admin ? "admin" : "manager";
        else if (u.franchise_store_id) role = "franchise_staff";
        else if (u.central_kitchen_id) role = "kitchen_staff";

        const data = {
            user_id: String(u.user_id),
            username: u.username,
            email: u.email,
            status: u.status,
            role,

            franchise: u.franchise_store_id
                ? {
                    franchise_store_id: String(u.franchise_store_id),
                    store_code: u.franchise_store_code,
                    store_name: u.franchise_store_name,
                    staff_code: u.franchise_staff_code,
                    staff_status: u.franchise_staff_status,
                }
                : null,

            central_kitchen: u.central_kitchen_id
                ? {
                    central_kitchen_id: String(u.central_kitchen_id),
                    kitchen_code: u.central_kitchen_code,
                    kitchen_name: u.central_kitchen_name,
                    staff_code: u.kitchen_staff_code,
                    staff_status: u.kitchen_staff_status,
                }
                : null,
        };

        return res.json({ success: true, data, message: null });
    } catch (e) {
        console.error("ME ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

// Logout user
async function logout(req, res) {
    return res.json({ success: true, data: null, message: "Đăng xuất thành công" });
}

module.exports = { login, me, logout };