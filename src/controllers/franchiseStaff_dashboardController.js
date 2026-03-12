const pool = require("../config/database");

async function Fdashboard(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["franchise_staff"];

        if (!allowed.includes(role)) {
            return res
                .status(403)
                .json({ success: false, data: null, message: "Forbidden" });
        }

        const storeId = req.user.franchise_store_id;
        if (!storeId) {
            return res.status(403).json({ success: false, data: null, message: "Not store staff" });
        }

        // Đếm theo status
        const statusRs = await pool.query(
            `
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE franchise_store_id = $1
      GROUP BY status
      `,
            [storeId]
        );

        const cards = { pending: 0, approved: 0, processing: 0, fulfilled: 0 };
        for (const r of statusRs.rows) cards[r.status] = r.count;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        // Đơn gần đây + số sản phẩm + ngày giao
        const recentRs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        o.delivered_at,
        COUNT(oi.order_item_id)::int AS product_count
      FROM orders o
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.franchise_store_id = $1
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
      `,
            [storeId, limit, offset]
        );

        return res.json({
            success: true,
            data: {
                cards,
                recent_orders: recentRs.rows,
            },
            message: null,
        });
    } catch (e) {
        console.error("DASHBOARD ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Dashboard error" });
    }
}

module.exports = { Fdashboard };