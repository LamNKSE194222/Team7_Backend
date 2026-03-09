const pool = require("../config/database");

async function autoApproveOrder(order_id) {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        // lock order
        const orderRs = await client.query(
            `SELECT order_id
             FROM orders
             WHERE order_id=$1
             AND status='pending'
             FOR UPDATE`,
            [order_id]
        );

        if (orderRs.rowCount === 0) {
            throw new Error("Order not found");
        }

        // lấy order items
        const itemsRs = await client.query(
            `SELECT product_id, qty
             FROM order_item
             WHERE order_id=$1`,
            [order_id]
        );

        let canApprove = true;

        for (const item of itemsRs.rows) {

            // lấy material của product
            const materialRs = await client.query(
                `
                SELECT material_id, default_ratio
                FROM material_product_type
                WHERE product_type_id = (
                    SELECT product_type_id
                    FROM product
                    WHERE product_id=$1
                )
                `,
                [item.product_id]
            );

            for (const m of materialRs.rows) {

                const neededQty = item.qty * Number(m.default_ratio);

                const stockRs = await client.query(
                    `
                    SELECT on_hand_qty
                    FROM central_kitchen_inventory_item
                    WHERE material_id=$1
                    FOR UPDATE
                    `,
                    [m.material_id]
                );

                if (stockRs.rowCount === 0) {
                    canApprove = false;
                    break;
                }

                const stock = Number(stockRs.rows[0].on_hand_qty);

                if (stock < neededQty) {
                    canApprove = false;
                    break;
                }

            }

            if (!canApprove) break;
        }

        // ====================
        // APPROVE
        // ====================
        if (canApprove) {

            for (const item of itemsRs.rows) {

                const materialRs = await client.query(
                    `
                    SELECT material_id, default_ratio
                    FROM material_product_type
                    WHERE product_type_id = (
                        SELECT product_type_id
                        FROM product
                        WHERE product_id=$1
                    )
                    `,
                    [item.product_id]
                );

                for (const m of materialRs.rows) {

                    const neededQty = item.qty * Number(m.default_ratio);

                    await client.query(
                        `
                        UPDATE central_kitchen_inventory_item
                        SET on_hand_qty = on_hand_qty - $1,
                            last_updated_at = NOW()
                        WHERE material_id=$2
                        `,
                        [neededQty, m.material_id]
                    );

                }

            }

            await client.query(
                `
                UPDATE orders
                SET status='processing',
                    approved_at=NOW(),
                    processing_started_at=NOW()
                WHERE order_id=$1
                `,
                [order_id]
            );

        }

        await client.query("COMMIT");

    } catch (err) {

        await client.query("ROLLBACK");
        console.error("AUTO APPROVE ERROR:", err);

    } finally {

        client.release();

    }
}

module.exports = autoApproveOrder;