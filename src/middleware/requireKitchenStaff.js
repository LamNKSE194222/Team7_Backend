const pool = require("../config/database");

async function requireKitchenStaff(req, res, next) {
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
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
            return res.status(403).json({ success: false, message: "Forbidden: kitchen staff only" });
        }

        if (rs.rows[0].status !== "active") {
            return res.status(403).json({ success: false, message: "Kitchen staff inactive" });
        }

        // gắn thêm để controller dùng
        req.user.central_kitchen_id = rs.rows[0].central_kitchen_id;

        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = { requireKitchenStaff };
