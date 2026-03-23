const pool = require('../config/database');

async function getAllFranchiseStores(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                franchise_store_id,
                store_code,
                name AS store_name,
                status AS store_status,
                address AS store_address
            FROM franchise_store
            ORDER BY store_name ASC;
            `
        );

        return res.json({
            success: true,
            data: rs.rows,
            message: null
        });
    } catch (err) {
        console.error("getAllFranchiseStores error:", err);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function updateFranchiseStore(req, res) {
    const store_id = req.params.store_id;
    const { store_code, store_name, store_address } = req.body;

    try {
        const currentStore = await pool.query(
            `SELECT * FROM franchise_store WHERE franchise_store_id = $1`,
            [store_id]
        );

        if (currentStore.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cửa hàng không tồn tại",
            });
        }

        if (currentStore.rows[0].store_code !== store_code) {
            const existingStore = await pool.query(
                `SELECT * FROM franchise_store WHERE store_code = $1`,
                [store_code]
            );

            if (existingStore.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Mã cửa hàng này đã tồn tại",
                });
            }
        }

        const result = await pool.query(
            `
            UPDATE franchise_store
            SET 
                store_code = $1,
                name = $2,
                address = $3
            WHERE franchise_store_id = $4
            RETURNING franchise_store_id, store_code, name, address, status;
            `,
            [store_code, store_name, store_address, store_id]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: "Cập nhật cửa hàng thành công",
        });
    } catch (err) {
        console.error("Error updating franchise store:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật thông tin cửa hàng",
            error_code: "SERVER_ERROR",
        });
    }
}

async function updateStatus(req, res) {
    const store_id = req.params.store_id;
    const { status } = req.body;

    try {
        // Lấy trạng thái hiện tại của cửa hàng
        const currentStore = await pool.query(
            `SELECT status FROM franchise_store WHERE franchise_store_id = $1`,
            [store_id]
        );

        if (currentStore.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cửa hàng không tồn tại",
            });
        }

        // Cập nhật trạng thái cửa hàng
        const result = await pool.query(
            `
            UPDATE franchise_store
            SET status = $1  -- Thay store_status thành status
            WHERE franchise_store_id = $2
            RETURNING *;
            `,
            [status, store_id]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: `Cập nhật trạng thái cửa hàng thành công.`,
        });
    } catch (err) {
        console.error("Error updating store status:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật trạng thái cửa hàng",
            error_code: "SERVER_ERROR",
        });
    }
}

async function createFranchiseStore(req, res) {
    const { store_code, store_name, store_address } = req.body;

    try {
        // Kiểm tra các trường bắt buộc
        if (!store_code || !store_name || !store_address) {
            return res.status(400).json({
                success: false,
                message: "store_code, store_name và store_address là bắt buộc",
            });
        }

        // Kiểm tra store_code đã tồn tại chưa
        const existingStore = await pool.query(
            `SELECT * FROM franchise_store WHERE store_code = $1`,
            [store_code]
        );

        if (existingStore.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Mã cửa hàng này đã tồn tại",
            });
        }

        // Thêm cửa hàng mới
        const result = await pool.query(
            `
            INSERT INTO franchise_store (store_code, name, address, status)
            VALUES ($1, $2, $3, 'active')
            RETURNING franchise_store_id, store_code, name, address, status, created_at;
            `,
            [store_code, store_name, store_address]
        );

        return res.json({
            success: true,
            data: result.rows[0],
            message: "Tạo cửa hàng thành công",
        });
    } catch (err) {
        console.error("Error creating franchise store:", err);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi tạo cửa hàng",
            error_code: "SERVER_ERROR",
        });
    }
}


module.exports = { getAllFranchiseStores, updateFranchiseStore, updateStatus, createFranchiseStore };