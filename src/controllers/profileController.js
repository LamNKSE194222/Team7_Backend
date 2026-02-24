const bcrypt = require("bcrypt");
const pool = require("../config/database");

// PATCH /api/profile
async function updateProfile(req, res) {
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

        const { username } = req.body || {};
        if (!username || String(username).trim().length < 2) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "username tối thiểu 2 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        const rs = await pool.query(
            `
      UPDATE "user"
      SET username = $1
      WHERE user_id = $2
      RETURNING user_id, username, email, status
      `,
            [String(username).trim(), userId]
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
            data: {
                user_id: String(rs.rows[0].user_id),
                username: rs.rows[0].username,
                email: rs.rows[0].email,
                status: rs.rows[0].status,
            },
            message: null,
        });
    } catch (e) {
        console.error("UPDATE PROFILE ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

// PATCH /api/profile/change-password
async function changePassword(req, res) {
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

        const { current_password, new_password } = req.body || {};
        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "current_password và new_password là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (String(new_password).length < 6) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "new_password tối thiểu 6 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        const userRs = await pool.query(
            `SELECT user_id, password AS password_hash, status FROM "user" WHERE user_id = $1 LIMIT 1`,
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

        const u = userRs.rows[0];
        if (u.status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản đang inactive",
                error_code: "USER_INACTIVE",
            });
        }

        const ok = await bcrypt.compare(current_password, u.password_hash);
        if (!ok) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Mật khẩu hiện tại không đúng",
                error_code: "INVALID_PASSWORD",
            });
        }

        // Hash mật khẩu mới
        const saltRounds = 10;
        const newHash = await bcrypt.hash(new_password, saltRounds);

        await pool.query(`UPDATE "user" SET password = $1 WHERE user_id = $2`, [
            newHash,
            userId,
        ]);

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
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { updateProfile, changePassword };
