const pool = require("../config/database");

async function createOrder(req, res) {
    const client = await pool.connect();
    try {
        const { desired_date, note, items } = req.body || {};

        // ===== Validate =====
        if (!desired_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "desired_date và items là bắt buộc",
                error_code: "VALIDATION_ERROR",
            });
        }

        // chỉ franchise staff mới tạo đơn
        if (!req.user.franchise_store_id) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Chỉ franchise staff mới được tạo đơn",
                error_code: "FORBIDDEN",
            });
        }

        await client.query("BEGIN");

        // ===== Create order =====
        const orderCode = "ORD-" + Date.now();

        const orderRs = await client.query(
            `
            INSERT INTO orders (
                order_code,
                franchise_store_id,
                created_by_staff_id,
                status,
                desired_date
                note
            )
            VALUES ($1, $2, $3, 'pending', $4)
            RETURNING order_id
            `,
            [
                orderCode,
                req.user.franchise_store_id,
                req.user.user_id,
                desired_date,
                note ?? null
            ]
        );

        const orderId = orderRs.rows[0].order_id;

        // ===== Insert items =====
        for (const item of items) {
            if (!item.product_id || !item.qty || item.qty <= 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: "product_id và qty không hợp lệ",
                    error_code: "VALIDATION_ERROR",
                });
            }

            await client.query(
                `
                INSERT INTO order_item (order_id, product_id, qty, unit_price)
                SELECT $1, $2, $3, price
                FROM product
                WHERE product_id = $2
                `,
                [orderId, item.product_id, item.qty]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            data: {
                order_id: orderId,
                order_code: orderCode,
                status: "pending",
            },
            message: "Tạo đơn hàng thành công",
        });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CREATE ORDER ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    } finally {
        client.release();
    }
}
//view order
async function getOrders(req, res) {
    try {
        if (!req.user.franchise_store_id) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Không có quyền xem đơn hàng",
                error_code: "FORBIDDEN",
            });
        }

        let { status, keyword } = req.query || {};
        //loc theo order_code
        if (typeof keyword === "string") {
            keyword = keyword.trim();
        }

        const params = [req.user.franchise_store_id];
        let whereClause = `WHERE o.franchise_store_id = $1`;

        if (keyword) {
            params.push(`%${keyword}%`);
            whereClause += ` AND o.order_code ILIKE $${params.length}`;
        }

        //loc theo status
        const validStatus = ["pending", "approved", "processing", "fulfilled", "cancelled"];
        if (!validStatus.includes(status)) {
            status = null;
        }

        if (status) {
            params.push(status);
            whereClause += ` AND o.status = $${params.length}`;
        }

        if (keyword) {
            params.push(`%${keyword}%`);
            whereClause += ` AND o.order_code ILIKE $${params.length}`;
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
                STRING_AGG(p.name, ', ') AS product_names
            FROM orders o
            LEFT JOIN order_item oi ON oi.order_id = o.order_id
            LEFT JOIN product p ON p.product_id = oi.product_id
            ${whereClause}
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
            `,
            params
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null,
        });
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
