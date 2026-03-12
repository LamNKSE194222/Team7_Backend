const pool = require("../config/database");

async function getManagerStorage(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["manager", "admin"];

        if (!allowed.includes(role)) {
            return res.status(403).json({ success: false, data: null, message: "Forbidden" });
        }

        // Lấy tất cả tồn kho của tất cả franchise stores
        const rs = await pool.query(
            `
            SELECT
                fii.inventory_item_id,
                fs.franchise_store_id,
                fs.name AS store_name,
                p.product_id,
                p.sku AS product_code,
                p.name AS product_name,
                pt.name AS category_name,
                ((COALESCE(fii.on_hand_qty,0) - COALESCE(fii.reserved_qty,0))::int) AS quantity,
                fii.on_hand_qty,
                fii.reserved_qty,
                fii.expiry_date,
                fii.last_updated_at
            FROM franchise_inventory inv
            JOIN franchise_inventory_item fii ON fii.inventory_id = inv.inventory_id
            JOIN franchise_store fs ON fs.franchise_store_id = inv.franchise_store_id
            JOIN product p ON p.product_id = fii.product_id
            JOIN product_type pt ON pt.product_type_id = p.product_type_id
            ORDER BY fs.name ASC, p.sku ASC
            `
        );

        return res.json({ success: true, data: rs.rows, message: null });
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

module.exports = { getManagerStorage };
