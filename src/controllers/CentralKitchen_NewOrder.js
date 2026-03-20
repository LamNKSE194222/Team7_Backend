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

async function deductInventoryForOrder(client, centralKitchenId, orderId) {
    const orderItemsRs = await client.query(
        `
        SELECT
            oi.product_id,
            p.name AS product_name,
            p.uom,
            SUM(oi.qty)::numeric AS required_qty
        FROM order_item oi
        JOIN product p
          ON p.product_id = oi.product_id
        WHERE oi.order_id = $1
        GROUP BY oi.product_id, p.name, p.uom
        ORDER BY oi.product_id
        `,
        [orderId]
    );

    if (!orderItemsRs.rows.length) {
        throw new ApiError(
            400,
            "Đơn hàng không có sản phẩm để trừ kho",
            "ORDER_HAS_NO_ITEMS"
        );
    }

    const productIds = orderItemsRs.rows.map(r => Number(r.product_id));

    const inventoryRs = await client.query(
        `
        SELECT
            inventory_item_id,
            product_id,
            on_hand_qty,
            min_qty,
            expiry_date
        FROM central_kitchen_product_inventory_item
        WHERE central_kitchen_id = $1
          AND product_id = ANY($2::int[])
          AND on_hand_qty > 0
        ORDER BY product_id ASC, expiry_date ASC NULLS LAST, inventory_item_id ASC
        FOR UPDATE
        `,
        [centralKitchenId, productIds]
    );

    const lotsByProduct = new Map();

    for (const row of inventoryRs.rows) {
        const productId = Number(row.product_id);
        if (!lotsByProduct.has(productId)) lotsByProduct.set(productId, []);
        lotsByProduct.get(productId).push({
            inventory_item_id: Number(row.inventory_item_id),
            on_hand_qty: Number(row.on_hand_qty),
            min_qty: Number(row.min_qty || 0),
            expiry_date: row.expiry_date,
        });
    }

    // Kiểm tra đủ tồn kho trước khi trừ
    const shortages = [];

    for (const item of orderItemsRs.rows) {
        const productId = Number(item.product_id);
        const requiredQty = Number(item.required_qty);
        const lots = lotsByProduct.get(productId) || [];
        const availableQty = lots.reduce((sum, lot) => sum + Number(lot.on_hand_qty), 0);

        if (availableQty < requiredQty) {
            shortages.push({
                product_id: productId,
                product_name: item.product_name,
                required_qty: requiredQty,
                available_qty: availableQty,
                missing_qty: requiredQty - availableQty,
                uom: item.uom,
            });
        }
    }

    if (shortages.length) {
        throw new ApiError(
            409,
            "Không đủ tồn kho để chấp nhận đơn",
            "INSUFFICIENT_STOCK",
            { shortages }
        );
    }

    // Bắt đầu trừ kho
    const deductedItems = [];

    for (const item of orderItemsRs.rows) {
        const productId = Number(item.product_id);
        let remaining = Number(item.required_qty);
        const lots = lotsByProduct.get(productId) || [];

        for (const lot of lots) {
            if (remaining <= 0) break;
            if (lot.on_hand_qty <= 0) continue;

            const deductQty = Math.min(lot.on_hand_qty, remaining);

            await client.query(
                `
                UPDATE central_kitchen_product_inventory_item
                SET on_hand_qty = on_hand_qty - $1,
                    last_updated_at = NOW()
                WHERE inventory_item_id = $2
                `,
                [deductQty, lot.inventory_item_id]
            );

            lot.on_hand_qty -= deductQty;
            remaining -= deductQty;
        }

        deductedItems.push({
            product_id: productId,
            product_name: item.product_name,
            deducted_qty: Number(item.required_qty),
            uom: item.uom,
        });
    }

    return deductedItems;
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
            SELECT order_id, order_code, status
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

        if (orderRs.rows[0].status !== "pending") {
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
            SET status = 'processing'
            WHERE order_id = $1
            RETURNING order_id, order_code, status
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: {
                ...upRs.rows[0],
                deducted_items: deductedItems,
            },
            message: "Đã chấp nhận đơn ",
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

async function rejectNewOrder(req, res) {
    const client = await pool.connect();

    try {
        const orderId = parseOrderId(req, res);
        if (orderId === null) return;

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

        const orderRs = await client.query(
            `
            SELECT order_id, order_code, status
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

        if (orderRs.rows[0].status !== "pending") {
            throw new ApiError(
                409,
                "Đơn không còn ở trạng thái chờ xử lý",
                "ORDER_STATUS_CONFLICT"
            );
        }

        const upRs = await client.query(
            `
            UPDATE orders
            SET status = 'cancelled'
            WHERE order_id = $1
            RETURNING order_id, order_code, status
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: upRs.rows[0],
            message: "Đã từ chối đơn",
        });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("CK rejectNewOrder error:", e);

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

module.exports = { listNewOrders, getNewOrderDetail, acceptNewOrder, rejectNewOrder, };