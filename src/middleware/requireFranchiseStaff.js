const pool = require("../config/database");

async function requireFranchiseStaff(req, res, next) {
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

        if (role !== "franchise_staff") {
            return res.status(403).json({
                success: false,
                message: "Forbidden: franchise staff only",
                error_code: "FORBIDDEN"
            });
        }

        const rs = await pool.query(
            `
            SELECT
                fs.user_id,
                fs.franchise_store_id,
                fs.status AS staff_status,
                fst.status AS store_status
            FROM franchise_staff fs
            JOIN franchise_store fst
                ON fst.franchise_store_id = fs.franchise_store_id
            WHERE fs.user_id = $1
            `,
            [userId]
        );

        if (rs.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: franchise staff only",
                error_code: "FORBIDDEN"
            });
        }

        if (rs.rows[0].staff_status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Franchise staff inactive",
                error_code: "STAFF_INACTIVE"
            });
        }

        if (rs.rows[0].store_status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Franchise store inactive",
                error_code: "STORE_INACTIVE"
            });
        }

        req.user.franchise_store_id = rs.rows[0].franchise_store_id;
        next();
    } catch (err) {
        console.error("requireFranchiseStaff error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error_code: "SERVER_ERROR"
        });
    }
}

module.exports = { requireFranchiseStaff };