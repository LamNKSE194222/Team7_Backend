const pool = require("../config/database");

async function requireFranchiseStaff(req, res, next) {
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
        }

        const rs = await pool.query(
            `
      SELECT user_id, franchise_store_id, status
      FROM franchise_staff
      WHERE user_id = $1
      `,
            [userId]
        );

        if (rs.rowCount === 0) {
            return res.status(403).json({ success: false, message: "Forbidden: franchise staff only" });
        }

        if (rs.rows[0].status !== "active") {
            return res.status(403).json({ success: false, message: "Franchise staff inactive" });
        }

        // gắn thêm để controller dùng
        req.user.franchise_store_id = rs.rows[0].franchise_store_id;

        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = { requireFranchiseStaff };