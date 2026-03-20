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
                address AS store_address,        
                phone AS store_phone,            
                email AS store_email,            
                manager_name            
            FROM franchise_store
            ORDER BY store_name ASC;
            `
        );

        return res.json({
            success: true,
            data: rs.rows, // Trả về danh sách cửa hàng từ cơ sở dữ liệu
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
    const { store_code, store_name, store_address, store_phone, store_email, manager_name } = req.body;

    try {
        // Kiểm tra xem cửa hàng có tồn tại không
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

        // Kiểm tra nếu có thay đổi và nếu store_code không trùng với store_code của cửa hàng khác
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

        // Tiến hành cập nhật nếu không có lỗi trùng lặp
        const result = await pool.query(
            `
            UPDATE franchise_store
            SET 
                store_code = $1,
                name = $2,
                address = $3,
                phone = $4,
                email = $5,
                manager_name = $6
            WHERE franchise_store_id = $7
            RETURNING *;
            `,
            [store_code, store_name, store_address, store_phone, store_email, manager_name, store_id]
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


module.exports = { getAllFranchiseStores, updateFranchiseStore, updateStatus };