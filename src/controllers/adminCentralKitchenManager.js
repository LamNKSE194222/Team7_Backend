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

async function getCentralKitchenById(req, res) {
    const kitchen_id = req.params.kitchen_id;
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
                production_capacity AS production_capacity,
                staff_count
            FROM central_kitchen
            WHERE central_kitchen_id = $1
            `,
            [kitchen_id]
        );

        if (rs.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Bếp trung tâm không tồn tại' });
        }

        return res.json({ success: true, data: rs.rows[0], message: null });
    } catch (err) {
        console.error('getCentralKitchenById error:', err);
        return res.status(500).json({ success: false, message: 'Server/DB error', error_code: 'SERVER_ERROR' });
    }
}

async function updateCentralKitchen(req, res) {
    const kitchen_id = req.params.kitchen_id;
    const { kitchen_code, kitchen_name, kitchen_address, kitchen_phone, kitchen_email, production_capacity, staff_count } = req.body;

    try {
        const current = await pool.query(
            `SELECT * FROM central_kitchen WHERE central_kitchen_id = $1`,
            [kitchen_id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Bếp trung tâm không tồn tại' });
        }

        if (current.rows[0].kitchen_code !== kitchen_code) {
            const exist = await pool.query(
                `SELECT * FROM central_kitchen WHERE kitchen_code = $1`,
                [kitchen_code]
            );
            if (exist.rows.length > 0) {
                return res.status(400).json({ success: false, message: 'Mã bếp trung tâm đã tồn tại' });
            }
        }

        const result = await pool.query(
            `
            UPDATE central_kitchen
            SET
                kitchen_code = $1,
                name = $2,
                address = $3,
                phone_number = $4,
                email = $5,
                production_capacity = $6,
                staff_count = $7
            WHERE central_kitchen_id = $8
            RETURNING
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                status AS kitchen_status,
                address AS kitchen_address,
                phone_number AS kitchen_phone,
                email AS kitchen_email,
                production_capacity,
                staff_count;
            `,
            [kitchen_code, kitchen_name, kitchen_address, kitchen_phone, kitchen_email, production_capacity, staff_count, kitchen_id]
        );

        return res.json({ success: true, data: result.rows[0], message: 'Cập nhật bếp trung tâm thành công' });
    } catch (err) {
        console.error('updateCentralKitchen error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server', error_code: 'SERVER_ERROR' });
    }
}

async function updateStatus(req, res) {
    const kitchen_id = req.params.kitchen_id;
    const { status } = req.body;

    try {
        const current = await pool.query(
            `SELECT * FROM central_kitchen WHERE central_kitchen_id = $1`,
            [kitchen_id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Bếp trung tâm không tồn tại' });
        }

        const result = await pool.query(
            `
            UPDATE central_kitchen
            SET status = $1
            WHERE central_kitchen_id = $2
            RETURNING *;
            `,
            [status, kitchen_id]
        );

        return res.json({ success: true, data: result.rows[0], message: 'Cập nhật trạng thái bếp trung tâm thành công' });
    } catch (err) {
        console.error('updateStatus error:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server', error_code: 'SERVER_ERROR' });
    }
}

async function createCentralKitchen(req, res) {
    const { kitchen_code, kitchen_name, kitchen_address, kitchen_phone, kitchen_email, production_capacity, staff_count } = req.body;

    try {
        // Kiểm tra các trường bắt buộc
        if (!kitchen_code || !kitchen_name || !kitchen_address) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code, kitchen_name và kitchen_address là bắt buộc'
            });
        }

        // Kiểm tra kitchen_code đã tồn tại chưa
        const exist = await pool.query(
            `SELECT * FROM central_kitchen WHERE kitchen_code = $1`,
            [kitchen_code]
        );

        if (exist.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã bếp trung tâm đã tồn tại'
            });
        }

        // Thêm bếp trung tâm mới
        const result = await pool.query(
            `
            INSERT INTO central_kitchen (kitchen_code, name, address, phone_number, email, production_capacity, staff_count, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            RETURNING
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                status AS kitchen_status,
                address AS kitchen_address,
                phone_number AS kitchen_phone,
                email AS kitchen_email,
                production_capacity,
                staff_count;
            `,
            [kitchen_code, kitchen_name, kitchen_address, kitchen_phone, kitchen_email, production_capacity || 0, staff_count || 0]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: 'Tạo bếp trung tâm thành công'
        });
    } catch (err) {
        console.error('createCentralKitchen error:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error_code: 'SERVER_ERROR'
        });
    }
}

async function deleteCentralKitchen(req, res) {
    const kitchen_id = req.params.kitchen_id;

    try {
        // Kiểm tra bếp trung tâm có tồn tại không
        const current = await pool.query(
            `SELECT * FROM central_kitchen WHERE central_kitchen_id = $1`,
            [kitchen_id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bếp trung tâm không tồn tại'
            });
        }

        // Kiểm tra xem bếp có nhân viên nào không
        const staffCount = await pool.query(
            `SELECT COUNT(*) as count FROM kitchen_staff WHERE central_kitchen_id = $1`,
            [kitchen_id]
        );

        if (parseInt(staffCount.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa bếp trung tâm vì còn nhân viên đang làm việc'
            });
        }

        // Xóa bếp trung tâm
        await pool.query(
            `DELETE FROM central_kitchen WHERE central_kitchen_id = $1`,
            [kitchen_id]
        );

        return res.json({
            success: true,
            data: null,
            message: 'Xóa bếp trung tâm thành công'
        });
    } catch (err) {
        console.error('deleteCentralKitchen error:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error_code: 'SERVER_ERROR'
        });
    }
}

module.exports = { getAllCentralKitchens, getCentralKitchenById, updateCentralKitchen, updateStatus, createCentralKitchen, deleteCentralKitchen };
