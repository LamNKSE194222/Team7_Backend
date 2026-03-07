const pool = require("../config/database");

function parsePaging(req) {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 50);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function parseOrderId(req, res) {
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
        res.status(400).json({
            success: false,
            data: null,
            message: "orderId không hợp lệ",
        });
        return null;
    }
    return orderId;
}

// GET /api/central-kitchen/new-orders?page&limit
async function listNewOrders(req, res) {
    try {
        const { page, limit, offset } = parsePaging(req);
        const centralKitchenId = req.user.central_kitchen_id;

        const countRs = await pool.query(
            `
            SELECT COUNT(*)::int AS total
            FROM orders o
            WHERE o.status = 'pending'
              AND o.central_kitchen_id = $1
            `,
            [centralKitchenId]
        );

        const ordersRs = await pool.query(
            `
            SELECT
              o.order_id,
              o.order_code,
              o.status,
              o.desired_date,
              o.created_at,
              fs.name AS store_name
            FROM orders o
            JOIN franchise_store fs 
              ON fs.franchise_store_id = o.franchise_store_id
            WHERE o.status = 'pending'
              AND o.central_kitchen_id = $1
            ORDER BY o.created_at DESC
            LIMIT $2 OFFSET $3
            `,
            [centralKitchenId, limit, offset]
        );

        const orderIds = ordersRs.rows.map(r => r.order_id);
        const previewMap = new Map();

        if (orderIds.length) {
            const itemsRs = await pool.query(
                `
                SELECT
                  oi.order_id,
                  p.name AS product_name,
                  oi.qty,
                  p.uom
                FROM order_item oi
                JOIN product p 
                  ON p.product_id = oi.product_id
                WHERE oi.order_id = ANY($1)
                ORDER BY oi.order_id, oi.order_item_id ASC
                `,
                [orderIds]
            );

            for (const row of itemsRs.rows) {
                if (!previewMap.has(row.order_id)) previewMap.set(row.order_id, []);

                if (previewMap.get(row.order_id).length < 5) {
                    previewMap.get(row.order_id).push({
                        product_name: row.product_name,
                        qty: Number(row.qty),
                        uom: row.uom,
                    });
                }
            }
        }

        const orders = ordersRs.rows.map(o => ({
            order_id: o.order_id,
            order_code: o.order_code,
            store_name: o.store_name,
            status: o.status,
            desired_date: o.desired_date,
            created_at: o.created_at,
            items_preview: previewMap.get(o.order_id) || [],
        }));

        return res.json({
            success: true,
            data: {
                page,
                limit,
                total: countRs.rows[0].total,
                orders,
            },
            message: null,
        });
    } catch (e) {
        console.error("CK listNewOrders error:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
        });
    }
}

// GET /api/central-kitchen/new-orders/:orderId
async function getNewOrderDetail(req, res) {
    try {
        const orderId = parseOrderId(req, res);
        if (!orderId) return;

        const centralKitchenId = req.user.central_kitchen_id;

        const orderRs = await pool.query(
            `
            SELECT
              o.order_id,
              o.order_code,
              o.status,
              o.desired_date,
              o.created_at,
              fs.name AS store_name
            FROM orders o
            JOIN franchise_store fs 
              ON fs.franchise_store_id = o.franchise_store_id
            WHERE o.order_id = $1
              AND o.central_kitchen_id = $2
            `,
            [orderId, centralKitchenId]
        );

        if (!orderRs.rows.length) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy đơn hàng",
                error_code: "NOT_FOUND",
            });
        }

        const itemsRs = await pool.query(
            `
            SELECT
              oi.order_item_id,
              p.name AS product_name,
              oi.qty,
              p.uom,
              oi.unit_price
            FROM order_item oi
            JOIN product p 
              ON p.product_id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY oi.order_item_id ASC
            `,
            [orderId]
        );

        return res.json({
            success: true,
            data: {
                order: orderRs.rows[0],
                items: itemsRs.rows.map(x => ({
                    order_item_id: x.order_item_id,
                    product_name: x.product_name,
                    qty: Number(x.qty),
                    uom: x.uom,
                    unit_price: Number(x.unit_price || 0),
                    line_total: Number(x.qty) * Number(x.unit_price || 0),
                })),
            },
            message: null,
        });
    } catch (e) {
        console.error("CK getNewOrderDetail error:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
        });
    }
}

// POST /api/central-kitchen/new-orders/:orderId/accept
async function acceptNewOrder(req, res) {
    const client = await pool.connect();

    try {
        const orderId = parseOrderId(req, res);
        if (!orderId) return;

        const centralKitchenId = req.user.central_kitchen_id;

        await client.query("BEGIN");

        const upRs = await client.query(
            `
            UPDATE orders
            SET status = 'approved'
            WHERE order_id = $1
              AND central_kitchen_id = $2
              AND status = 'pending'
            RETURNING order_id, order_code, status
            `,
            [orderId, centralKitchenId]
        );

        if (!upRs.rows.length) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                data: null,
                message:
                    "Đơn không còn ở trạng thái chờ xử lý hoặc không thuộc bếp trung tâm của bạn",
                error_code: "ORDER_STATUS_CONFLICT",
            });
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: upRs.rows[0],
            message: "Đã chấp nhận đơn",
        });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CK acceptNewOrder error:", e);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
        });
    } finally {
        client.release();
    }
}

// POST /api/central-kitchen/new-orders/:orderId/reject
async function rejectNewOrder(req, res) {
    const client = await pool.connect();

    try {
        const orderId = parseOrderId(req, res);
        if (!orderId) return;

        const centralKitchenId = req.user.central_kitchen_id;
        const { reason } = req.body || {};

        if (!reason || String(reason).trim().length < 3) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "reason là bắt buộc (>= 3 ký tự)",
                error_code: "VALIDATION_ERROR",
            });
        }

        console.warn(
            `[NEW_ORDER_REJECT] kitchen_user=${req.user.user_id} ck=${centralKitchenId} orderId=${orderId} reason="${String(
                reason
            ).trim()}"`
        );

        await client.query("BEGIN");

        const upRs = await client.query(
            `
            UPDATE orders
            SET status = 'cancelled'
            WHERE order_id = $1
              AND central_kitchen_id = $2
              AND status = 'pending'
            RETURNING order_id, order_code, status
            `,
            [orderId, centralKitchenId]
        );

        if (!upRs.rows.length) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                data: null,
                message:
                    "Đơn không còn ở trạng thái chờ xử lý hoặc không thuộc bếp trung tâm của bạn",
                error_code: "ORDER_STATUS_CONFLICT",
            });
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: upRs.rows[0],
            message: "Đã từ chối đơn",
        });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CK rejectNewOrder error:", e);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
        });
    } finally {
        client.release();
    }
}

module.exports = {
    listNewOrders,
    getNewOrderDetail,
    acceptNewOrder,
    rejectNewOrder,
};