const pool = require("../config/database");

async function Mdashboard(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["manager", "admin"];

        if (!allowed.includes(role)) {
            return res.status(403).json({ success: false, data: null, message: "Forbidden" });
        }

        // 1) Đếm theo status của các đơn đã xác nhận nhận bên franchise store trong tháng này (received_confirmed_at)
        const statusRs = await pool.query(`
            SELECT COUNT(*)::int AS total_orders
FROM orders
WHERE status = 'confirmed'
AND received_confirmed_at >= date_trunc('month', CURRENT_DATE)
AND received_confirmed_at < date_trunc('month', CURRENT_DATE) + interval '1 month';
        `);

        // 2) Cảnh báo tồn kho 
        // Lấy những item có available = on_hand - reserved <= threshold
        const threshold = Number(req.query.threshold || 5);

        const lowStockRs = await pool.query(
            `
SELECT
    m.material_id,
    m.name AS material_name,
    ckii.on_hand_qty,
    m.uom,
    mt.name AS material_type,
    ckii.expiry_date
FROM central_kitchen_inventory_item ckii
JOIN material m ON m.material_id = ckii.material_id
JOIN materials_type mt ON mt.materials_type_id = m.materials_type_id
WHERE ckii.on_hand_qty <= $1
ORDER BY ckii.on_hand_qty ASC
LIMIT 10
`,
            [threshold]
        );

        const lowStockCount = lowStockRs.rows.length;

        // 3) Tổng tồn kho của tất cả sản phẩm trong hệ thống (từ central_kitchen_product_inventory_item)
        const productStockRs = await pool.query(`
    SELECT COALESCE(SUM(on_hand_qty),0)::int AS total_product_stock
    FROM central_kitchen_product_inventory_item
`);

        // 4) Tổng tồn kho nguyên liệu của tất cả sản phẩm trong hệ thống (từ central_kitchen_inventory_item)
        const materialStockRs = await pool.query(`
    SELECT COALESCE(SUM(on_hand_qty),0)::int AS total_material_stock
    FROM central_kitchen_inventory_item
`);

        const cards = {
            total_orders_month: statusRs.rows[0]?.total_orders || 0,
            low_stock_alerts: lowStockCount,
            total_product_stock: productStockRs.rows[0].total_product_stock,
            total_material_stock: materialStockRs.rows[0].total_material_stock
        };

        // 5) Inventory of materials (20 nguyên liệu sắp hết hạn)
        const materialsInventoryRs = await pool.query(`
    SELECT
        ckii.inventory_item_id,
        m.material_id,
        m.name AS material_name,
        m.cost_price,
        m.min_stock,
        ckii.on_hand_qty,
        ckii.expiry_date,
        m.uom,
        mt.name AS material_type,
        CASE
            WHEN m.is_active = true AND mt.is_active = true THEN 'active'
            ELSE 'inactive'
        END AS status
    FROM central_kitchen_inventory_item ckii
    JOIN material m ON m.material_id = ckii.material_id
    JOIN materials_type mt ON mt.materials_type_id = m.materials_type_id
    ORDER BY ckii.expiry_date ASC
    LIMIT 20
`);

        return res.json({
            success: true,
            data: {
                cards,
                materials_inventory: materialsInventoryRs.rows,
                low_stock_alerts: lowStockRs.rows,
                threshold,
            },
            message: null,
        });

    } catch (e) {
        console.error("MANAGER DASHBOARD ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Dashboard error" });
    }
}

module.exports = { Mdashboard };
