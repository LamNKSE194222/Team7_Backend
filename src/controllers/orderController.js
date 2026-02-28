const pool = require("../config/database");

<<<<<<< HEAD
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
=======
// CREATE ORDER (Franchise staff)
async function createOrder(req, res) {
    let client;

    try {
        const { desired_date, note, items } = req.body || {};

        // validate input sớm (chưa cần connect DB)
        if (!desired_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "desired_date và items là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (!req.user?.franchise_store_id) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Chỉ franchise staff mới được tạo đơn",
                error_code: "FORBIDDEN",
            });
        }

        // normalize + gộp trùng product_id
        const map = new Map();
        for (const it of items) {
            const product_id = Number(it?.product_id);
            const qty = Number(it?.qty);

            if (!Number.isFinite(product_id) || product_id <= 0) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: "product_id không hợp lệ",
                    error_code: "VALIDATION_ERROR",
                });
            }
            if (!Number.isFinite(qty) || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: "qty không hợp lệ",
                    error_code: "VALIDATION_ERROR",
                });
            }

            map.set(product_id, (map.get(product_id) || 0) + qty);
        }

        const normalizedItems = Array.from(map.entries()).map(([product_id, qty]) => ({
            product_id,
            qty,
        }));

        // connect sau khi validate xong
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
        const orderRs = await client.query(
            `
      INSERT INTO orders (order_code, franchise_store_id, created_by_staff_id, status, desired_date, note)
      VALUES ($1, $2, $3, 'pending', $4, $5)
      RETURNING order_id, order_code, status
      `,
            [orderCode, req.user.franchise_store_id, req.user.user_id, desired_date, note ?? null]
>>>>>>> 2908730f5ccfd86b38feed9a459e69bdf9821e49
        );

        const order = orderRs.rows[0];

<<<<<<< HEAD
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
=======
        // 3) fetch prices + uom once
        const productIds = normalizedItems.map((x) => x.product_id);

        const productRs = await client.query(
            `SELECT product_id, price, uom FROM product WHERE product_id = ANY($1::int[])`,
            [productIds]
        );

        if (productRs.rowCount !== productIds.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                data: null,
                message: "Có product_id không tồn tại",
                error_code: "PRODUCT_NOT_FOUND",
            });
        }

        const productMap = new Map(
            productRs.rows.map((r) => [
                Number(r.product_id),
                { price: Number(r.price), uom: r.uom },
            ])
        );

        // 4) insert order_item (PHẢI có uom)
        for (const it of normalizedItems) {
            const p = productMap.get(it.product_id);

            if (!p || p.uom == null) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: `Thiếu uom cho product_id=${it.product_id}`,
                    error_code: "UOM_NOT_FOUND",
                });
            }

            await client.query(
                `INSERT INTO order_item (order_id, product_id, qty, unit_price, uom)
         VALUES ($1, $2, $3, $4, $5)`,
                [order.order_id, it.product_id, it.qty, p.price, p.uom]
>>>>>>> 2908730f5ccfd86b38feed9a459e69bdf9821e49
            );
        }

        await client.query("COMMIT");

<<<<<<< HEAD
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
=======
        return res.status(201).json({
            success: true,
            data: {
                order_id: String(order.order_id),
                order_code: order.order_code,
                status: order.status,
            },
            message: "Tạo đơn hàng thành công",
        });
    } catch (e) {
        // rollback chỉ khi đã connect và đang ở transaction
        try {
            if (client) await client.query("ROLLBACK");
        } catch (_) { }

        console.error("CREATE ORDER ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
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
                data: null,
                message: "Không có quyền xem đơn hàng",
                error_code: "FORBIDDEN",
            });
        }

        let { status, keyword } = req.query || {};
        if (typeof keyword === "string") keyword = keyword.trim();

        const params = [req.user.franchise_store_id];
        let whereClause = `WHERE o.franchise_store_id = $1`;

        if (keyword) {
            params.push(`%${keyword}%`);
            whereClause += ` AND o.order_code ILIKE $${params.length}`;
        }

        const validStatus = ["pending", "approved", "processing", "fulfilled", "cancelled"];
        if (!validStatus.includes(status)) status = null;

        if (status) {
            params.push(status);
            whereClause += ` AND o.status = $${params.length}`;
        }

        const rs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        o.desired_date,
        o.note,
        o.delivered_at,
        COUNT(oi.order_item_id) AS total_items,
        COALESCE(STRING_AGG(p.name, ', ' ORDER BY p.name), '') AS product_names
      FROM orders o
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      LEFT JOIN product p ON p.product_id = oi.product_id
      ${whereClause}
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
      `,
            params
        );

        return res.json({ success: true, data: rs.rows, message: null });
    } catch (e) {
        console.error("GET ORDERS ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { createOrder, getOrders };
>>>>>>> 2908730f5ccfd86b38feed9a459e69bdf9821e49
