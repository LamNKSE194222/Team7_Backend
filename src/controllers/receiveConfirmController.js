const pool = require("../config/database");

async function confirmReceipt(req, res) {
    const orderId = Number(req.params.orderId);

    if (!Number.isFinite(orderId)) {
        return res.status(400).json({
            success: false,
            message: "orderId không hợp lệ"
        });
    }

    const { rating, comment } = req.body || {};
    const rate = Number(rating);

    if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
        return res.status(400).json({
            success: false,
            message: "rating phải từ 1 đến 5"
        });
    }

    if (comment && String(comment).length > 1000) {
        return res.status(400).json({
            success: false,
            message: "comment tối đa 1000 ký tự"
        });
    }

    const userId = req.user.user_id;
    const storeId = req.user.franchise_store_id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const lock = await client.query(
            `
            SELECT order_id, franchise_store_id, status
            FROM orders
            WHERE order_id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (lock.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng"
            });
        }

        const order = lock.rows[0];

        if (Number(order.franchise_store_id) !== Number(storeId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền với đơn này"
            });
        }

        // đã hoàn tất rồi
        if (order.status === "confirmed") {
            await client.query("ROLLBACK");
            return res.json({
                success: true,
                message: "Đơn đã được xác nhận trước đó",
                data: {
                    order_id: order.order_id,
                    status: order.status
                }
            });
        }

        // chỉ confirm khi đã giao tới cửa hàng
        if (order.status !== "fulfilled") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Chỉ xác nhận khi đơn ở trạng thái fulfilled"
            });
        }

        const updated = await client.query(
            `
            UPDATE orders
            SET status = 'confirmed',
                received_confirmed_at = now(),
                received_confirmed_by_staff_id = $1,
                received_rating = $2,
                received_comment = $3
            WHERE order_id = $4
            RETURNING order_id, order_code, status, received_confirmed_at
            `,
            [userId, rate, comment || null, orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Đã xác nhận nhận hàng",
            data: updated.rows[0]
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    } finally {
        client.release();
    }
}


async function listOrders(req, res) {
    try {
        const storeId = req.user.franchise_store_id;
        const keyword = String(req.query.keyword || "").trim();

        const sql = `
            SELECT
                o.order_id,
                o.order_code,
                o.status,
                o.created_at,
                o.delivered_at,
                o.received_confirmed_at,
                COUNT(DISTINCT oi.product_id) AS total_products,
                COALESCE(
                    STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name),
                    ''
                ) AS product_names
            FROM orders o
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            LEFT JOIN product p
                ON p.product_id = oi.product_id
            WHERE o.franchise_store_id = $1
              AND o.status = 'fulfilled'
              AND ($2 = '' OR o.order_code ILIKE '%' || $2 || '%')
            GROUP BY
                o.order_id,
                o.order_code,
                o.status,
                o.created_at,
                o.delivered_at,
                o.received_confirmed_at
            ORDER BY o.created_at DESC
            LIMIT 50
        `;

        const { rows } = await pool.query(sql, [storeId, keyword]);

        return res.json({
            success: true,
            data: rows.map(row => ({
                ...row,
                total_products: Number(row.total_products),
                product_label: `${Number(row.total_products)} sản phẩm`
            }))
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

module.exports = { confirmReceipt, listOrders };