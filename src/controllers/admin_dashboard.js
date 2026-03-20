const pool = require("../config/database");

async function getAdmminDashboardStats(req, res) {
    try {
        const userStatsRs = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active_users
            FROM "user"
            `
        );

        const productStatsRs = await pool.query(
            `
            SELECT COUNT(*)::int AS total_products
            FROM product
            `
        );

        const storeStatsRs = await pool.query(
            `
            SELECT COUNT(*)::int AS total_stores
            FROM franchise_store
            `
        );

        const kitchenStatsRs = await pool.query(
            `
            SELECT COUNT(*)::int AS total_central_kitchens
            FROM central_kitchen
            `
        );

        const userListRs = await pool.query(
            `
            SELECT
                u.user_id,
                u.username,
                u.email,
                u.status,
                COALESCE(m.is_admin, false) AS is_admin,
                fs.franchise_store_id,
                ks.central_kitchen_id,
                u.created_at,
                u.last_login_at
            FROM "user" u
            LEFT JOIN manager m ON m.user_id = u.user_id
            LEFT JOIN franchise_staff fs ON fs.user_id = u.user_id
            LEFT JOIN kitchen_staff ks ON ks.user_id = u.user_id
            ORDER BY u.user_id DESC
            LIMIT 20
            `
        );

        const userStats = userStatsRs.rows[0] || { total_users: 0, active_users: 0 };
        const productStats = productStatsRs.rows[0] || { total_products: 0 };
        const storeStats = storeStatsRs.rows[0] || { total_stores: 0 };
        const kitchenStats = kitchenStatsRs.rows[0] || { total_central_kitchens: 0 };

        return res.json({
            success: true,
            data: {
                users: {
                    active: userStats.active_users,
                    total: userStats.total_users,
                    list: userListRs.rows.map((row) => ({
                        user_id: row.user_id,
                        username: row.username,
                        email: row.email,
                        status: row.status,
                        role: row.is_admin ? "admin" : row.franchise_store_id ? "franchise_staff" : row.central_kitchen_id ? "kitchen_staff" : "user",
                        franchise_store_id: row.franchise_store_id,
                        central_kitchen_id: row.central_kitchen_id,
                        created_at: row.created_at,
                        last_login_at: row.last_login_at,
                    })),
                },
                contents: {
                    products: productStats.total_products,
                    stores: storeStats.total_stores,
                    central_kitchens: kitchenStats.total_central_kitchens,
                },
            },
            message: null,
        });
    } catch (error) {
        console.error("ADMIN DASHBOARD ERROR:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi lấy dữ liệu dashboard admin",
        });
    }
}

module.exports = { getAdmminDashboardStats };
