const pool = require("../config/database");

async function getOrder(client, orderId) {
    const rs = await client.query(
        `
        SELECT *
        FROM orders
        WHERE order_id = $1
        FOR UPDATE
        `,
        [orderId]
    );

    if (rs.rowCount === 0) {
        return null;
    }

    return rs.rows[0];
}

exports.readyToDeliver = async (req, res) => {
    const { orderId } = req.params;
    const kitchenId = req.user.central_kitchen_id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const order = await getOrder(client, orderId);

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
                fulfilled_at = NOW(),
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Đã cập nhật đơn hàng sang trạng thái sẵn sàng giao",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("readyToDeliver error:", err);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
};

exports.delivered = async (req, res) => {
    const { orderId } = req.params;
    const kitchenId = req.user.central_kitchen_id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const order = await getOrder(client, orderId);

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

        if (order.status !== "fulfilled") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Order must be fulfilled first",
            });
        }

        await client.query(
            `
            UPDATE orders
            SET status = 'confirmed',
                delivered_at = NOW()
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Order confirmed successfully",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("delivered error:", err);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
};

exports.getFulfilledOrders = async (req, res) => {
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
                o.fulfilled_at,
                o.received_confirmed_at,
                COUNT(oi.order_item_id) AS total_products,
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
                o.franchise_store_id,
                fs.name,
                o.central_kitchen_id,
                o.status,
                o.created_at,
                o.fulfilled_at,
                o.received_confirmed_at
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
        console.error("getFulfilledOrders error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
        });
    } finally {
        client.release();
    }
};

exports.getProcessingOrders = async (req, res) => {
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
        console.error("getProcessingOrders error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server error",
        });
    } finally {
        client.release();
    }
};