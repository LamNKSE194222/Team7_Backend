const pool = require("../config/database");

async function autoApproveOrder(order_id) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // lock order
        const orderRs = await client.query(
            `
            SELECT order_id, central_kitchen_id, status
            FROM orders
            WHERE order_id = $1
              AND status = 'pending'
            FOR UPDATE
            `,
            [order_id]
        );

        if (orderRs.rowCount === 0) {
            throw new Error("Order not found or not pending");
        }

        const order = orderRs.rows[0];

        // lấy order items + tên product
        const itemsRs = await client.query(
            `
            SELECT
                oi.product_id,
                oi.qty,
                p.name AS product_name
            FROM order_item oi
            JOIN product p
                ON p.product_id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY oi.order_item_id ASC
            `,
            [order_id]
        );

        if (itemsRs.rowCount === 0) {
            throw new Error("Order has no items");
        }

        let canApprove = true;
        const inventoryMap = new Map();

        // kiểm tra tồn kho product
        for (const item of itemsRs.rows) {
            const stockRs = await client.query(
                `
                SELECT
                    inventory_item_id,
                    on_hand_qty
                FROM central_kitchen_product_inventory_item
                WHERE central_kitchen_id = $1
                  AND product_id = $2
                FOR UPDATE
                `,
                [order.central_kitchen_id, item.product_id]
            );

            if (stockRs.rowCount === 0) {
                canApprove = false;
                break;
            }

            const stockRow = stockRs.rows[0];
            const onHandQty = Number(stockRow.on_hand_qty);
            const requiredQty = Number(item.qty);

            if (onHandQty < requiredQty) {
                canApprove = false;
                break;
            }

            inventoryMap.set(Number(item.product_id), {
                inventory_item_id: stockRow.inventory_item_id,
                on_hand_qty: onHandQty
            });
        }

        // đủ tồn thì trừ kho product + update order
        if (canApprove) {
            for (const item of itemsRs.rows) {
                const inventory = inventoryMap.get(Number(item.product_id));
                const requiredQty = Number(item.qty);

                await client.query(
                    `
            UPDATE central_kitchen_product_inventory_item
            SET on_hand_qty = on_hand_qty - $1,
                last_updated_at = NOW()
            WHERE inventory_item_id = $2
            `,
                    [requiredQty, inventory.inventory_item_id]
                );
            }

            await client.query(
                `
        UPDATE orders
        SET status = 'processing',
            approved_at = NOW(),
            processing_started_at = NOW()
        WHERE order_id = $1
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