const pool = require("../config/database");

async function getMaterialById(req, res) {
    try {
        res.set("Cache-Control", "no-store"); // 🔥 QUAN TRỌNG
        const { id } = req.params;

        const rs = await pool.query(`
            SELECT
                ckii.inventory_item_id,
                m.material_id,
                m.name,
                m.material_code,
                m.uom,
                mt.name AS material_type,
                m.cost_price,
                m.min_stock,
                ckii.on_hand_qty,
                ckii.expiry_date,
                m.is_active
            FROM material m
            LEFT JOIN materials_type mt
                ON mt.materials_type_id = m.materials_type_id
            LEFT JOIN central_kitchen_inventory_item ckii
                ON ckii.material_id = m.material_id
            WHERE ckii.inventory_item_id = $1
            LIMIT 1
        `, [id]);

        return res.json({
            success: true,
            data: rs.rows[0] || null   // 🔥 QUAN TRỌNG
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

async function createMaterial(req, res) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const {
            name,
            material_code,
            uom,
            materials_type_id,
            cost_price,
            min_stock,
            on_hand_qty,
            expiry_date,
            central_kitchen_id,
        } = req.body;

        // 1. Insert material
        const materialRs = await client.query(`
            INSERT INTO material (name, material_code, uom, materials_type_id, cost_price, min_stock)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, material_code, uom, materials_type_id, cost_price, min_stock]);

        const material = materialRs.rows[0];

        // 2. Lấy inventory_id từ central_kitchen
        const inventoryRs = await client.query(`
            SELECT inventory_id
            FROM central_kitchen_inventory
            WHERE central_kitchen_id = $1
        `, [central_kitchen_id]);

        if (inventoryRs.rows.length === 0) {
            throw new Error("Central kitchen inventory not found");
        }

        const inventory_id = inventoryRs.rows[0].inventory_id;

        // 3. Insert inventory item
        await client.query(`
            INSERT INTO central_kitchen_inventory_item
            (inventory_id, material_id, on_hand_qty, expiry_date)
            VALUES ($1, $2, $3, $4)
        `, [inventory_id, material.material_id, on_hand_qty, expiry_date]);

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: material
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        client.release();
    }
}

async function updateMaterial(req, res) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { id } = req.params;

        const {
            name,
            material_code,
            uom,
            materials_type_id,
            cost_price,
            min_stock,
            on_hand_qty,
            expiry_date,
            is_active,
            central_kitchen_id
        } = req.body;

        // 0. Tìm material_id từ inventory_item_id
        const materialIdRs = await client.query(`
            SELECT material_id FROM central_kitchen_inventory_item
            WHERE inventory_item_id = $1
        `, [id]);

        if (materialIdRs.rows.length === 0) {
            throw new Error("Không tìm thấy nguyên liệu trong kho");
        }
        const material_id = materialIdRs.rows[0].material_id;

        // 1. update material
        await client.query(`
            UPDATE material
            SET name = $1,
                uom = $2,
                material_code = $3,
                materials_type_id = $4,
                cost_price = $5,
                min_stock = $6,
                is_active = $7
            WHERE material_id = $8
        `, [name, uom, material_code, materials_type_id, cost_price, min_stock, is_active, material_id]);

        // 2. update inventory item
        await client.query(`
            UPDATE central_kitchen_inventory_item
            SET on_hand_qty = $1,
                expiry_date = $2
            WHERE inventory_item_id = $3
        `, [on_hand_qty, expiry_date, id]);

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Updated successfully"
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        client.release();
    }
}

async function deleteMaterial(req, res) {
    try {
        const { id } = req.params;

        await pool.query(`
            UPDATE material
            SET is_active = false
            WHERE material_id = (
                SELECT material_id FROM central_kitchen_inventory_item
                WHERE inventory_item_id = $1
            )
        `, [id]);

        return res.json({ success: true, message: "Deleted" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Delete failed" });
    }
}

async function getMaterialTypes(req, res) {
    try {
        const rs = await pool.query(`
            SELECT materials_type_id, name
            FROM materials_type
            WHERE is_active = true
            ORDER BY name ASC
        `);
        return res.json({ success: true, data: rs.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

async function getCentralKitchens(req, res) {
    try {
        const rs = await pool.query(`
            SELECT central_kitchen_id, name
            FROM central_kitchen
            WHERE status = 'active'
            ORDER BY name ASC
        `);
        return res.json({ success: true, data: rs.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

async function getAllMaterials(req, res) {
    try {
        const rs = await pool.query(`
            SELECT material_id, name AS material_name, material_code, uom
            FROM material
            WHERE is_active = true
            ORDER BY name ASC
        `);
        return res.json({ success: true, data: rs.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = {
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    getMaterialTypes,
    getCentralKitchens,
    getAllMaterials
};
