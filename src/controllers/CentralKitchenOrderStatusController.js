const pool = require("../config/database");

// GET /api/centralKitchen/orders/status?status=processing|fulfilled|approved
async function listByStatus(req, res) {
    try {
        const centralKitchenId = req.user.central_kitchen_id; // requireKitchenStaff gắn
        const status = String(req.query.status || "processing");

        const allowed = new Set(["approved", "processing", "fulfilled"]);
        if (!allowed.has(status)) {
            return res.status(400).json({ success: false, message: "status không hợp lệ" });
        }

        const { rows } = await pool.query(
            `
       SELECT
  o.order_id,
  o.order_code,
  o.status,
  o.created_at,
  o.desired_date,
  o.delivered_at,
  fs.name AS store_name,
  COALESCE(
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'product_id', p.product_id,
        'product_name', p.name,
        'qty', oi.qty,
        'uom', COALESCE(oi.uom, p.uom),
        'unit_price', oi.unit_price
      )
      ORDER BY oi.order_item_id
    ) FILTER (WHERE oi.order_item_id IS NOT NULL),
    '[]'::json
  ) AS items
FROM orders o
LEFT JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
LEFT JOIN order_item oi ON oi.order_id = o.order_id
LEFT JOIN product p ON p.product_id = oi.product_id
WHERE o.central_kitchen_id = $1
  AND o.status = $2
GROUP BY
  o.order_id, o.order_code, o.status, o.created_at, o.desired_date, o.delivered_at, fs.name
ORDER BY o.created_at DESC;
      `,
            [centralKitchenId, status]
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

// POST /api/centralKitchen/orders/:orderId/start-processing  (approved -> processing)
async function startProcessing(req, res) {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return res.status(400).json({ success: false, message: "orderId không hợp lệ" });

    const centralKitchenId = req.user.central_kitchen_id;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const lock = await client.query(
            `SELECT order_id, status, central_kitchen_id
       FROM orders
       WHERE order_id = $1
       FOR UPDATE`,
            [orderId]
        );
        if (lock.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        const order = lock.rows[0];
        if (Number(order.central_kitchen_id) !== Number(centralKitchenId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ success: false, message: "Không có quyền với đơn này" });
        }

        if (order.status === "processing") {
            await client.query("ROLLBACK");
            return res.json({ success: true, message: "Đơn đã ở trạng thái processing" });
        }
        if (order.status !== "approved") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Chỉ chuyển sang processing khi đơn ở trạng thái approved" });
        }

        const updated = await client.query(
            `UPDATE orders
       SET status = 'processing'
       WHERE order_id = $1 AND status = 'approved'
       RETURNING order_id, order_code, status`,
            [orderId]
        );

        await client.query("COMMIT");
        return res.json({ success: true, message: "Đã chuyển sang processing", data: updated.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
}

// POST /api/centralKitchen/orders/:orderId/ready-to-deliver  (processing -> fulfilled)
async function readyToDeliver(req, res) {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) return res.status(400).json({ success: false, message: "orderId không hợp lệ" });

    const centralKitchenId = req.user.central_kitchen_id;
    const staffId = req.user.user_id;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const lock = await client.query(
            `SELECT order_id, status, central_kitchen_id, delivered_at
       FROM orders
       WHERE order_id = $1
       FOR UPDATE`,
            [orderId]
        );
        if (lock.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        const order = lock.rows[0];
        if (Number(order.central_kitchen_id) !== Number(centralKitchenId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ success: false, message: "Không có quyền với đơn này" });
        }

        if (order.status === "fulfilled") {
            await client.query("ROLLBACK");
            return res.json({ success: true, message: "Đơn đã ở trạng thái fulfilled", data: { order_id: order.order_id, status: order.status, delivered_at: order.delivered_at } });
        }

        if (order.status !== "processing") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Chỉ chuyển sang fulfilled khi đơn ở trạng thái processing" });
        }

        const updated = await client.query(
            `UPDATE orders
       SET status = 'fulfilled',
           delivered_at = now(),
           fulfilled_by_kitchen_staff_id = $1
       WHERE order_id = $2
         AND status = 'processing'
       RETURNING order_id, order_code, status, delivered_at`,
            [staffId, orderId]
        );

        await client.query("COMMIT");
        return res.json({ success: true, message: "Đã chuyển sang fulfilled", data: updated.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
}

module.exports = { listByStatus, startProcessing, readyToDeliver };