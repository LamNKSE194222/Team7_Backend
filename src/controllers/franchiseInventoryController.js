const pool = require("../config/database");

// GET /api/franchise/inventory/storage
async function getStorage(req, res) {
    try {
        const franchiseStoreId = req.user.franchise_store_id;

        const rs = await pool.query(
            `
            SELECT
                p.product_id,
                p.name AS product_name,
                pt.name AS product_type_name,
                fii.on_hand_qty AS quantity,
                ckii.expiry_date
            FROM franchise_inventory inv
            JOIN franchise_inventory_item fii
                ON fii.inventory_id = inv.inventory_id
            JOIN product p
                ON p.product_id = fii.product_id
            LEFT JOIN product_type pt
                ON pt.product_type_id = p.product_type_id
            LEFT JOIN central_kitchen_product_inventory_item ckii
                ON ckii.product_id = p.product_id
            WHERE inv.franchise_store_id = $1
            ORDER BY pt.name ASC NULLS LAST, p.name ASC
            `,
            [franchiseStoreId]
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (err) {
        console.error("getStorage error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

module.exports = { getStorage };