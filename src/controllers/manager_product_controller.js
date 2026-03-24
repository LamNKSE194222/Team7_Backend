const pool = require("../config/database");

async function generateUniqueProductSku(client) {
    const rs = await client.query(`
        SELECT COALESCE(MAX(product_id), 0) + 1 AS next_id
        FROM product
    `);

    const nextId = Number(rs.rows[0].next_id);
    return `SKU-${String(nextId).padStart(6, "0")}`;
}

async function createProduct(req, res) {
    let client;

    try {

        if (!req.user.central_kitchen_id) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Manager phải được gán central_kitchen_id"
            });
        }

        const {
            product_type_id,
            name,
            uom,
            price,
            description,
            materials = []
        } = req.body || {};

        // Bỏ sku khỏi validate vì sku sẽ tự sinh
        if (!product_type_id || !name || !uom || price == null) {
            return res.status(400).json({
                success: false,
                message: "product_type_id, name, uom, price là bắt buộc"
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        // Tự động tạo SKU
        const sku = await generateUniqueProductSku(client);

        const productResult = await client.query(
            `
            INSERT INTO product (
                product_type_id, name, uom, sku, price, description, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING *;
            `,
            [product_type_id, name, uom, sku, price, description || null]
        );

        const product = productResult.rows[0];

        if (materials.length > 0) {
            for (const item of materials) {
                const {
                    material_id,
                    qty_required,
                    uom: material_uom,
                    note
                } = item;

                if (!material_id || !qty_required || qty_required <= 0 || !material_uom) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({
                        success: false,
                        message: "material_id, qty_required, uom của nguyên liệu là bắt buộc và phải hợp lệ"
                    });
                }

                await client.query(
                    `
                    INSERT INTO product_material (
                        product_id, material_id, qty_required, uom, note
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    `,
                    [
                        product.product_id,
                        material_id,
                        qty_required,
                        material_uom,
                        note || null
                    ]
                );
            }
        }

        await client.query("COMMIT");

        // Thêm sản phẩm vào kho central kitchen của manager
        if (req.user && req.user.central_kitchen_id) {
            await client.query(
                `
                INSERT INTO central_kitchen_product_inventory_item (
                    central_kitchen_id, product_id, on_hand_qty, min_qty, expiry_date, last_updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                `,
                [req.user.central_kitchen_id, product.product_id, 0, 0, null]
            );
        }

        return res.status(201).json({
            success: true,
            message: "Tạo sản phẩm thành công",
            data: product
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("ROLLBACK ERROR:", rollbackError);
            }
        }

        console.error("CREATE PRODUCT ERROR:", {
            message: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint
        });

        return res.status(500).json({
            success: false,
            message: error.message || "Lỗi server khi tạo sản phẩm"
        });
    } finally {
        if (client) client.release();
    }
}

async function getProducts(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT 
        p.product_id,
        p.product_type_id,
        pt.name AS product_type_name,
        p.name,
        p.uom,
        p.sku,
        p.price,
        p.description,
        p.is_active
      FROM product p
      JOIN product_type pt ON pt.product_type_id = p.product_type_id
      ORDER BY p.product_id DESC
      `
        );

        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("GET PRODUCTS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách sản phẩm"
        });
    }
}

async function getProductById(req, res) {
    try {
        const { id } = req.params;

        const productResult = await pool.query(
            `
      SELECT 
        p.product_id,
        p.product_type_id,
        pt.name AS product_type_name,
        p.name,
        p.uom,
        p.sku,
        p.price,
        p.description,
        p.is_active
      FROM product p
      JOIN product_type pt ON pt.product_type_id = p.product_type_id
      WHERE p.product_id = $1
      `,
            [id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        const materialsResult = await pool.query(
            `
      SELECT
        pm.product_material_id,
        pm.material_id,
        m.material_code,
        m.name AS material_name,
        pm.qty_required,
        pm.uom,
        pm.note
      FROM product_material pm
      JOIN material m ON m.material_id = pm.material_id
      WHERE pm.product_id = $1
      ORDER BY pm.product_material_id
      `,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                ...productResult.rows[0],
                materials: materialsResult.rows
            }
        });
    } catch (error) {
        console.error("GET PRODUCT BY ID ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy chi tiết sản phẩm"
        });
    }
}

async function updateProduct(req, res) {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const {
            product_type_id,
            name,
            uom,
            price,
            description,
            is_active,
            materials = [],
            expiry_date,
            on_hand_qty,
            min_qty
        } = req.body || {};

        await client.query("BEGIN");

        const updateResult = await client.query(
            `
      UPDATE product
      SET
        product_type_id = $1,
        name = $2,
        uom = $3,
        price = $4,
        description = $5,
        is_active = $6
      WHERE product_id = $7
      RETURNING *
      `,
            [product_type_id, name, uom, price, description || null, is_active, id]
        );

        if (updateResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm để cập nhật"
            });
        }

        await client.query(
            `DELETE FROM product_material WHERE product_id = $1`,
            [id]
        );

        for (const item of materials) {
            const { material_id, qty_required, uom: material_uom, note } = item;

            if (!material_id || !qty_required || qty_required <= 0 || !material_uom) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Dữ liệu nguyên liệu không hợp lệ"
                });
            }

            await client.query(
                `
        INSERT INTO product_material (
          product_id, material_id, qty_required, uom, note
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
                [id, material_id, qty_required, material_uom, note || null]
            );
        }

        await client.query("COMMIT");

        // Cập nhật kho central kitchen nếu có thay đổi
        if (req.user && req.user.central_kitchen_id && (expiry_date !== undefined || on_hand_qty !== undefined || min_qty !== undefined)) {
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (expiry_date !== undefined) {
                updateFields.push(`expiry_date = $${paramIndex++}`);
                updateValues.push(expiry_date);
            }
            if (on_hand_qty !== undefined) {
                updateFields.push(`on_hand_qty = $${paramIndex++}`);
                updateValues.push(on_hand_qty);
            }
            if (min_qty !== undefined) {
                updateFields.push(`min_qty = $${paramIndex++}`);
                updateValues.push(min_qty);
            }
            updateFields.push(`last_updated_at = NOW()`);

            updateValues.push(req.user.central_kitchen_id, id);

            await client.query(
                `
                UPDATE central_kitchen_product_inventory_item
                SET ${updateFields.join(', ')}
                WHERE central_kitchen_id = $${paramIndex++} AND product_id = $${paramIndex}
                `,
                updateValues
            );
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật sản phẩm thành công",
            data: updateResult.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("UPDATE PRODUCT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi cập nhật sản phẩm"
        });
    } finally {
        client.release();
    }
}

async function deleteProduct(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
      UPDATE product
      SET is_active = FALSE
      WHERE product_id = $1
      RETURNING *
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm để xóa"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ẩn sản phẩm thành công",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("DELETE PRODUCT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi xóa sản phẩm"
        });
    }
}

async function restoreProduct(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
      UPDATE product
      SET is_active = TRUE
      WHERE product_id = $1
      RETURNING *
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Khôi phục sản phẩm thành công",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("RESTORE PRODUCT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi khôi phục sản phẩm"
        });
    }
}

module.exports = { createProduct, getProducts, getProductById, updateProduct, deleteProduct, restoreProduct };