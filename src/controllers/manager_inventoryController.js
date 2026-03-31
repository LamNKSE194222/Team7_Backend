const pool = require("../config/database");

async function getManagerStorage(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["manager", "admin"];

        if (!allowed.includes(role)) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Forbidden"
            });
        }

        const statsRs = await pool.query(`
            SELECT
                COUNT(*)::int AS total_products,

                COUNT(*) FILTER (
                    WHERE ckpii.on_hand_qty < ckpii.min_qty
                )::int AS low_stock,

                COUNT(*) FILTER (
                    WHERE LOWER(pt.name) = 'bánh nướng'
                )::int AS baked_mooncake,

                COUNT(*) FILTER (
                    WHERE LOWER(pt.name) = 'bánh dẻo'
                )::int AS sticky_mooncake

            FROM central_kitchen_product_inventory_item ckpii

            JOIN central_kitchen ck
                ON ck.central_kitchen_id = ckpii.central_kitchen_id

            JOIN product p
                ON p.product_id = ckpii.product_id

            LEFT JOIN product_type pt
                ON pt.product_type_id = p.product_type_id

            WHERE
                ck.status = 'active'
                AND p.is_active = true
        `);

        const inventoryRs = await pool.query(`
            SELECT
                ckpii.inventory_item_id,
                ck.central_kitchen_id,
                ck.name AS central_kitchen_name,

                p.product_id,
                p.name AS product_name,
                p.uom,
                p.price,
                p.description,

                ckpii.on_hand_qty,
                ckpii.min_qty,
                ckpii.expiry_date

            FROM central_kitchen_product_inventory_item ckpii

            JOIN central_kitchen ck
                ON ck.central_kitchen_id = ckpii.central_kitchen_id

            JOIN product p
                ON p.product_id = ckpii.product_id

            WHERE
                ck.status = 'active'
                AND p.is_active = true

            ORDER BY
                ck.name ASC,
                p.name ASC
        `);

        return res.json({
            success: true,
            data: { cards: statsRs.rows[0], inventory: inventoryRs.rows },
            message: null
        });

    } catch (err) {
        console.error("getManagerStorage error:", err);

        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR"
        });
    }
}

module.exports = { getManagerStorage };