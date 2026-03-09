const pool = require('../config/database');
const autoApproveOrder = require("../services/autoApproveOrder");

// CREATE ORDER (Franchise staff)

async function createOrder(req, res) {

    let client;

    try {

        const { desired_date, note, items } = req.body || {};

        // validate input
        if (!desired_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "desired_date và items là bắt buộc"
            });
        }

        // chỉ franchise staff mới tạo đơn
        if (!req.user?.franchise_store_id) {
            return res.status(403).json({
                success: false,
                message: "Chỉ franchise staff mới được tạo đơn"
            });
        }

        // gom product trùng
        const map = new Map();

        for (const it of items) {
            const product_id = Number(it.product_id);
            const qty = Number(it.qty);

            if (!product_id || !qty || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "product_id hoặc qty không hợp lệ"
                });
            }

            map.set(product_id, (map.get(product_id) || 0) + qty);
        }

        const normalizedItems = Array.from(map.entries()).map(
            ([product_id, qty]) => ({
                product_id,
                qty
            })
        );

        client = await pool.connect();
        await client.query("BEGIN");

        // 0) inventory_id
        const invRs = await client.query(
            `SELECT inventory_id FROM franchise_inventory WHERE franchise_store_id = $1 LIMIT 1`,
            [req.user.franchise_store_id]
        );

        if (invRs.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                data: null,
                message: "Store chưa có inventory",
                error_code: "INVENTORY_NOT_FOUND",
            });
        }

        const inventoryId = invRs.rows[0].inventory_id;

        // 1) check + reserve (lock row)
        for (const it of normalizedItems) {
            const stockRs = await client.query(
                `
        SELECT on_hand_qty, reserved_qty
        FROM franchise_inventory_item
        WHERE inventory_id = $1 AND product_id = $2
        FOR UPDATE
        `,
                [inventoryId, it.product_id]
            );

            if (stockRs.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: `Kho chưa có sản phẩm product_id=${it.product_id}`,
                    error_code: "NO_STOCK_ROW",
                });
            }

            const onHand = Number(stockRs.rows[0].on_hand_qty);
            const reserved = Number(stockRs.rows[0].reserved_qty);
            const available = onHand - reserved;

            if (available < it.qty) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: `Không đủ tồn kho cho product_id=${it.product_id} (available=${available}, need=${it.qty})`,
                    error_code: "INSUFFICIENT_STOCK",
                });
            }

            await client.query(
                `
        UPDATE franchise_inventory_item
        SET reserved_qty = reserved_qty + $1,
                    last_updated_at = NOW()
        WHERE inventory_id = $2 AND product_id = $3
                    `,
                [it.qty, inventoryId, it.product_id]
            );
        }

        // 2) create order
        const orderCode = "ORD-" + Date.now();

        // tạo order
        const orderRs = await client.query(
            `
            INSERT INTO orders
            (
                order_code,
                franchise_store_id,
                created_by_staff_id,
                central_kitchen_id,
                fulfilled_by_kitchen_staff_id,
                status,
                desired_date,
                note
            )
            VALUES ($1,$2,$3,2,3,'pending',$4,$5)
            RETURNING order_id, order_code, created_at
            `,
            [
                orderCode,
                req.user.franchise_store_id,
                req.user.user_id,
                desired_date,
                note ?? null
            ]
        );

        const order = orderRs.rows[0];

        // lấy product info, thêm name
        const productIds = normalizedItems.map(x => x.product_id);

        const productRs = await client.query(
            `
            SELECT product_id, name, price, uom
            FROM product
            WHERE product_id = ANY($1::int[])
            `,
            [productIds]
        );

        const productMap = new Map(
            productRs.rows.map(r => [
                Number(r.product_id),
                {
                    name: r.name,
                    price: Number(r.price),
                    uom: r.uom
                }
            ])
        );

        // insert order items
        for (const it of normalizedItems) {
            const p = productMap.get(it.product_id);

            if (!p) {
                throw new Error(`Product ${it.product_id} not found`);
            }

            await client.query(
                `
                INSERT INTO order_item
                (order_id,product_id,qty,unit_price,uom)
                VALUES ($1,$2,$3,$4,$5)
                `,
                [
                    order.order_id,
                    it.product_id,
                    it.qty,
                    p.price,
                    p.uom
                ]
            );
        }

        await client.query("COMMIT");

        // auto approve
        await autoApproveOrder(order.order_id);

        const updated = await pool.query(
            `SELECT status, created_at FROM orders WHERE order_id = $1`,
            [order.order_id]
        );

        const productNames = normalizedItems
            .map(it => productMap.get(it.product_id)?.name)
            .filter(Boolean);

        return res.status(201).json({
            success: true,
            data: {
                order_id: order.order_id,
                order_code: order.order_code,
                status: updated.rows[0].status,
                created_at: updated.rows[0].created_at,
                total_products: normalizedItems.length,
                product_names: productNames
            },
            message: "Tạo đơn thành công"
        });

    } catch (e) {

        if (client) await client.query("ROLLBACK");

        console.error("CREATE ORDER ERROR:", e);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {

        if (client) client.release();
    }
}

