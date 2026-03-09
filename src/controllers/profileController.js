const bcrypt = require("bcrypt");
const pool = require("../config/database");

/*
GET /api/profile
Lấy thông tin profile
*/
async function getProfile(req, res) {
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

                m.manager_code,
                m.is_admin,

                fs.staff_code AS franchise_staff_code,
                fs.franchise_store_id,
                fstore.name AS franchise_store_name,

                ks.staff_code AS kitchen_staff_code,
                ks.central_kitchen_id

            FROM "user" u
            LEFT JOIN manager m ON m.user_id = u.user_id
            LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
            LEFT JOIN franchise_store fstore
                ON fstore.franchise_store_id = fs.franchise_store_id
            LEFT JOIN kitchen_staff ks
                ON ks.user_id = u.user_id

            WHERE u.user_id = $1
            `,
            [userId]
        );

        if (rs.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "User không tồn tại",
                error_code: "USER_NOT_FOUND"
            });
        }

        const user = rs.rows[0];

        let role = "user";

        if (user.is_admin) role = "admin";
        else if (user.manager_code) role = "manager";
        else if (user.franchise_staff_code) role = "franchise_staff";
        else if (user.kitchen_staff_code) role = "kitchen_staff";

        return res.json({
            success: true,
            data: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                status: user.status,
                role,

                manager_code: user.manager_code ?? null,

                franchise_store: user.franchise_store_id
                    ? {
                        franchise_store_id: user.franchise_store_id,
                        franchise_store_name: user.franchise_store_name,
                        staff_code: user.franchise_staff_code,
                    }
                    : null,

                central_kitchen: user.central_kitchen_id
                    ? {
                        central_kitchen_id: user.central_kitchen_id,
                        staff_code: user.kitchen_staff_code,
                    }
                    : null,
            },
            message: null,
        });
    } catch (err) {
        console.error("GET PROFILE ERROR:", err);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
            error_code: "SERVER_ERROR"
        });
    }
}

/*
PATCH /api/profile
Cập nhật username
*/
async function updateProfile(req, res) {
    try {
        const userId = req.user?.user_id;
        const { username } = req.body || {};

        if (!userId) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Chưa đăng nhập",
                error_code: "UNAUTHORIZED",
            });
        }

        if (!username || username.trim().length < 2) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Username tối thiểu 2 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        const rs = await pool.query(
            `UPDATE "user"
             SET username = $1
             WHERE user_id = $2
             RETURNING user_id, username, email, status`,
            [username.trim(), userId]
        );

        if (rs.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        return res.json({
            success: true,
            data: rs.rows[0],
            message: "Cập nhật thông tin thành công",
        });

    } catch (e) {
        console.error("UPDATE PROFILE ERROR:", e);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
            error_code: "SERVER_ERROR",
        });
    }
}

/*
PATCH /api/profile/change-password
Đổi mật khẩu
*/
async function changePassword(req, res) {
    try {
        const userId = req.user?.user_id;

        const { current_password, new_password, confirm_password } = req.body || {};

        if (!userId) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Chưa đăng nhập",
                error_code: "UNAUTHORIZED",
            });
        }

        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Thiếu dữ liệu",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mật khẩu mới tối thiểu 6 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Xác nhận mật khẩu không khớp",
                error_code: "PASSWORD_NOT_MATCH",
            });
        }

        const userRs = await pool.query(
            `SELECT password FROM "user" WHERE user_id = $1`,
            [userId]
        );

        if (userRs.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        const passwordHash = userRs.rows[0].password;

        const match = await bcrypt.compare(current_password, passwordHash);

        if (!match) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Mật khẩu hiện tại không đúng",
                error_code: "INVALID_PASSWORD",
            });
        }

        const newHash = await bcrypt.hash(new_password, 10);

        await pool.query(
            `UPDATE "user"
             SET password = $1
             WHERE user_id = $2`,
            [newHash, userId]
        );

        return res.json({
            success: true,
            data: null,
            message: "Đổi mật khẩu thành công",
        });

    } catch (e) {
        console.error("CHANGE PASSWORD ERROR:", e);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { getProfile, updateProfile, changePassword };