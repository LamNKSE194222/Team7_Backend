const pool = require("../config/database");

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
                production_capacity AS capacity
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
        if (!kitchen_id || isNaN(kitchen_id) || Number(kitchen_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_id không hợp lệ'
            });
        }

        const rs = await pool.query(
            `
            SELECT
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                status AS kitchen_status,
                address AS kitchen_address,
                production_capacity AS production_capacity
            FROM central_kitchen
            WHERE central_kitchen_id = $1
            `,
            [kitchen_id]
        );

        if (rs.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bếp trung tâm không tồn tại'
            });
        }

        return res.json({
            success: true,
            data: rs.rows[0],
            message: null
        });
    } catch (err) {
        console.error('getCentralKitchenById error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server/DB error',
            error_code: 'SERVER_ERROR'
        });
    }
}

async function updateCentralKitchen(req, res) {
    const kitchen_id = req.params.kitchen_id;
    const { kitchen_code, kitchen_name, kitchen_address, production_capacity } = req.body;

    try {
        if (!kitchen_id || isNaN(kitchen_id) || Number(kitchen_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_id không hợp lệ'
            });
        }

        if (
            !kitchen_code ||
            !kitchen_name ||
            !kitchen_address ||
            production_capacity == null
        ) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code, kitchen_name, kitchen_address và production_capacity là bắt buộc'
            });
        }

        if (typeof kitchen_code !== 'string' || !kitchen_code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code không hợp lệ'
            });
        }

        if (typeof kitchen_name !== 'string' || !kitchen_name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_name không hợp lệ'
            });
        }

        if (typeof kitchen_address !== 'string' || !kitchen_address.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_address không hợp lệ'
            });
        }

        if (isNaN(production_capacity) || Number(production_capacity) < 0) {
            return res.status(400).json({
                success: false,
                message: 'production_capacity phải là số và không được âm'
            });
        }

        const trimmedKitchenCode = kitchen_code.trim();
        const trimmedKitchenName = kitchen_name.trim();
        const trimmedKitchenAddress = kitchen_address.trim();

        if (!/^[A-Za-z0-9]+$/.test(trimmedKitchenCode)) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code không được chứa ký tự đặc biệt hoặc khoảng trắng'
            });
        }

        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(trimmedKitchenCode)) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code phải chứa cả chữ và số'
            });
        }

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

        if (current.rows[0].kitchen_code !== trimmedKitchenCode) {
            const exist = await pool.query(
                `SELECT * FROM central_kitchen WHERE kitchen_code = $1`,
                [trimmedKitchenCode]
            );

            if (exist.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mã bếp trung tâm đã tồn tại'
                });
            }
        }

        const result = await pool.query(
            `
            UPDATE central_kitchen
            SET
                kitchen_code = $1,
                name = $2,
                address = $3,
                production_capacity = $4
            WHERE central_kitchen_id = $5
            RETURNING
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                status AS kitchen_status,
                address AS kitchen_address,
                production_capacity
            `,
            [trimmedKitchenCode, trimmedKitchenName, trimmedKitchenAddress, Number(production_capacity), kitchen_id]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: 'Cập nhật bếp trung tâm thành công'
        });
    } catch (err) {
        console.error('updateCentralKitchen error:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error_code: 'SERVER_ERROR'
        });
    }
}

async function updateStatus(req, res) {
    const kitchen_id = req.params.kitchen_id;
    const { status } = req.body;

    try {
        if (!kitchen_id || isNaN(kitchen_id) || Number(kitchen_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_id không hợp lệ'
            });
        }

        if (!status || typeof status !== 'string' || !status.trim()) {
            return res.status(400).json({
                success: false,
                message: 'status là bắt buộc'
            });
        }

        const trimmedStatus = status.trim().toLowerCase();

        if (!['active', 'inactive'].includes(trimmedStatus)) {
            return res.status(400).json({
                success: false,
                message: 'status chỉ được là active hoặc inactive'
            });
        }

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

        const result = await pool.query(
            `
            UPDATE central_kitchen
            SET status = $1
            WHERE central_kitchen_id = $2
            RETURNING *;
            `,
            [trimmedStatus, kitchen_id]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: 'Cập nhật trạng thái bếp trung tâm thành công'
        });
    } catch (err) {
        console.error('updateStatus error:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error_code: 'SERVER_ERROR'
        });
    }
}

async function createCentralKitchen(req, res) {
    const {
        kitchen_code,
        kitchen_name,
        kitchen_address,
        production_capacity
    } = req.body;

    try {
        if (
            !kitchen_code ||
            !kitchen_name ||
            !kitchen_address ||
            production_capacity == null
        ) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code, kitchen_name, kitchen_address và production_capacity là bắt buộc'
            });
        }

        if (typeof kitchen_code !== 'string' || !kitchen_code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code không hợp lệ'
            });
        }

        if (typeof kitchen_name !== 'string' || !kitchen_name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_name không hợp lệ'
            });
        }

        if (typeof kitchen_address !== 'string' || !kitchen_address.trim()) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_address không hợp lệ'
            });
        }

        if (isNaN(production_capacity) || Number(production_capacity) < 0) {
            return res.status(400).json({
                success: false,
                message: 'production_capacity phải là số và không được âm'
            });
        }

        const trimmedKitchenCode = kitchen_code.trim();
        const trimmedKitchenName = kitchen_name.trim();
        const trimmedKitchenAddress = kitchen_address.trim();

        if (!/^[A-Za-z0-9]+$/.test(trimmedKitchenCode)) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code không được chứa ký tự đặc biệt hoặc khoảng trắng'
            });
        }

        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(trimmedKitchenCode)) {
            return res.status(400).json({
                success: false,
                message: 'kitchen_code phải chứa cả chữ và số'
            });
        }

        const exist = await pool.query(
            `SELECT * FROM central_kitchen WHERE kitchen_code = $1`,
            [trimmedKitchenCode]
        );

        if (exist.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã bếp trung tâm đã tồn tại'
            });
        }

        const result = await pool.query(
            `
            INSERT INTO central_kitchen (
                kitchen_code,
                name,
                address,
                production_capacity,
                status
            )
            VALUES ($1, $2, $3, $4, 'active')
            RETURNING
                central_kitchen_id,
                kitchen_code,
                name AS kitchen_name,
                address AS kitchen_address,
                status AS kitchen_status,
                production_capacity,
                created_at;
            `,
            [trimmedKitchenCode, trimmedKitchenName, trimmedKitchenAddress, Number(production_capacity)]
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

module.exports = { getAllCentralKitchens, getCentralKitchenById, updateCentralKitchen, updateStatus, createCentralKitchen };