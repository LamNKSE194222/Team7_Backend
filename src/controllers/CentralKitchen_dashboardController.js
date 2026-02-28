const pool = require("../config/database");

async function Cdashboard(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["kitchen_staff"]; // Central Kitchen staff

        if (!allowed.includes(role)) {
            return res
                .status(403)
                .json({ success: false, data: null, message: "Forbidden" });
        }

        const kitchenId = req.user?.central_kitchen_id;
        if (!kitchenId) {
            return res.status(403).json({ success: false, data: null, message: "Not kitchen staff" });
        }

        // 1) Cards: đếm theo status (đơn thuộc bếp trung tâm này)
        const statusRs = await pool.query(
            `
      SELECT o.status, COUNT(*)::int AS count
      FROM orders o
      WHERE o.central_kitchen_id = $1
      GROUP BY o.status
      `,
            [kitchenId]
        );

        const cards = { pending: 0, approved: 0, processing: 0, fulfilled: 0 };
        for (const r of statusRs.rows) {
            if (cards.hasOwnProperty(r.status)) cards[r.status] = r.count;
        }

        // 2) Đơn chờ xử lý: pending/approved/processing (show giống màn hình bạn)
        // kèm store name + số sản phẩm
        const pendingRs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.desired_date,
        o.created_at,
        fs.franchise_store_id,
        fs.name AS store_name,
        COUNT(oi.order_item_id)::int AS product_count
      FROM orders o
      JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.central_kitchen_id = $1
        AND o.status IN ('pending', 'approved', 'processing')
      GROUP BY o.order_id, fs.franchise_store_id
      ORDER BY o.created_at DESC
      LIMIT 5
      `,
            [kitchenId]
        );

        // 3) Recent orders (5 đơn gần đây) - tương tự franchisestaff
        const recentRs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        o.delivered_at,
        o.desired_date,
        fs.name AS store_name,
        COUNT(oi.order_item_id)::int AS product_count
      FROM orders o
      JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.central_kitchen_id = $1
      GROUP BY o.order_id, fs.name
      ORDER BY o.created_at DESC
      LIMIT 5
      `,
            [kitchenId]
        );

        // 4) Cảnh báo tồn kho (vì schema bạn chỉ có tồn kho ở franchise_inventory)
        // Mình làm alert "available_qty = on_hand - reserved" thấp (<= threshold)
        const threshold = Number(req.query.threshold || 5);

        const lowStockRs = await pool.query(
            `
      SELECT
        fs.franchise_store_id,
        fs.name AS store_name,
        p.product_id,
        p.name AS product_name,
        (fii.on_hand_qty - fii.reserved_qty) AS available_qty,
        fii.on_hand_qty,
        fii.reserved_qty,
        fii.last_updated_at
      FROM franchise_inventory_item fii
      JOIN franchise_inventory fi ON fi.inventory_id = fii.inventory_id
      JOIN franchise_store fs ON fs.franchise_store_id = fi.franchise_store_id
      JOIN product p ON p.product_id = fii.product_id
      WHERE (fii.on_hand_qty - fii.reserved_qty) <= $1
      ORDER BY available_qty ASC, fii.last_updated_at DESC
      LIMIT 5
      `,
            [threshold]
        );

        return res.json({
            success: true,
            data: {
                cards,
                pending_orders: pendingRs.rows,
                recent_orders: recentRs.rows,
                low_stock_alerts: lowStockRs.rows,
                threshold,
            },
            message: null,
        });
    } catch (e) {
        console.error("CENTRAL_KITCHEN DASHBOARD ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Dashboard error" });
    }
}

module.exports = { Cdashboard };
