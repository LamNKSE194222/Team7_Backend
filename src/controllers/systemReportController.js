const pool = require("../config/database");

async function systemReport(req, res) {
    try {
        const role = req.user?.role;
        if (role !== 'admin') {
            return res.status(403).json({ success: false, data: null, message: 'Forbidden' });
        }

        const usersRs = await pool.query(`
            SELECT
              COUNT(*)::int AS total_users,
              COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_users,
              COUNT(CASE WHEN status <> 'active' THEN 1 END)::int AS inactive_users
            FROM "user";
        `);

        const storeRs = await pool.query(`
            SELECT
              COUNT(*)::int AS total_franchise_stores,
              COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_franchise_stores,
              COUNT(CASE WHEN status <> 'active' THEN 1 END)::int AS inactive_franchise_stores
            FROM franchise_store;
        `);

        const ordersStatusRs = await pool.query(`
            SELECT status, COUNT(*)::int AS count
            FROM orders
            GROUP BY status;
        `);

        const totalOrdersRs = await pool.query(`
            SELECT COUNT(*)::int AS total_orders
            FROM orders;
        `);

        const totalStockRs = await pool.query(`
            SELECT COALESCE(SUM(on_hand_qty),0)::int AS total_stock
            FROM central_kitchen_product_inventory_item;
        `);

        const financeRs = await pool.query(`
            SELECT
              COALESCE(SUM(oi.qty * oi.unit_price),0)::bigint AS total_order_value,
              COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.qty * oi.unit_price ELSE 0 END),0)::bigint AS paid_amount,
              COALESCE(SUM(CASE WHEN o.payment_status <> 'paid' THEN oi.qty * oi.unit_price ELSE 0 END),0)::bigint AS unpaid_amount
            FROM orders o
            LEFT JOIN order_item oi ON oi.order_id = o.order_id;
        `);

        const reportByStoreRs = await pool.query(`
            SELECT
                fs.franchise_store_id,
                fs.name AS store_name,
                COALESCE(COUNT(DISTINCT o.order_id), 0)::int AS total_orders,
                COALESCE(SUM(oi.qty * oi.unit_price), 0)::bigint AS total_value,
                COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.qty * oi.unit_price ELSE 0 END), 0)::bigint AS paid_amount,
                COALESCE(SUM(CASE WHEN o.payment_status <> 'paid' THEN oi.qty * oi.unit_price ELSE 0 END), 0)::bigint AS unpaid_amount
            FROM franchise_store fs
            LEFT JOIN orders o ON o.franchise_store_id = fs.franchise_store_id
            LEFT JOIN order_item oi ON oi.order_id = o.order_id
            GROUP BY fs.franchise_store_id, fs.name
            ORDER BY total_orders DESC
            LIMIT 10;
        `);

        const rolesRs = await pool.query(`
            SELECT
              CASE
                WHEN m.user_id IS NOT NULL AND m.is_admin = TRUE THEN 'admin'
                WHEN m.user_id IS NOT NULL AND COALESCE(m.is_admin, FALSE) = FALSE THEN 'manager'
                WHEN fs.user_id IS NOT NULL THEN 'franchise_staff'
                WHEN ks.user_id IS NOT NULL THEN 'kitchen_staff'
                ELSE 'user'
              END AS role,
              COUNT(*)::int AS total,
              SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END)::int AS active,
              SUM(CASE WHEN u.status <> 'active' THEN 1 ELSE 0 END)::int AS inactive
            FROM "user" u
            LEFT JOIN manager m ON m.user_id = u.user_id
            LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
            LEFT JOIN kitchen_staff ks ON ks.user_id = u.user_id
            GROUP BY 1;
        `);

        const orderStatusMap = {
            pending: 0,
            approved: 0,
            processing: 0,
            fulfilled: 0,
            confirmed: 0,
            cancelled: 0
        };
        for (const row of ordersStatusRs.rows) {
            orderStatusMap[row.status] = Number(row.count);
        }

        const finance = financeRs.rows[0] || { total_order_value: 0, paid_amount: 0, unpaid_amount: 0 };
        const collection_rate = finance.total_order_value > 0
          ? Number((finance.paid_amount / finance.total_order_value * 100).toFixed(2))
          : 0;

        return res.json({
            success: true,
            data: {
                summary_cards: {
                    users: {
                        active: usersRs.rows[0].active_users,
                        total: usersRs.rows[0].total_users
                    },
                    franchise_stores: {
                        active: storeRs.rows[0].active_franchise_stores,
                        total: storeRs.rows[0].total_franchise_stores
                    },
                    total_orders: totalOrdersRs.rows[0].total_orders,
                    total_stock: totalStockRs.rows[0].total_stock
                },
                financial: {
                    paid_amount: Number(finance.paid_amount),
                    unpaid_amount: Number(finance.unpaid_amount),
                    total_order_value: Number(finance.total_order_value),
                    collection_rate
                },
                order_status: orderStatusMap,
                store_report: reportByStoreRs.rows,
                role_distribution: rolesRs.rows
            },
            message: null
        });

    } catch (e) {
        console.error('SYSTEM REPORT ERROR:', e);
        return res.status(500).json({ success: false, data: null, message: 'Server/DB error' });
    }
}

module.exports = { systemReport };
