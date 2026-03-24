const pool = require("../config/database");

async function Cdashboard(req, res) {
    try {
        const kitchenId = req.user.central_kitchen_id;
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

        // 4) Cảnh báo tồn kho 
        const expiryDays = Number(req.query.expiry_days ?? 60);

        const expiringRs = await pool.query(
            `
    SELECT
        m.material_id,
        m.name AS material_name,
        ckii.on_hand_qty,
        ckii.expiry_date,
        ckii.last_updated_at,
        cki.inventory_code,
        (ckii.expiry_date - CURRENT_DATE) AS days_left
    FROM central_kitchen_inventory_item ckii
    JOIN central_kitchen_inventory cki 
        ON cki.inventory_id = ckii.inventory_id
    JOIN material m 
        ON m.material_id = ckii.material_id
    WHERE cki.central_kitchen_id = $1
      AND ckii.expiry_date IS NOT NULL
      AND ckii.expiry_date <= CURRENT_DATE + ($2::int)
    ORDER BY ckii.expiry_date ASC
    LIMIT 5
    `,
            [kitchenId, expiryDays]
        );

        return res.json({
            success: true,
            data: {
                cards,
                pending_orders: pendingRs.rows,
                recent_orders: recentRs.rows,
                expiring_materials: expiringRs.rows,
                expiry_days: expiryDays,
            },
            message: null,
        });
    } catch (e) {
        console.error("CENTRAL_KITCHEN DASHBOARD ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Dashboard error" });
    }
}

module.exports = { Cdashboard };
