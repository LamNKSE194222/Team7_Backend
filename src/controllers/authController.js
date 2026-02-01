const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

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

        // Lấy user + nếu là franchise staff thì lấy store_id
        const rs = await pool.query(
            `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.password AS password_hash,
        u.status,
        fs.franchise_store_id
      FROM "user" u
      LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
      WHERE u.email = $1
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

        // status enum: active / inactive
        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản đang inactive",
                error_code: "USER_INACTIVE",
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

        // Với Sprint 1: staff store login là chính
        // franchise_store_id có thể null nếu user không phải franchise_staff
        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.franchise_store_id ? "franchise_staff" : "user",
                franchise_store_id: user.franchise_store_id ?? null,
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
                    status: user.status,
                    franchise_store_id: user.franchise_store_id ?? null,
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
    return res.json({ success: true, data: req.user, message: null });
}

module.exports = { login, me };
