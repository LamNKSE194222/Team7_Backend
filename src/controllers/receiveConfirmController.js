const pool = require("../config/database");

async function confirmReceipt(req, res) {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
        return res.status(400).json({ success: false, message: "orderId không hợp lệ" });
    }

    const { rating, comment } = req.body || {};
    const rate = Number(rating);

    if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
        return res.status(400).json({ success: false, message: "rating phải từ 1 đến 5" });
    }
    if (comment && String(comment).length > 1000) {
        return res.status(400).json({ success: false, message: "comment tối đa 1000 ký tự" });
    }

    // ✅ lấy từ requireAuth + requireFranchiseStaff
    const userId = req.user.user_id;
    const storeId = req.user.franchise_store_id;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // lock đơn để tránh 2 người confirm cùng lúc
        const lock = await client.query(
            `SELECT order_id, franchise_store_id, status, received_confirmed_at
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

        // check đúng store
        if (Number(order.franchise_store_id) !== Number(storeId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ success: false, message: "Bạn không có quyền với đơn này" });
        }

        // idempotent: đã confirm thì trả ok
        if (order.status === "confirmed" || order.received_confirmed_at) {
            await client.query("ROLLBACK");
            return res.json({
                success: true,
                message: "Đơn đã được xác nhận trước đó",
                data: {
                    order_id: order.order_id,
                    status: order.status,
                    received_confirmed_at: order.received_confirmed_at,
                },
            });
        }

        // chỉ confirm khi đã giao
        if (order.status !== "fulfilled") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Chỉ xác nhận khi đơn ở trạng thái đã giao (fulfilled)",
            });
        }

        const updated = await client.query(
            `UPDATE orders
       SET status = 'confirmed',
           received_confirmed_at = now(),
           received_confirmed_by_staff_id = $1,
           received_rating = $2,
           received_comment = $3
       WHERE order_id = $4
         AND franchise_store_id = $5
         AND status = 'fulfilled'
         AND received_confirmed_at IS NULL
       RETURNING order_id, order_code, status, received_confirmed_at`,
            [userId, rate, comment || null, orderId, storeId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Đã xác nhận nhận hàng",
            data: updated.rows[0],
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
}

async function listOrders(req, res) {
    try {
        const storeId = req.user.franchise_store_id;
        const filter = String(req.query.filter || "all").toLowerCase(); // all|delivered|confirmed
        const keyword = String(req.query.keyword || "").trim();

        const whereStatus =
            filter === "delivered"
                ? "o.status = 'fulfilled'"
                : filter === "confirmed"
                    ? "o.status = 'confirmed'"
                    : "o.status IN ('fulfilled','confirmed')";

        const sql = `
      SELECT o.order_id, o.order_code, o.status, o.created_at, o.delivered_at, o.received_confirmed_at
      FROM orders o
      WHERE o.franchise_store_id = $1
        AND (${whereStatus})
        AND ($2 = '' OR o.order_code ILIKE '%' || $2 || '%')
      ORDER BY o.created_at DESC
      LIMIT 50
    `;

        const { rows } = await pool.query(sql, [storeId, keyword]);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = { confirmReceipt, listOrders };