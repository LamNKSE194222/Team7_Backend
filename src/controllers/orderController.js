const pool = require('../config/database');
const autoApproveOrder = require("../services/autoApproveOrder");

// CREATE ORDER (Franchise staff)
async function createOrder(req, res) {
    let client;

    try {
        const { desired_date, note, items } = req.body || {};

        if (!desired_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "desired_date và items là bắt buộc"
            });
        }

        if (!req.user?.franchise_store_id) {
            return res.status(403).json({
                success: false,
                message: "Chỉ franchise staff mới được tạo đơn"
            });
        }

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

        const orderCode = "ORD-" + Date.now();

        const productIds = normalizedItems.map(x => x.product_id);

        const productRs = await client.query(
            `
            SELECT product_id, name, price, uom
            FROM product
            WHERE product_id = ANY($1::int[])
              AND is_active = TRUE
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

        let totalAmount = 0;
        let totalProductQty = 0;
        const itemDetails = [];

        for (const it of normalizedItems) {
            const p = productMap.get(it.product_id);

            if (!p) {
                throw new Error(`Product ${it.product_id} not found or inactive`);
            }

            const unitPrice = Number(p.price);
            const qty = Number(it.qty);
            const lineTotal = qty * unitPrice;

            totalAmount += lineTotal;
            totalProductQty += qty;

            itemDetails.push({
                product_id: it.product_id,
                product_name: p.name,
                qty,
                uom: p.uom,
                unit_price: unitPrice,
                line_total: lineTotal
            });
        }

        // KHÔNG lưu total_amount vào bảng orders
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
            VALUES ($1, $2, $3, 2, 3, 'pending', $4, $5)
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

        for (const item of itemDetails) {
            await client.query(
                `
                INSERT INTO order_item
                (order_id, product_id, qty, unit_price, uom)
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    order.order_id,
                    item.product_id,
                    item.qty,
                    item.unit_price,
                    item.uom
                ]
            );
        }

        await client.query("COMMIT");

        await autoApproveOrder(order.order_id);

        const updated = await pool.query(
            `SELECT status, created_at FROM orders WHERE order_id = $1`,
            [order.order_id]
        );

        return res.status(201).json({
            success: true,
            data: {
                order_id: order.order_id,
                order_code: order.order_code,
                status: updated.rows[0].status,
                created_at: updated.rows[0].created_at,
                total_items: itemDetails.length,
                total_product_qty: totalProductQty,
                total_amount: totalAmount,
                items: itemDetails
            },
            message: "Tạo đơn thành công"
        });

    } catch (e) {
        if (client) await client.query("ROLLBACK");

        console.error("CREATE ORDER ERROR:", e);

        return res.status(500).json({
            success: false,
            message: e.message || "Server error"
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
        'unpaid' AS payment_status,
        o.created_at,
        o.desired_date,
        o.fulfilled_at,

        COALESCE(SUM(oi.qty * oi.unit_price), 0)::bigint AS total_amount,
        COUNT(DISTINCT oi.product_id)::int AS total_items,
        COALESCE(SUM(oi.qty), 0)::int AS total_product_qty,

        COALESCE(
            STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name),
            ''
        ) AS product_names
    FROM orders o
    LEFT JOIN order_item oi
        ON oi.order_id = o.order_id
    LEFT JOIN product p
        ON p.product_id = oi.product_id
    WHERE o.franchise_store_id = $1
    GROUP BY
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        o.desired_date,
        o.fulfilled_at
    ORDER BY o.created_at DESC
    `,
            [req.user.franchise_store_id]
        );

        return res.json({
            success: true,
            data: rs.rows
        });

    } catch (e) {
        console.error("GET ORDERS ERROR:", e);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

async function cancelOrder(req, res) {
    const client = await pool.connect();

    try {
        const franchiseStoreId = req.user?.franchise_store_id;
        const { orderId } = req.params;

        if (!franchiseStoreId) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền hủy đơn"
            });
        }

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "orderId không hợp lệ"
            });
        }

        await client.query("BEGIN");

        // Khóa dòng đơn hàng để tránh bị update đồng thời
        const orderRs = await client.query(
            `
            SELECT
                order_id,
                order_code,
                franchise_store_id,
                status
            FROM orders
            WHERE order_id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (orderRs.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng"
            });
        }

        const order = orderRs.rows[0];

        // Kiểm tra đúng cửa hàng
        if (Number(order.franchise_store_id) !== Number(franchiseStoreId)) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền hủy đơn hàng này"
            });
        }

        if (order.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: `Chỉ được xóa đơn khi trạng thái là pending. Hiện tại: ${order.status}`
            });
        }

        await client.query(
            `
            DELETE FROM order_item
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query(
            `
            DELETE FROM orders
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Hủy đơn hàng thành công"
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("CANCEL ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server khi hủy đơn hàng"
        });
    } finally {
        client.release();
    }
}

async function getPaymentOrders(req, res) {
    try {
        if (!req.user?.franchise_store_id) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền xem đơn thanh toán"
            });
        }

        const rs = await pool.query(
            `
            SELECT
                o.order_id,
                o.order_code,
                COALESCE(o.payment_status, 'unpaid') AS payment_status,
                o.paid_at,
                o.created_at,
                COALESCE(SUM(oi.qty * oi.unit_price), 0)::bigint AS total_amount
            FROM orders o
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            WHERE o.franchise_store_id = $1
              AND COALESCE(o.payment_status, 'unpaid') IN ('unpaid', 'paid')
            GROUP BY
                o.order_id,
                o.order_code,
                o.payment_status,
                o.paid_at,
                o.created_at
            ORDER BY o.created_at DESC
            `,
            [req.user.franchise_store_id]
        );

        const waitingPaymentOrders = rs.rows
            .filter(row => row.payment_status === "unpaid")
            .map(row => ({
                order_id: row.order_id,
                order_code: row.order_code,
                amount: Number(row.total_amount),
                status: "unpaid",
                status_label: "Chờ Thanh Toán"
            }));

        const paymentHistory = rs.rows
            .filter(row => row.payment_status === "paid")
            .map(row => ({
                order_id: row.order_id,
                order_code: row.order_code,
                amount: Number(row.total_amount),
                paid_at: row.paid_at,
                status: "paid",
                status_label: "Đã Thanh Toán"
            }));

        return res.json({
            success: true,
            data: {
                waiting_payment_count: waitingPaymentOrders.length,
                paid_count: paymentHistory.length,
                waiting_payment_orders: waitingPaymentOrders,
                payment_history: paymentHistory
            },
            message: null
        });

    } catch (e) {
        console.error("GET PAYMENT ORDERS ERROR:", e);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

module.exports = { createOrder, getOrders, cancelOrder, getPaymentOrders };