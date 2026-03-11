const pool = require("../config/database");

async function requireKitchenStaff(req, res, next) {
    try {
        const userId = req.user?.user_id;
        const role = req.user?.role;

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload",
                error_code: "INVALID_TOKEN"
            });
        }

        if (role !== "kitchen_staff") {
            return res.status(403).json({
                success: false,
                message: "Forbidden: kitchen staff only",
                error_code: "FORBIDDEN"
            });
        }

        const rs = await pool.query(
            `
            SELECT user_id, central_kitchen_id, status
            FROM kitchen_staff
            WHERE user_id = $1
            `,
            [userId]
        );

        if (rs.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: kitchen staff only",
                error_code: "FORBIDDEN"
            });
        }

        if (rs.rows[0].status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Kitchen staff inactive",
                error_code: "STAFF_INACTIVE"
            });
        }

        req.user.central_kitchen_id = rs.rows[0].central_kitchen_id;
        next();
    } catch (err) {
        console.error("requireKitchenStaff error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error_code: "SERVER_ERROR"
        });
    }
}

module.exports = { requireKitchenStaff };