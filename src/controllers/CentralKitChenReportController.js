const pool = require("../config/database");

/**
 * Cards mapping theo DB order_status:
 * pending | approved | processing | fulfilled | cancelled
 */
function buildCards(rows) {
    const cards = {
        pending: 0,
        approved: 0,
        processing: 0,
        fulfilled: 0,
        cancelled: 0,
    };

    for (const r of rows) {
        const status = String(r.status || "").toLowerCase();
        if (cards[status] !== undefined) cards[status] = Number(r.count || 0);
    }
    return cards;
}

// GET /api/centralKitchen/report/dashboard
async function dashboardReport(req, res) {
    try {
        const centralKitchenId = req.user?.central_kitchen_id;
        if (!centralKitchenId) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Chỉ kitchen staff mới được xem report",
                error_code: "FORBIDDEN",
            });
        }

        const pendingLimit = Number(req.query.pending_limit || 5);
        const lowStockThreshold = Number(req.query.threshold || 5);
        const lowStockLimit = Number(req.query.low_stock_limit || 5);

        // 1) Cards
        const cardsRs = await pool.query(
            `
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE central_kitchen_id = $1
      GROUP BY status
      `,
            [centralKitchenId]
        );
        const cards = buildCards(cardsRs.rows);

        // 2) Pending orders list (sum qty)
        const pendingRs = await pool.query(
            `
      SELECT
        o.order_id,
        o.order_code,
        o.status,
        o.created_at,
        o.desired_date,
        fs.name AS store_name,
        COALESCE(SUM(oi.qty), 0)::numeric(12,3) AS total_qty,
        COUNT(oi.order_item_id)::int AS product_count
      FROM orders o
      JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
      LEFT JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.central_kitchen_id = $1
        AND o.status = 'pending'
      GROUP BY o.order_id, o.order_code, o.status, o.created_at, o.desired_date, fs.name
      ORDER BY o.created_at DESC
      LIMIT $2
      `,
            [centralKitchenId, pendingLimit]
        );

        // 3) Low stock alerts (chỉ franchise inventory vì DB không có kho central kitchen)
        const lowStockRs = await pool.query(
            `
      SELECT
        fs.franchise_store_id,
        fs.name AS store_name,
        p.product_id,
        p.name AS product_name,
        fii.on_hand_qty,
        fii.reserved_qty,
        (fii.on_hand_qty - fii.reserved_qty) AS available_qty,
        fii.last_updated_at
      FROM franchise_inventory_item fii
      JOIN franchise_inventory fi ON fi.inventory_id = fii.inventory_id
      JOIN franchise_store fs ON fs.franchise_store_id = fi.franchise_store_id
      JOIN product p ON p.product_id = fii.product_id
      WHERE (fii.on_hand_qty - fii.reserved_qty) <= $1
      ORDER BY available_qty ASC, fii.last_updated_at DESC
      LIMIT $2
      `,
            [lowStockThreshold, lowStockLimit]
        );

        return res.json({
            success: true,
            data: {
                cards,
                pending_orders: pendingRs.rows.map((x) => ({
                    order_id: String(x.order_id),
                    order_code: x.order_code,
                    status: x.status,
                    created_at: x.created_at,
                    desired_date: x.desired_date,
                    store_name: x.store_name,
                    total_qty: String(x.total_qty),
                    product_count: x.product_count,
                })),
                low_stock_alerts: lowStockRs.rows.map((x) => ({
                    franchise_store_id: String(x.franchise_store_id),
                    store_name: x.store_name,
                    product_id: String(x.product_id),
                    product_name: x.product_name,
                    on_hand_qty: String(x.on_hand_qty),
                    reserved_qty: String(x.reserved_qty),
                    available_qty: String(x.available_qty),
                    last_updated_at: x.last_updated_at,
                })),
                threshold: lowStockThreshold,
            },
            message: null,
        });
    } catch (e) {
        console.error("CK REPORT DASHBOARD ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

// GET /api/centralKitchen/report/summary?from=...&to=...
async function summaryReport(req, res) {
    try {
        const centralKitchenId = req.user?.central_kitchen_id;
        if (!centralKitchenId) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Chỉ kitchen staff mới được xem report",
                error_code: "FORBIDDEN",
            });
        }

        const from = req.query.from;
        const to = req.query.to;
        if (!from || !to) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "from và to là bắt buộc (ISO date-time)",
                error_code: "VALIDATION_ERROR",
            });
        }

        // Revenue + delivered count + ontime + avg lead time (dựa delivered_at)
        const kpiRs = await pool.query(
            `
      SELECT
        COALESCE(SUM(oi.qty * oi.unit_price), 0)::numeric(14,2) AS revenue,
        COUNT(DISTINCT o.order_id)::int AS delivered_orders,
        COUNT(DISTINCT o.order_id) FILTER (WHERE o.delivered_at <= o.desired_date)::int AS on_time_orders,
        AVG(o.delivered_at - o.created_at) AS avg_lead_time
      FROM orders o
      JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.central_kitchen_id = $1
        AND o.status = 'fulfilled'
        AND o.delivered_at >= $2
        AND o.delivered_at <  $3
      `,
            [centralKitchenId, from, to]
        );

        // Status breakdown (dựa created_at)
        const statusRs = await pool.query(
            `
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE central_kitchen_id = $1
        AND created_at >= $2
        AND created_at <  $3
      GROUP BY status
      `,
            [centralKitchenId, from, to]
        );

        const kpi = kpiRs.rows[0] || {};
        const deliveredOrders = Number(kpi.delivered_orders || 0);
        const onTimeOrders = Number(kpi.on_time_orders || 0);

        return res.json({
            success: true,
            data: {
                range: { from, to },
                kpi: {
                    revenue: String(kpi.revenue || 0),
                    delivered_orders: deliveredOrders,
                    on_time_orders: onTimeOrders,
                    on_time_rate: deliveredOrders === 0 ? 0 : onTimeOrders / deliveredOrders,
                    avg_lead_time: kpi.avg_lead_time, // interval
                },
                status_breakdown: buildCards(statusRs.rows),
            },
            message: null,
        });
    } catch (e) {
        console.error("CK REPORT SUMMARY ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { dashboardReport, summaryReport };
