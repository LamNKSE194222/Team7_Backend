<<<<<<< HEAD
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
        req.user.franchise_id = rs.rows[0].franchise_id;

        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
=======
function requireFranchiseStaff(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.franchise_store_id) {
        return res.status(403).json({
            success: false,
            message: "Chỉ franchise staff mới được phép truy cập",
            error_code: "FORBIDDEN",
        });
    }

    next();
>>>>>>> c8a5a0060766fab4d2674459453b8c976fa4a8e9
}

module.exports = { requireFranchiseStaff };