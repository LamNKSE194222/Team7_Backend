const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function listUsers(req, res) {
    try {
        const keyword = (req.query.keyword || "").trim();
        const role = (req.query.role || "all").trim();

        const params = [];
        const conditions = [];

        if (keyword) {
            params.push(`%${keyword}%`);
            conditions.push(`(
                u.username ILIKE $${params.length}
                OR u.email ILIKE $${params.length}
            )`);
        }

        if (role && role !== "all") {
            if (role === "admin") {
                conditions.push(`m.user_id IS NOT NULL AND m.is_admin = true`);
            } else if (role === "manager") {
                conditions.push(`m.user_id IS NOT NULL AND COALESCE(m.is_admin, false) = false`);
            } else if (role === "franchise_staff") {
                conditions.push(`fs.user_id IS NOT NULL`);
            } else if (role === "kitchen_staff") {
                conditions.push(`ks.user_id IS NOT NULL`);
            } else {
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: "role filter không hợp lệ",
                    error_code: "VALIDATION_ERROR",
                });
            }
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const sql = `
            SELECT
                u.user_id,
                u.username,
                u.email,
                u.status AS user_status,
                u.created_at,
                u.last_login_at,

                m.manager_code,
                m.is_admin,

                fs.franchise_store_id,
                fs.staff_code AS franchise_staff_code,
                fs.status AS franchise_staff_status,

                ks.central_kitchen_id,
                ks.staff_code AS kitchen_staff_code,
                ks.status AS kitchen_staff_status,

                fstore.name AS franchise_store_name,
                ck.name AS central_kitchen_name

            FROM "user" u
            LEFT JOIN manager m ON m.user_id = u.user_id
            LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
            LEFT JOIN franchise_store fstore ON fstore.franchise_store_id = fs.franchise_store_id
            LEFT JOIN kitchen_staff ks ON ks.user_id = u.user_id
            LEFT JOIN central_kitchen ck ON ck.central_kitchen_id = ks.central_kitchen_id
            ${whereClause}
            ORDER BY u.user_id DESC
        `;

        const rs = await pool.query(sql, params);

        const data = rs.rows.map((row) => {
            let role = "user";
            let role_label = "Người dùng";

            if (row.manager_code) {
                role = row.is_admin ? "admin" : "manager";
                role_label = row.is_admin ? "Quản Trị Viên" : "Quản Lý";
            } else if (row.franchise_store_id) {
                role = "franchise_staff";
                role_label = "Cửa Hàng";
            } else if (row.central_kitchen_id) {
                role = "kitchen_staff";
                role_label = "Kitchen";
            }

            return {
                user_id: row.user_id,
                username: row.username,
                email: row.email,
                role,
                role_label,
                status: row.user_status,
                status_label: row.user_status === "active" ? "Hoạt động" : "Ngừng hoạt động",
                franchise_store_id: row.franchise_store_id ?? null,
                franchise_store_name: row.franchise_store_name ?? null,
                central_kitchen_id: row.central_kitchen_id ?? null,
                central_kitchen_name: row.central_kitchen_name ?? null,
                manager_code: row.manager_code ?? null,
                franchise_staff_code: row.franchise_staff_code ?? null,
                kitchen_staff_code: row.kitchen_staff_code ?? null,
                created_at: row.created_at ?? null,
                last_login_at: row.last_login_at ?? null,
            };
        });

        return res.json({
            success: true,
            data,
            message: null,
        });
    } catch (e) {
        console.error("ADMIN LIST USERS ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function updateUser(req, res) {
    try {
        const userId = Number(req.params.userId);
        const { username, email } = req.body || {};

        if (!userId) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "userId không hợp lệ",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (!username || !email) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "username và email là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        const existed = await pool.query(
            `SELECT user_id FROM "user" WHERE user_id = $1`,
            [userId]
        );

        if (existed.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        const duplicate = await pool.query(
            `SELECT user_id FROM "user" WHERE email = $1 AND user_id <> $2`,
            [email, userId]
        );

        if (duplicate.rowCount > 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Email đã tồn tại",
                error_code: "EMAIL_ALREADY_EXISTS",
            });
        }

        const rs = await pool.query(
            `
            UPDATE "user"
            SET username = $1,
                email = $2
            WHERE user_id = $3
            RETURNING user_id, username, email, status, created_at, last_login_at
            `,
            [username.trim(), email.trim(), userId]
        );

        return res.json({
            success: true,
            data: rs.rows[0],
            message: "Cập nhật user thành công",
        });
    } catch (e) {
        console.error("ADMIN UPDATE USER ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function resetPassword(req, res) {
    try {
        const userId = Number(req.params.userId);
        const { new_password } = req.body || {};

        if (!userId) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "userId không hợp lệ",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (!new_password || String(new_password).length < 6) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        const existed = await pool.query(
            `SELECT user_id FROM "user" WHERE user_id = $1`,
            [userId]
        );

        if (existed.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        const passwordHash = await bcrypt.hash(String(new_password), 10);

        await pool.query(
            `UPDATE "user" SET password = $1 WHERE user_id = $2`,
            [passwordHash, userId]
        );

        return res.json({
            success: true,
            data: null,
            message: "Đặt lại mật khẩu thành công",
        });
    } catch (e) {
        console.error("ADMIN RESET PASSWORD ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function updateUserStatus(req, res) {
    try {
        const userId = Number(req.params.userId);
        const { status } = req.body || {};

        if (!userId) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "userId không hợp lệ",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "status phải là active hoặc inactive",
                error_code: "VALIDATION_ERROR",
            });
        }

        // không cho admin tự vô hiệu hóa chính mình
        if (Number(req.user?.user_id) === userId && status === "inactive") {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Không thể tự vô hiệu hóa tài khoản của chính mình",
                error_code: "INVALID_ACTION",
            });
        }

        const existed = await pool.query(
            `SELECT user_id, username, email, status FROM "user" WHERE user_id = $1`,
            [userId]
        );

        if (existed.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy user",
                error_code: "USER_NOT_FOUND",
            });
        }

        const rs = await pool.query(
            `
            UPDATE "user"
            SET status = $1
            WHERE user_id = $2
            RETURNING user_id, username, email, status
            `,
            [status, userId]
        );

        return res.json({
            success: true,
            data: rs.rows[0],
            message: status === "active"
                ? "Kích hoạt tài khoản thành công"
                : "Vô hiệu hóa tài khoản thành công",
        });
    } catch (e) {
        console.error("ADMIN UPDATE USER STATUS ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function createUser(req, res) {
    try {
        const { username, email, password } = req.body || {};

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "username, email và password là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mật khẩu phải có ít nhất 6 ký tự",
                error_code: "VALIDATION_ERROR",
            });
        }

        const duplicate = await pool.query(
            `SELECT user_id FROM "user" WHERE email = $1`,
            [email]
        );

        if (duplicate.rowCount > 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Email đã tồn tại",
                error_code: "EMAIL_ALREADY_EXISTS",
            });
        }

        const passwordHash = await bcrypt.hash(String(password), 10);

        const rs = await pool.query(
            `
            INSERT INTO "user" (username, email, password, status)
            VALUES ($1, $2, $3, 'active')
            RETURNING user_id, username, email, status, created_at, last_login_at
            `,
            [username.trim(), email.trim(), passwordHash]
        );

        return res.json({
            success: true,
            data: rs.rows[0],
            message: "Tạo user thành công",
        });
    } catch (e) {
        console.error("ADMIN CREATE USER ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function deleteUser(req, res) {
    try {
        const userId = req.params.userId;

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "userId không hợp lệ",
                error_code: "VALIDATION_ERROR",
            });
        }

        // Kiểm tra user có tồn tại không
        const user = await pool.query(
            `SELECT user_id, username, email FROM "user" WHERE user_id = $1`,
            [userId]
        );

        if (user.rowCount === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "User không tồn tại",
                error_code: "USER_NOT_FOUND",
            });
        }

        // Kiểm tra user có phải là admin không (không cho xóa admin)
        const adminCheck = await pool.query(
            `SELECT is_admin FROM manager WHERE user_id = $1`,
            [userId]
        );

        if (adminCheck.rowCount > 0 && adminCheck.rows[0].is_admin) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Không thể xóa tài khoản admin",
                error_code: "CANNOT_DELETE_ADMIN",
            });
        }

        // Xóa user (cascade sẽ xóa các bản ghi liên quan)
        await pool.query(`DELETE FROM "user" WHERE user_id = $1`, [userId]);

        return res.json({
            success: true,
            data: null,
            message: "Xóa user thành công",
        });
    } catch (e) {
        console.error("ADMIN DELETE USER ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { listUsers, updateUser, resetPassword, updateUserStatus, createUser, deleteUser };