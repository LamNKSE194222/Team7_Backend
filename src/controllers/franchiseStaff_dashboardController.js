const pool = require("../config/database");

async function Fdashboard(req, res) {
    try {
        const storeId = req.user?.franchise_store_id;

        if (!storeId) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền xem dashboard"
            });
        }

        // 1) Thống kê số lượng đơn theo trạng thái
        const statusRs = await pool.query(
            `
            SELECT status, COUNT(*)::int AS count
            FROM orders
            WHERE franchise_store_id = $1
            GROUP BY status
            `,
            [storeId]
        );

        const cards = {
            pending: 0,
            approved: 0,
            processing: 0,
            fulfilled: 0,
            confirmed: 0,
            cancelled: 0
        };

        for (const r of statusRs.rows) {
            cards[r.status] = Number(r.count);
        }

        // 2) Tổng số đơn
        const totalOrdersRs = await pool.query(
            `
            SELECT COUNT(*)::int AS total_orders
            FROM orders
            WHERE franchise_store_id = $1
            `,
            [storeId]
        );

        // 3) Tổng tiền theo trạng thái thanh toán
        // HIỆN TẠI đang tạm coi:
        // - confirmed => paid
        // - còn lại => unpaid
        const paymentSummaryRs = await pool.query(
            `
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN o.payment_status = 'paid' THEN oi.qty * oi.unit_price
                        ELSE 0
                    END
                ), 0)::bigint AS paid_amount,

                COALESCE(SUM(
                    CASE
                        WHEN o.payment_status <> 'paid' THEN oi.qty * oi.unit_price
                        ELSE 0
                    END
                ), 0)::bigint AS unpaid_amount
            FROM orders o
            LEFT JOIN order_item oi
                ON oi.order_id = o.order_id
            WHERE o.franchise_store_id = $1
            `,
            [storeId]
        );

        // 4) Đơn gần đây

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        // Đơn gần đây + số sản phẩm + ngày giao
        const recentRs = await pool.query(
            `
            SELECT
                o.order_id,
                o.order_code,
                o.status,
                o.payment_status,
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
            LIMIT $2 OFFSET $3
            `,
            [storeId, limit, offset]
        );

        return res.json({
            success: true,
            data: {
                summary: {
                    paid_amount: Number(paymentSummaryRs.rows[0]?.paid_amount || 0),
                    unpaid_amount: Number(paymentSummaryRs.rows[0]?.unpaid_amount || 0),
                    total_orders: Number(totalOrdersRs.rows[0]?.total_orders || 0)
                },
                cards,
                recent_orders: recentRs.rows.map(row => ({
                    ...row,
                    total_amount: Number(row.total_amount),
                    total_items: Number(row.total_items),
                    total_product_qty: Number(row.total_product_qty)
                }))
            }
        });

    } catch (e) {
        console.error("FRANCHISE DASHBOARD ERROR:", e);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

module.exports = { Fdashboard };