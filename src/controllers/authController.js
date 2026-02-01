const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

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
        u.status,
        u.failed_attempts,
        u.locked_until,
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

        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            const remainMs = new Date(user.locked_until).getTime() - Date.now();
            const remainSec = Math.ceil(remainMs / 1000);

            return res.status(423).json({
                success: false,
                data: null,
                message: `Tài khoản đang bị khóa tạm thời. Thử lại sau ${remainSec} giây.`,
                error_code: "ACCOUNT_LOCKED",
            });
        }

        const ok = await bcrypt.compare(password, user.password_hash);

        if (!ok) {
            const nextFailed = (user.failed_attempts || 0) + 1;

            if (nextFailed >= MAX_FAILED_ATTEMPTS) {
                const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);

                await pool.query(
                    `
          UPDATE "user"
          SET failed_attempts = $1,
              locked_until = $2
          WHERE user_id = $3
          `,
                    [nextFailed, lockedUntil, user.user_id]
                );

                return res.status(423).json({
                    success: false,
                    data: null,
                    message: `Bạn đã nhập sai quá ${MAX_FAILED_ATTEMPTS} lần. Tài khoản bị khóa ${LOCK_MINUTES} phút.`,
                    error_code: "ACCOUNT_LOCKED",
                    failedAttempts: nextFailed,
                    lockedUntil: lockedUntil.toISOString(),
                });
            }

            await pool.query(
                `
        UPDATE "user"
        SET failed_attempts = $1,
            locked_until = NULL
        WHERE user_id = $2
        `,
                [nextFailed, user.user_id]
            );

            return res.status(401).json({
                success: false,
                data: null,
                message: "Sai mật khẩu",
                error_code: "INVALID_LOGIN",
                failedAttempts: nextFailed,
                remainingAttempts: MAX_FAILED_ATTEMPTS - nextFailed,
            });
        }

        if ((user.failed_attempts || 0) > 0 || user.locked_until) {
            await pool.query(
                `
        UPDATE "user"
        SET failed_attempts = 0,
            locked_until = NULL
        WHERE user_id = $1
        `,
                [user.user_id]
            );
        }

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
