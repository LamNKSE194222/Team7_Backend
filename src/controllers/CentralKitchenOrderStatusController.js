const pool = require("../config/database");

async function CentralGetOrders(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                o.order_id,
                o.order_code,
                o.status,
                COALESCE(o.payment_status, 'unpaid') AS payment_status,
                o.created_at,
                o.desired_date,
                o.fulfilled_at,
                o.note,

                fs.franchise_store_id,
                fs.name AS franchise_store_name,

                COALESCE(SUM(oi.qty * oi.unit_price), 0)::bigint AS total_amount,
                COUNT(DISTINCT oi.product_id)::int AS total_items,
                COALESCE(SUM(oi.qty), 0)::int AS total_product_qty,

                COALESCE(
                    STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name),
                    ''
                ) AS product_names,

                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'product_id', oi.product_id,
                            'product_name', p.name,
                            'qty', oi.qty,
                            'unit_price', oi.unit_price,
                            'line_total', (oi.qty * oi.unit_price)
                        )
                        ORDER BY p.name
                    ) FILTER (WHERE oi.product_id IS NOT NULL),
                    '[]'::json
                ) AS product_details
            FROM orders o
            LEFT JOIN franchise_store fs
                ON fs.franchise_store_id = o.franchise_store_id
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            LEFT JOIN product p
                ON p.product_id = oi.product_id
            WHERE o.central_kitchen_id = $1
            GROUP BY
                o.order_id,
                o.order_code,
                o.status,
                o.payment_status,
                o.created_at,
                o.desired_date,
                o.fulfilled_at,
                o.note,
                fs.franchise_store_id,
                fs.name
            ORDER BY o.created_at DESC
            `,
            [req.user.central_kitchen_id]
        );

        return res.json({
            success: true,
            data: rs.rows
        });

    } catch (e) {
        console.error("GET ORDERS ERROR:", e);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

async function readyToDeliver(req, res) {
    const { orderId } = req.params;
    const kitchenId = req.user.central_kitchen_id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const orderResult = await client.query(
            `
            SELECT order_id, central_kitchen_id, status
            FROM orders
            WHERE order_id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        const order = orderResult.rows[0];

        if (!order) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (Number(order.central_kitchen_id) !== Number(kitchenId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "Bạn không thể xử lý đơn hàng này",
            });
        }

        if (order.status !== "processing") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Đơn hàng phải ở trạng thái processing trước",
            });
        }

        await client.query(
            `
            UPDATE orders
            SET status = 'fulfilled',
                fulfilled_at = NOW()
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        // Gửi notification cho Franchise
        const notificationService = req.app.get('notificationService');
        if (notificationService) {
            await notificationService.notifyOrderCompleted(orderId);
        }

        return res.json({
            success: true,
            message: "Đã xong, sẵn sàng giao hàng",
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

async function getFulfilledOrders(req, res) {
    const kitchenId = req.user.central_kitchen_id;
    const client = await pool.connect();

    try {
        const rs = await client.query(
            `
            SELECT
                o.order_id,
                o.order_code,
                o.status,
                o.fulfilled_at,
                o.received_confirmed_at,
                o.franchise_store_id,
                o.note,
                fs.name AS store_name,
                COUNT(oi.order_item_id) AS total_items,
                STRING_AGG(p.name, ', ' ORDER BY p.name) AS product_names
            FROM orders o
            LEFT JOIN franchise_store fs
                ON fs.franchise_store_id = o.franchise_store_id
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            LEFT JOIN product p
                ON p.product_id = oi.product_id
            WHERE o.central_kitchen_id = $1
              AND o.status = 'fulfilled'
            GROUP BY
                o.order_id,
                o.order_code,
                o.status,
                o.fulfilled_at,
                o.received_confirmed_at,
                o.franchise_store_id,
                o.note,
                fs.name
            ORDER BY o.fulfilled_at DESC NULLS LAST, o.order_id DESC
            `,
            [kitchenId]
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

async function getProcessingOrders(req, res) {
    const kitchenId = req.user.central_kitchen_id;
    const client = await pool.connect();

    try {
        const rs = await client.query(
            `
            SELECT
                o.order_id,
                o.order_code,
                o.franchise_store_id,
                fs.name AS store_name,
                o.central_kitchen_id,
                o.status,
                o.created_at,
                o.desired_date,
                o.note,
                COUNT(oi.order_item_id) AS total_items,
                STRING_AGG(p.name, ', ' ORDER BY p.name) AS product_names
            FROM orders o
            LEFT JOIN franchise_store fs
                ON fs.franchise_store_id = o.franchise_store_id
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            LEFT JOIN product p
                ON p.product_id = oi.product_id
            WHERE o.central_kitchen_id = $1
              AND o.status = 'processing'
            GROUP BY
                o.order_id,
                o.order_code,
                o.franchise_store_id,
                fs.name,
                o.central_kitchen_id,
                o.status,
                o.created_at,
                o.note,
                o.desired_date
            ORDER BY o.created_at DESC, o.order_id DESC
            `,
            [kitchenId]
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

module.exports = { CentralGetOrders, readyToDeliver, getFulfilledOrders, getProcessingOrders, };