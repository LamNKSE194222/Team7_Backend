const pool = require('../config/database');

async function getAllFranchiseStores(req, res) {
    try {
        const rs = await pool.query(
            `
            SELECT
                fs.franchise_store_id,
                fs.store_code,
                fs.name AS store_name,
                fs.status AS store_status,
                fs.address AS store_address,
                u.username AS manager_name,
                u.email AS manager_email
            FROM franchise_store fs
            LEFT JOIN franchise_staff fst
                ON fst.franchise_store_id = fs.franchise_store_id
            LEFT JOIN "user" u
                ON u.user_id = fst.user_id
            ORDER BY fs.name ASC;
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
        if (!store_id || isNaN(store_id) || Number(store_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "store_id không hợp lệ",
            });
        }

        if (!store_code || !store_name || !store_address) {
            return res.status(400).json({
                success: false,
                message: "store_code, store_name và store_address là bắt buộc",
            });
        }

        if (typeof store_code !== "string" || !store_code.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_code không hợp lệ",
            });
        }

        if (typeof store_name !== "string" || !store_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_name không hợp lệ",
            });
        }

        if (typeof store_address !== "string" || !store_address.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_address không hợp lệ",
            });
        }

        const trimmedStoreCode = store_code.trim();
        const trimmedStoreName = store_name.trim();
        const trimmedStoreAddress = store_address.trim();

        if (!/^[A-Za-z0-9]+$/.test(trimmedStoreCode)) {
            return res.status(400).json({
                success: false,
                message: "store_code không được chứa ký tự đặc biệt hoặc khoảng trắng",
            });
        }

        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(trimmedStoreCode)) {
            return res.status(400).json({
                success: false,
                message: "store_code phải chứa cả chữ và số",
            });
        }

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

        if (currentStore.rows[0].store_code !== trimmedStoreCode) {
            const existingStore = await pool.query(
                `SELECT * FROM franchise_store WHERE store_code = $1`,
                [trimmedStoreCode]
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
            [trimmedStoreCode, trimmedStoreName, trimmedStoreAddress, store_id]
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

async function getFranchiseStoreById(req, res) {
    const store_id = req.params.store_id;

    try {
        if (!store_id || isNaN(store_id) || Number(store_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "store_id không hợp lệ",
            });
        }

        const rs = await pool.query(
            `
            SELECT
                fs.franchise_store_id,
                fs.store_code,
                fs.name AS store_name,
                fs.status AS store_status,
                fs.address AS store_address,
                u.user_id AS manager_user_id,
                u.username AS manager_name,
                u.email AS manager_email
            FROM franchise_store fs
            LEFT JOIN franchise_staff fst
                ON fst.franchise_store_id = fs.franchise_store_id
            LEFT JOIN "user" u
                ON u.user_id = fst.user_id
            WHERE fs.franchise_store_id = $1
            `,
            [store_id]
        );

        if (rs.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cửa hàng không tồn tại"
            });
        }

        return res.json({
            success: true,
            data: rs.rows[0],
            message: null
        });
    } catch (err) {
        console.error("getFranchiseStoreById error:", err);
        return res.status(500).json({
            success: false,
            message: "Server/DB error",
            error_code: "SERVER_ERROR",
        });
    }
}

async function updateStatus(req, res) {
    const store_id = req.params.store_id;
    const { status } = req.body;

    try {
        if (!store_id || isNaN(store_id) || Number(store_id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "store_id không hợp lệ",
            });
        }

        if (!status || typeof status !== "string" || !status.trim()) {
            return res.status(400).json({
                success: false,
                message: "status là bắt buộc",
            });
        }

        const trimmedStatus = status.trim().toLowerCase();

        if (!["active", "inactive"].includes(trimmedStatus)) {
            return res.status(400).json({
                success: false,
                message: "status chỉ được là active hoặc inactive",
            });
        }

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
            SET status = $1
            WHERE franchise_store_id = $2
            RETURNING *;
            `,
            [trimmedStatus, store_id]
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

        if (typeof store_code !== "string" || !store_code.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_code không hợp lệ",
            });
        }

        if (typeof store_name !== "string" || !store_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_name không hợp lệ",
            });
        }

        if (typeof store_address !== "string" || !store_address.trim()) {
            return res.status(400).json({
                success: false,
                message: "store_address không hợp lệ",
            });
        }

        const trimmedStoreCode = store_code.trim();
        const trimmedStoreName = store_name.trim();
        const trimmedStoreAddress = store_address.trim();

        if (!/^[A-Za-z0-9]+$/.test(trimmedStoreCode)) {
            return res.status(400).json({
                success: false,
                message: "store_code không được chứa ký tự đặc biệt hoặc khoảng trắng",
            });
        }

        if (!/(?=.*[A-Za-z])(?=.*\d)/.test(trimmedStoreCode)) {
            return res.status(400).json({
                success: false,
                message: "store_code phải chứa cả chữ và số",
            });
        }

        // Kiểm tra store_code đã tồn tại chưa
        const existingStore = await pool.query(
            `SELECT * FROM franchise_store WHERE store_code = $1`,
            [trimmedStoreCode]
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
            [trimmedStoreCode, trimmedStoreName, trimmedStoreAddress]
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

module.exports = { getAllFranchiseStores, updateFranchiseStore, updateStatus, createFranchiseStore, getFranchiseStoreById };