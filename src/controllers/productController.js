const pool = require("../config/database");

async function list(req, res) {
    try {
        const rs = await pool.query(`
      SELECT 
        p.product_id AS id,
        p.name,
        p.uom,
        p.sku,
        p.price,
        p.description
      FROM product p
      WHERE p.is_active = TRUE
      ORDER BY p.product_id DESC
    `);

        return res.json({ success: true, data: rs.rows, message: null });
    } catch (e) {
        console.error("PRODUCT LIST ERROR:", e);
        return res.status(500).json({ success: false, data: null, message: "DB error" });
    }
}

module.exports = { list };
