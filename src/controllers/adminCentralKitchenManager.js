const pool = require('../config/database');

async function getAllCentralKitchens(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                status AS kitchen_status,
                address AS kitchen_address,
                phone_number AS kitchen_phone,
                email AS kitchen_email,
                production_capacity AS capacity,
                staff_count AS staff_count
            FROM central_kitchen
            ORDER BY kitchen_name ASC;
            `
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (err) {
        console.error('getAllCentralKitchens error:', err);
        return res.status(500).json({
            success: false,
            data: null,
            message: 'Server/DB error',
            error_code: 'SERVER_ERROR'
        });
    }
}


module.exports = { getAllCentralKitchens };
