const pool = require("../config/database");

function requireStore(req, res) {
    if (!req.user.franchise_store_id) {
        res.status(403).json({
            success: false,
            data: null,
            message: "Tài khoản này không thuộc franchise_store (không phải franchise_staff)",
            error_code: "NOT_STORE_STAFF",
        });
        return false;
    }
    return true;
}

// POST /api/orders
async function create(req, res) {
    if (!requireStore(req, res)) return;

    const client = await pool.connect();
    try {
        const { desired_date, items } = req.body || {};
        if (!desired_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, data: null, message: "Invalid payload" });
        }

        await client.query("BEGIN");

        // order_code đơn giản (demo)
        const orderCode = "ORD-" + Date.now();

        const orderRs = await client.query(
            `
      INSERT INTO orders(order_code, franchise_store_id, created_by_staff_id, status, desired_date)
      VALUES ($1, $2, $3, 'pending', $4)
      RETURNING order_id, order_code, status, desired_date, created_at
      `,
            [orderCode, req.user.franchise_store_id, req.user.user_id, desired_date]
        );

        const order = orderRs.rows[0];

        // Insert items
        for (const it of items) {
            const productId = Number(it.product_id);
            const qty = Number(it.qty);

            if (!productId || !qty || qty <= 0) {
                throw new Error("Invalid item");
            }

            // lấy giá hiện tại của product làm unit_price (đúng schema của bạn)
            const priceRs = await client.query(
                `SELECT price FROM product WHERE product_id=$1`,
                [productId]
            );
            if (priceRs.rowCount === 0) throw new Error("Product not found: " + productId);

            const unitPrice = priceRs.rows[0].price;

            await client.query(
                `
        INSERT INTO order_item(order_id, product_id, qty, unit_price)
        VALUES ($1, $2, $3, $4)
        `,
                [order.order_id, productId, qty, unitPrice]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({ success: true, data: order, message: null });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CREATE ORDER ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Create order failed" });
    } finally {
        client.release();
    }
}

// GET /api/orders?status=pending
async function list(req, res) {
    if (!requireStore(req, res)) return;

    try {
        const status = req.query.status || null;

        const params = [req.user.franchise_store_id];
        let sql = `
      SELECT order_id, order_code, status, desired_date, created_at
      FROM orders
      WHERE franchise_store_id = $1
    `;

        if (status) {
            params.push(status);
            sql += ` AND status = $2`;
        }

        sql += ` ORDER BY created_at DESC`;

        const rs = await pool.query(sql, params);
        return res.json({ success: true, data: rs.rows, message: null });
    } catch (e) {
        console.error("LIST ORDER ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "DB error" });
    }
}

// GET /api/orders/:id
async function detail(req, res) {
    if (!requireStore(req, res)) return;

    try {
        const orderId = Number(req.params.id);

        const orderRs = await pool.query(
            `
      SELECT order_id, order_code, status, desired_date, created_at
      FROM orders
      WHERE order_id=$1 AND franchise_store_id=$2
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
        p.uom,
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

module.exports = { create, list, detail };
