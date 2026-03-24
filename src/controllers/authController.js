const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// Login user
async function login(req, res) {
    try {
        const { login, password } = req.body || {};
        if (!login || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "login và password là bắt buộc",
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
            WHERE u.username = $1 OR u.email = $1
            LIMIT 1
            `,
            [login]
        );

        if (rs.rowCount === 0) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Sai tên đăng nhập hoặc mật khẩu",
                error_code: "INVALID_LOGIN",
            });
        }

        const user = rs.rows[0];

        // check username/email + password trước
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Sai tên đăng nhập hoặc mật khẩu",
                error_code: "INVALID_LOGIN",
            });
        }

        // sau khi đúng password mới check status
        if (user.user_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản của bạn đã ngừng hoạt động, vui lòng liên hệ quản trị viên để biết thêm chi tiết",
                error_code: "USER_INACTIVE",
            });
        }

        if (user.franchise_store_id && user.franchise_staff_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Nhân viên cửa hàng đã ngừng hoạt động, vui lòng liên hệ quản trị viên để biết thêm chi tiết",
                error_code: "FRANCHISE_STAFF_INACTIVE",
            });
        }

        if (user.franchise_store_id && user.franchise_store_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Cửa hàng đã ngừng hoạt động, vui lòng liên hệ quản trị viên để biết thêm chi tiết",
                error_code: "STORE_INACTIVE",
            });
        }

        if (user.central_kitchen_id && user.kitchen_staff_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Nhân viên bếp đã ngừng hoạt động, vui lòng liên hệ quản trị viên để biết thêm chi tiết",
                error_code: "KITCHEN_STAFF_INACTIVE",
            });
        }

        if (user.central_kitchen_id && user.central_kitchen_status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Bếp trung tâm đã ngừng hoạt động, vui lòng liên hệ quản trị viên để biết thêm chi tiết",
                error_code: "CENTRAL_KITCHEN_INACTIVE",
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

// Logout user
async function logout(req, res) {
    try {
        // Với JWT, logout thường chỉ cần client xóa token
        // Server có thể thêm token vào blacklist nếu cần
        return res.json({
            success: true,
            data: null,
            message: "Logged out successfully",
        });
    } catch (e) {
        console.error("LOGOUT ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
            error_code: "SERVER_ERROR",
        });
    }
}

// Get current user info
async function me(req, res) {
    try {
        // User info đã được attach bởi middleware requireAuth
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Unauthorized",
                error_code: "UNAUTHORIZED",
            });
        }

        return res.json({
            success: true,
            data: user,
            message: null,
        });
    } catch (e) {
        console.error("ME ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { login, logout, me };