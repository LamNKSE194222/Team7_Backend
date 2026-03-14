const pool = require("../config/database");

async function getManagerStorage(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                ckpii.inventory_item_id,
                ck.central_kitchen_id,
                ck.name AS central_kitchen_name,
                p.product_id,
                p.sku AS product_code,
                p.name AS product_name,
                pt.name AS category_name,
                ckpii.on_hand_qty AS quantity,
                ckpii.on_hand_qty,
                ckpii.min_qty,
                ckpii.expiry_date,
                ckpii.last_updated_at
            FROM central_kitchen_product_inventory_item ckpii
            JOIN central_kitchen ck
                ON ck.central_kitchen_id = ckpii.central_kitchen_id
            JOIN product p
                ON p.product_id = ckpii.product_id
            JOIN product_type pt
                ON pt.product_type_id = p.product_type_id
            ORDER BY ck.name ASC, p.sku ASC
            `
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (err) {
        console.error("getManagerStorage error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function getManagerStorage_material(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                ckii.inventory_item_id,
                ck.central_kitchen_id,
                ck.name AS central_kitchen_name,
                m.material_id,
                m.material_code,
                m.name AS material_name,
                mt.name AS category_name,
                COALESCE(ckii.on_hand_qty, 0)::int AS quantity,
                ckii.on_hand_qty,
                ckii.last_updated_at
            FROM central_kitchen_inventory_item ckii
            JOIN central_kitchen_inventory cki
                ON cki.inventory_id = ckii.inventory_id
            JOIN central_kitchen ck
                ON ck.central_kitchen_id = cki.central_kitchen_id
            JOIN material m
                ON m.material_id = ckii.material_id
            LEFT JOIN materials_type mt
                ON mt.materials_type_id = m.materials_type_id
            ORDER BY ck.name ASC, m.material_code ASC
            `
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (err) {
        console.error("getManagerStorage_material error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}


module.exports = { getManagerStorage, getManagerStorage_material };