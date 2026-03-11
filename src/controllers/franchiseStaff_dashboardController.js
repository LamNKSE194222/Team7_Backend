const pool = require("../config/database");

async function Fdashboard(req, res) {
    try {
        const storeId = req.user.franchise_store_id;

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

        // Đơn gần đây + số sản phẩm + ngày giao
        const recentRs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        0.delivery_date,
        o.delivered_at,
        COUNT(oi.order_item_id)::int AS product_count
      FROM orders o
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.franchise_store_id = $1
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
      LIMIT 5
      `,
            [storeId]
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