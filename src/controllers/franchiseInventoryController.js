const pool = require("../config/database");

// GET /api/franchise/inventory/storage
// Lấy kho theo franchise_inventory_item (không có expiry trong DB => trả null)
async function getStorage(req, res) {
    try {
        const franchiseStoreId = req.user.franchise_store_id;

        const rs = await pool.query(
            `
      SELECT
        fii.inventory_item_id,
        p.product_id,
        p.sku AS product_code,
        p.name AS product_name,
        pt.name AS category_name,
        ((COALESCE(fii.on_hand_qty,0) - COALESCE(fii.reserved_qty,0))::int) AS quantity,
        NULL::date AS expiry_date
      FROM franchise_inventory inv
      JOIN franchise_inventory_item fii ON fii.inventory_id = inv.inventory_id
      JOIN product p ON p.product_id = fii.product_id
      JOIN product_type pt ON pt.product_type_id = p.product_type_id
      WHERE inv.franchise_store_id = $1
      ORDER BY p.sku ASC
      `,
            [franchiseStoreId]
        );

        return res.json({ success: true, data: rs.rows, message: null });
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

// POST /api/franchise/inventory/items/:inventoryItemId/adjust
// Body: { delta: number }  (vd: +10 hoặc -5)
async function adjustItem(req, res) {
    const client = await pool.connect();
    try {
        const franchiseStoreId = req.user.franchise_store_id;
        const staffId = req.user.user_id;

        const inventoryItemId = Number(req.params.inventoryItemId);
        const { delta } = req.body || {};

        if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "inventoryItemId không hợp lệ",
                error_code: "VALIDATION_ERROR",
            });
        }

        if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "delta phải là number và khác 0",
                error_code: "VALIDATION_ERROR",
            });
        }

        await client.query("BEGIN");

        // 1) Lock item và verify thuộc đúng franchise store
        const itemRs = await client.query(
            `
      SELECT
        fii.inventory_item_id,
        fii.inventory_id,
        fii.product_id,
        fii.on_hand_qty
      FROM franchise_inventory_item fii
      JOIN franchise_inventory inv ON inv.inventory_id = fii.inventory_id
      WHERE fii.inventory_item_id = $1
        AND inv.franchise_store_id = $2
      FOR UPDATE
      `,
            [inventoryItemId, franchiseStoreId]
        );

        if (itemRs.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                data: null,
                message: "Inventory item không tồn tại",
                error_code: "NOT_FOUND",
            });
        }

        const item = itemRs.rows[0];
        const oldQty = Number(item.on_hand_qty);
        const newQty = oldQty + delta;

        if (newQty < 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                data: null,
                message: "Không đủ tồn để trừ",
                error_code: "INSUFFICIENT_STOCK",
            });
        }

        // 2) Update on_hand_qty
        await client.query(
            `
      UPDATE franchise_inventory_item
      SET on_hand_qty = $1,
          last_updated_at = NOW()
      WHERE inventory_item_id = $2
      `,
            [newQty, inventoryItemId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: {
                inventory_item_id: inventoryItemId,
                product_id: item.product_id,
                old_qty: oldQty,
                new_qty: newQty,
                adjusted_by_staff_id: staffId,
            },
            message: "Adjusted",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("adjustItem error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Internal server error",
            error_code: "INTERNAL_ERROR",
        });
    } finally {
        client.release();
    }
}

async function seedInventoryItem(req, res) {
    const client = await pool.connect();
    try {
        const franchiseStoreId = req.user.franchise_store_id;
        const { product_id, qty } = req.body;

        await client.query("BEGIN");

        // Lấy inventory_id của store
        const invRs = await client.query(
            `SELECT inventory_id 
       FROM franchise_inventory 
       WHERE franchise_store_id = $1 
       LIMIT 1`,
            [franchiseStoreId]
        );

        if (invRs.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Store chưa có inventory" });
        }

        const inventoryId = invRs.rows[0].inventory_id;

        const rs = await client.query(
            `
      INSERT INTO franchise_inventory_item(inventory_id, product_id, on_hand_qty, reserved_qty)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (inventory_id, product_id)
      DO UPDATE SET
        on_hand_qty = EXCLUDED.on_hand_qty,
        last_updated_at = NOW()
      RETURNING *
      `,
            [inventoryId, product_id, qty]
        );

        await client.query("COMMIT");

        return res.json({ success: true, data: rs.rows[0], message: "Seed thành công" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    } finally {
        client.release();
    }
}

module.exports = { getStorage, adjustItem, seedInventoryItem };