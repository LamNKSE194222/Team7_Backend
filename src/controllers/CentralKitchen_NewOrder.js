const pool = require("../config/database");

class ApiError extends Error {
    constructor(status, message, errorCode, data = null) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.data = data;
    }
}

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
              o.note,
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
            note: o.note,
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

async function getNewOrderDetail(req, res) {
    try {
        const orderId = parseOrderId(req, res);
        if (orderId === null) return;

        const centralKitchenId = req.user.central_kitchen_id;

        const orderRs = await pool.query(
            `
            SELECT
              o.order_id,
              o.order_code,
              o.status,
              o.desired_date,
              o.created_at, 
              o.note,
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
              oi.product_id,
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
                    product_id: x.product_id,
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

async function acceptNewOrder(req, res) {
    const client = await pool.connect();

    try {
        const orderId = parseOrderId(req, res);
        if (orderId === null) return;

        const centralKitchenId = req.user.central_kitchen_id;

        await client.query("BEGIN");

        // Lock order trước để tránh accept cùng lúc
        const orderRs = await client.query(
            `
            SELECT order_id, order_code, status, franchise_store_id
            FROM orders
            WHERE order_id = $1
              AND central_kitchen_id = $2
            FOR UPDATE
            `,
            [orderId, centralKitchenId]
        );

        if (!orderRs.rows.length) {
            throw new ApiError(
                404,
                "Không tìm thấy đơn hàng hoặc đơn không thuộc bếp trung tâm của bạn",
                "NOT_FOUND"
            );
        }

        const order = orderRs.rows[0];

        if (order.status !== "pending") {
            throw new ApiError(
                409,
                "Đơn không còn ở trạng thái chờ xử lý",
                "ORDER_STATUS_CONFLICT"
            );
        }

        // Trừ kho trước
        const deductedItems = await deductInventoryForOrder(
            client,
            centralKitchenId,
            orderId
        );

        // Sau đó mới chuyển trạng thái đơn
        const upRs = await client.query(
            `
            UPDATE orders
            SET 
                status = 'processing',
                approved_at = NOW(),
                processing_started_at = NOW()
            WHERE order_id = $1
            RETURNING order_id, order_code, status, franchise_store_id
            `,
            [orderId]
        );

        const updatedOrder = upRs.rows[0];

        // Tìm user thuộc franchise store để gửi notification
        const staffRs = await client.query(
            `
            SELECT fs.user_id
            FROM franchise_staff fs
            JOIN "user" u ON u.user_id = fs.user_id
            WHERE fs.franchise_store_id = $1
              AND fs.status = 'active'
              AND u.status = 'active'
            `,
            [order.franchise_store_id]
        );

        const title = "Đơn hàng đã được chấp nhận";
        const message = `Đơn hàng ${updatedOrder.order_code} đã được bếp trung tâm chấp nhận và đang được xử lý`;

        const notifications = [];

        for (const staff of staffRs.rows) {
            const notiRs = await client.query(
                `
                INSERT INTO notification (
                    user_id,
                    type,
                    title,
                    message,
                    status,
                    channel,
                    priority,
                    created_at,
                    read_at,
                    order_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, $8)
                RETURNING *
                `,
                [
                    staff.user_id,
                    "ORDER_ACCEPTED",
                    title,
                    message,
                    "unread",
                    "in_app",
                    "normal",
                    orderId
                ]
            );

            notifications.push(notiRs.rows[0]);
        }

        await client.query("COMMIT");

        // REALTIME
        const io = req.app.get("io");

        for (const notification of notifications) {
            io.to(`user_${notification.user_id}`).emit("notification:new", {
                notification_id: notification.notification_id,
                user_id: notification.user_id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                status: notification.status,
                channel: notification.channel,
                priority: notification.priority,
                created_at: notification.created_at,
                read_at: notification.read_at,
                order_id: notification.order_id
            });
        }

        return res.json({
            success: true,
            data: {
                ...updatedOrder,
                deducted_items: deductedItems,
            },
            message: "Đã chấp nhận đơn và gửi thông báo cho franchise store",
        });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CK acceptNewOrder error:", e);

        if (e instanceof ApiError) {
            return res.status(e.status).json({
                success: false,
                data: e.data,
                message: e.message,
                error_code: e.errorCode,
            });
        }

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
        });
    } finally {
        client.release();
    }
}

module.exports = { listNewOrders, getNewOrderDetail, acceptNewOrder };