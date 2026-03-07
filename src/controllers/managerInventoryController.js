const pool = require("../config/database");

async function getOverview(req, res) {
    try {
        // Nếu manager có central_kitchen_id trong JWT thì dùng.
        // Nếu chưa có, tạm fallback = 1 để test.
        const centralKitchenId = req.user?.central_kitchen_id || 1;

        // Cards summary
        const cardsSql = `
            SELECT
                COUNT(*)::int AS total_products,
                COUNT(*) FILTER (
                    WHERE i.on_hand_qty < COALESCE(i.min_qty, 0)
                )::int AS low_stock,
                COUNT(*) FILTER (
                    WHERE p.cake_style = 'banh_nuong'
                )::int AS banh_nuong,
                COUNT(*) FILTER (
                    WHERE p.cake_style = 'banh_deo'
                )::int AS banh_deo
            FROM central_kitchen_product_inventory_item i
            JOIN product p
                ON p.product_id = i.product_id
            WHERE i.central_kitchen_id = $1
              AND COALESCE(p.is_active, true) = true
        `;

        // Detail table
        const itemsSql = `
            SELECT
                i.inventory_item_id,
                p.product_id,
                p.name AS product_name,
                COALESCE(pt.name, 'Chưa phân loại') AS product_type_name,
                p.cake_style,
                CASE
                    WHEN p.cake_style = 'banh_nuong' THEN 'Bánh Nướng'
                    WHEN p.cake_style = 'banh_deo' THEN 'Bánh Dẻo'
                    ELSE 'Chưa xác định'
                END AS cake_style_label,
                p.uom,
                p.sku,
                i.on_hand_qty,
                i.min_qty,
                i.expiry_date,
                i.last_updated_at,
                CASE
                    WHEN i.on_hand_qty < COALESCE(i.min_qty, 0) THEN 'Thấp'
                    WHEN i.on_hand_qty <= COALESCE(i.min_qty, 0) * 1.5 THEN 'Trung Bình'
                    ELSE 'Đủ'
                END AS stock_status
            FROM central_kitchen_product_inventory_item i
            JOIN product p
                ON p.product_id = i.product_id
            LEFT JOIN product_type pt
                ON pt.product_type_id = p.product_type_id
            WHERE i.central_kitchen_id = $1
              AND COALESCE(p.is_active, true) = true
            ORDER BY p.product_id ASC
        `;

        const [cardsRs, itemsRs] = await Promise.all([
            pool.query(cardsSql, [centralKitchenId]),
            pool.query(itemsSql, [centralKitchenId]),
        ]);

        return res.json({
            success: true,
            data: {
                cards: cardsRs.rows[0],
                items: itemsRs.rows,
            },
            message: null,
        });
    } catch (err) {
        console.error("managerInventoryController.getOverview error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}

module.exports = { getOverview };