const pool = require("../config/database");
async function getCentralKitchenMaterialsInventory(req, res) {
    try {
        const role = req.user?.role;
        const allowed = ["kitchen_staff"];
        if (!allowed.includes(role)) {
            return res.status(403).json({ success: false, data: null, message: "Forbidden" });
        }

        const kitchenId = req.user?.central_kitchen_id;
        if (!kitchenId) {
            return res.status(403).json({ success: false, data: null, message: "Not kitchen staff" });
        }

        const expiryDays = Number(req.query.expiry_days ?? 60);
        const limit = Number(req.query.limit ?? 50);
        const expiringLimit = Number(req.query.expiring_limit ?? 8);
        const includeExpired = String(req.query.include_expired ?? "true") === "true";

        // 1) BOX: nguyên liệu sắp hết hạn (top N)
        // Lưu ý: expiry_date là DATE, tính days_left bằng (expiry_date - CURRENT_DATE)
        const expiringSql = `
      SELECT
        m.material_id,
        m.name AS material_name,
        m.uom,
        ckii.on_hand_qty,
        ckii.expiry_date,
        (ckii.expiry_date - CURRENT_DATE) AS days_left,
        cki.inventory_code,
        ckii.last_updated_at
      FROM central_kitchen_inventory_item ckii
      JOIN central_kitchen_inventory cki ON cki.inventory_id = ckii.inventory_id
      JOIN material m ON m.material_id = ckii.material_id
      WHERE cki.central_kitchen_id = $1
        AND ckii.expiry_date IS NOT NULL
        AND ckii.expiry_date <= CURRENT_DATE + ($2::int)
        ${includeExpired ? "" : "AND ckii.expiry_date >= CURRENT_DATE"}
      ORDER BY ckii.expiry_date ASC
      LIMIT $3
    `;

        const expiringRs = await pool.query(expiringSql, [kitchenId, expiryDays, expiringLimit]);

        // 2) BẢNG: danh sách tồn kho nguyên liệu (có thể có / không có expiry_date)
        // Sắp xếp: ưu tiên item có expiry_date gần nhất lên trước, còn null xuống cuối
        const inventorySql = `
      SELECT
        ckii.inventory_item_id,
        m.material_id,
        m.name AS material_name,
        m.uom,
        ckii.on_hand_qty,
        ckii.expiry_date,
        CASE 
          WHEN ckii.expiry_date IS NULL THEN NULL
          ELSE (ckii.expiry_date - CURRENT_DATE)
        END AS days_left,
        cki.inventory_code,
        ckii.last_updated_at
      FROM central_kitchen_inventory_item ckii
      JOIN central_kitchen_inventory cki ON cki.inventory_id = ckii.inventory_id
      JOIN material m ON m.material_id = ckii.material_id
      WHERE cki.central_kitchen_id = $1
      ORDER BY
        (ckii.expiry_date IS NULL) ASC,   -- false (có date) lên trước, true (null) xuống sau
        ckii.expiry_date ASC NULLS LAST,
        m.name ASC
      LIMIT $2
    `;

        const inventoryRs = await pool.query(inventorySql, [kitchenId, limit]);

        return res.json({
            success: true,
            data: {
                expiry_days: expiryDays,
                expiring_count: expiringRs.rowCount,
                expiring_materials: expiringRs.rows,  // box "Sắp hết hạn"
                inventory_items: inventoryRs.rows,    // bảng "Danh sách tồn kho"
            },
            message: null,
        });
    } catch (e) {
        console.error("CENTRAL_KITCHEN MATERIALS INVENTORY ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "Inventory error" });
    }
}

module.exports = { getCentralKitchenMaterialsInventory };