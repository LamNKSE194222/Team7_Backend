const pool = require("../config/database");

async function getCentralKitchenProductInventory(req, res) {
    try {
        const kitchenId = req.user.central_kitchen_id;
        const rs = await pool.query(
            `
            SELECT
                ckpii.inventory_item_id,
                ckpii.central_kitchen_id,
                ckpii.product_id,
                p.sku,
                p.name AS product_name,
                p.uom,
                p.price,
                pt.name AS product_type_name,
                ckpii.on_hand_qty,
                ckpii.min_qty,
                ckpii.expiry_date,
                ckpii.last_updated_at
            FROM central_kitchen_product_inventory_item ckpii
            JOIN product p
                ON p.product_id = ckpii.product_id
            LEFT JOIN product_type pt
                ON pt.product_type_id = p.product_type_id
            WHERE ckpii.central_kitchen_id = $1
            ORDER BY ckpii.last_updated_at DESC, ckpii.inventory_item_id DESC
            `,
            [kitchenId]
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (e) {
        console.error("CENTRAL_KITCHEN PRODUCT INVENTORY ERROR:", e);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Load product inventory error"
        });
    }
}

module.exports = { getCentralKitchenProductInventory };