async function getOrders(req, res) {

    try {

        if (!req.user?.franchise_store_id) {

            return res.status(403).json({
                success: false,
                message: "Không có quyền xem đơn"
            });

        }

        const rs = await pool.query(
            `
            SELECT
            o.order_id,
            o.order_code,
            o.status,
            o.created_at,
            o.desired_date,
            COUNT(oi.order_item_id) total_items
            FROM orders o
            LEFT JOIN order_item oi
            ON oi.order_id=o.order_id
            WHERE o.franchise_store_id=$1
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
            `,
            [req.user.franchise_store_id]
        );

        return res.json({
            success: true,
            data: rs.rows
        });

    } catch (e) {

        console.error(e);

        return res.status(500).json({
            success: false
        });

    }

}

async function deductCentralStock(orderId) {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const items = await client.query(
            `
            SELECT product_id,qty
            FROM order_item
            WHERE order_id=$1
            `,
            [orderId]
        );

        for (const item of items.rows) {

            await client.query(
                `
                UPDATE central_kitchen_inventory
                SET stock_quantity = stock_quantity - $1
                WHERE product_id=$2
                `,
                [item.qty, item.product_id]
            );

        }

        await client.query("COMMIT");

    } catch (err) {

        await client.query("ROLLBACK");
        console.error(err);

    } finally {

        client.release();

    }

}

module.exports = { createOrder, getOrders, deductCentralStock };
// GET /api/orders/:id
async function detail(req, res) {
    try {
        if (!req.user?.franchise_store_id) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản này không thuộc franchise_store (không phải franchise_staff)",
                error_code: "NOT_STORE_STAFF",
            });
        }

        const orderId = Number(req.params.id);

        const orderRs = await pool.query(
            `
      SELECT order_id, order_code, status, desired_date, created_at, note, delivered_at
      FROM orders
      WHERE order_id = $1 AND franchise_store_id = $2
                `,
            [orderId, req.user.franchise_store_id]
        );

        if (orderRs.rowCount === 0) {
            return res.status(404).json({ success: false, data: null, message: "Order not found" });
        }

        const itemsRs = await pool.query(
            `
      SELECT 
        oi.order_item_id,
                oi.product_id,
                p.name,
                oi.uom,
                oi.qty,
                oi.unit_price
      FROM order_item oi
      JOIN product p ON p.product_id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.order_item_id
                `,
            [orderId]
        );

        return res.json({
            success: true,
            data: { order: orderRs.rows[0], items: itemsRs.rows },
            message: null,
        });
    } catch (e) {
        console.error("ORDER DETAIL ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "DB error" });
    }
}

module.exports = { createOrder, getOrders, detail };
