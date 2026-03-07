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
                message: "You cannot process this order",
            });
        }

        if (order.status !== "processing") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Order must be processing first",
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

        return res.json({
            success: true,
            message: "Order marked as fulfilled",
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

        if (order.central_kitchen_id !== kitchenId) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "You cannot process this order",
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
                confirmed_at = NOW()
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Order confirmed successfully",
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
};