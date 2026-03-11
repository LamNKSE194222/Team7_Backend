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

        if (order.status !== "fulfilled") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Chỉ xác nhận khi đơn ở trạng thái fulfilled"
            });
        }

        const inventoryResult = await client.query(
            `
            SELECT inventory_id
            FROM franchise_inventory
            WHERE franchise_store_id = $1
            ORDER BY inventory_id
            LIMIT 1
            FOR UPDATE
            `,
            [storeId]
        );

        if (inventoryResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Franchise store chưa có kho inventory"
            });
        }

        const inventoryId = inventoryResult.rows[0].inventory_id;

        const inventoryUpsert = await client.query(
            `
            INSERT INTO franchise_inventory_item (
                inventory_id,
                product_id,
                on_hand_qty,
                last_updated_at
            )
            SELECT
                $1,
                oi.product_id,
                SUM(oi.qty),
                NOW()
            FROM order_item oi
            WHERE oi.order_id = $2
            GROUP BY oi.product_id
            ON CONFLICT (inventory_id, product_id)
            DO UPDATE
            SET
                on_hand_qty = franchise_inventory_item.on_hand_qty + EXCLUDED.on_hand_qty,
                last_updated_at = NOW()
            RETURNING inventory_id, product_id, on_hand_qty
            `,
            [inventoryId, orderId]
        );

        if (inventoryUpsert.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Đơn hàng không có sản phẩm để nhập kho"
            });
        }

        const updated = await client.query(
            `
            UPDATE orders
            SET status = 'confirmed',
                received_confirmed_at = NOW(),
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
            message: "Đã xác nhận nhận hàng và cộng vào kho franchise",
            data: {
                ...updated.rows[0],
                inventory_updated_count: inventoryUpsert.rowCount
            }
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("CONFIRM RECEIPT ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
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
                TO_CHAR(o.delivery_date, 'YYYY-MM-DD') AS delivery_date,
                o.fulfilled_at,
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
                o.delivery_date,
                o.fulfilled_at,
                o.received_confirmed_at
            ORDER BY o.delivery_date DESC NULLS LAST, o.order_id DESC
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