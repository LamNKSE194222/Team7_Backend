const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function getStores(req, res) {
    try {
        const summarySql = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'active')::int AS active_count
            FROM franchise_store
        `;

        const itemsSql = `
    SELECT
        fs.franchise_store_id,
        fs.store_code,
        fs.name AS store_name,
        fs.address,
        fs.phone,
        u.email,
        u.username AS manager_name,
        fs.status
    FROM franchise_store fs
    LEFT JOIN franchise_staff fst
        ON fst.franchise_store_id = fs.franchise_store_id
       AND fst.status = 'active'
    LEFT JOIN "user" u
        ON u.user_id = fst.user_id
       AND u.status = 'active'
    ORDER BY fs.franchise_store_id ASC
`;

        const [summaryRs, itemsRs] = await Promise.all([
            pool.query(summarySql),
            pool.query(itemsSql),
        ]);

        return res.json({
            success: true,
            data: {
                summary: summaryRs.rows[0],
                items: itemsRs.rows,
            },
            message: null,
        });
    } catch (err) {
        console.error("managerStoreController.getStores error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}

async function createStore(req, res) {
    const {
        store_code,
        name,
        address,
        phone,
        email,
        manager_name,
        status = "active",
    } = req.body || {};

    if (!store_code || !String(store_code).trim()) {
        return res.status(400).json({
            success: false,
            message: "store_code là bắt buộc",
        });
    }

    if (!name || !String(name).trim()) {
        return res.status(400).json({
            success: false,
            message: "name là bắt buộc",
        });
    }

    if (!email || !String(email).trim()) {
        return res.status(400).json({
            success: false,
            message: "email là bắt buộc",
        });
    }

    if (!manager_name || !String(manager_name).trim()) {
        return res.status(400).json({
            success: false,
            message: "manager_name là bắt buộc",
        });
    }

    const normalizedStatus = String(status).trim().toLowerCase();
    if (!["active", "inactive"].includes(normalizedStatus)) {
        return res.status(400).json({
            success: false,
            message: "status phải là active hoặc inactive",
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const storeExists = await client.query(
            `
            SELECT 1
            FROM franchise_store
            WHERE store_code = $1
            LIMIT 1
            `,
            [String(store_code).trim()]
        );

        if (storeExists.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "store_code đã tồn tại",
            });
        }

        const userExists = await client.query(
            `
            SELECT 1
            FROM "user"
            WHERE LOWER(TRIM(email)) = $1
            LIMIT 1
            `,
            [normalizedEmail]
        );

        if (userExists.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "email đã tồn tại",
            });
        }

        const insertedStore = await client.query(
            `
            INSERT INTO franchise_store (
                store_code,
                name,
                address,
                phone,
                status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING franchise_store_id, store_code, name, address, phone, status
            `,
            [
                String(store_code).trim(),
                String(name).trim(),
                address ? String(address).trim() : null,
                phone ? String(phone).trim() : null,
                normalizedStatus,
            ]
        );

        const store = insertedStore.rows[0];

        // mật khẩu tạm cho staff mới
        const temporaryPassword = "123456";
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const insertedUser = await client.query(
            `
            INSERT INTO "user" (
                username,
                email,
                password,
                status
            )
            VALUES ($1, $2, $3, $4)
            RETURNING user_id, username, email, status
            `,
            [
                String(manager_name).trim(),
                normalizedEmail,
                passwordHash,
                normalizedStatus,
            ]
        );

        const user = insertedUser.rows[0];

        const staffCode = `FS-STAFF-${String(store.franchise_store_id).padStart(3, "0")}`;

        await client.query(
            `
            INSERT INTO franchise_staff (
                user_id,
                franchise_store_id,
                staff_code,
                status
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                user.user_id,
                store.franchise_store_id,
                staffCode,
                normalizedStatus,
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            data: {
                franchise_store_id: store.franchise_store_id,
                store_code: store.store_code,
                store_name: store.name,
                address: store.address,
                phone: store.phone,
                email: user.email,
                manager_name: user.username,
                staff_code: staffCode,
                status: store.status,
                temporary_password: temporaryPassword
            },
            message: "Tạo cửa hàng thành công",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("managerStoreController.createStore error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

async function updateStore(req, res) {
    const storeId = Number(req.params.storeId);
    const {
        store_code,
        name,
        address,
        phone,
        email,
        manager_name,
    } = req.body || {};

    if (!Number.isFinite(storeId)) {
        return res.status(400).json({
            success: false,
            message: "storeId không hợp lệ",
        });
    }

    if (!store_code || !String(store_code).trim()) {
        return res.status(400).json({
            success: false,
            message: "store_code là bắt buộc",
        });
    }

    if (!name || !String(name).trim()) {
        return res.status(400).json({
            success: false,
            message: "name là bắt buộc",
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const storeCheck = await client.query(
            `
            SELECT franchise_store_id
            FROM franchise_store
            WHERE franchise_store_id = $1
            `,
            [storeId]
        );

        if (storeCheck.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cửa hàng",
            });
        }

        // check store_code trùng với cửa hàng khác
        const codeCheck = await client.query(
            `
            SELECT franchise_store_id
            FROM franchise_store
            WHERE store_code = $1
              AND franchise_store_id <> $2
            LIMIT 1
            `,
            [String(store_code).trim(), storeId]
        );

        if (codeCheck.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "store_code đã tồn tại",
            });
        }

        // cập nhật bảng franchise_store
        const updatedStore = await client.query(
            `
            UPDATE franchise_store
            SET
                store_code = $1,
                name = $2,
                address = $3,
                phone = $4
            WHERE franchise_store_id = $5
            RETURNING
                franchise_store_id,
                store_code,
                name AS store_name,
                address,
                phone,
                status
            `,
            [
                String(store_code).trim(),
                String(name).trim(),
                address ? String(address).trim() : null,
                phone ? String(phone).trim() : null,
                storeId,
            ]
        );

        // tìm staff active đang phụ trách store
        const staffRs = await client.query(
            `
            SELECT fst.user_id
            FROM franchise_staff fst
            WHERE fst.franchise_store_id = $1
              AND fst.status = 'active'
            ORDER BY fst.user_id ASC
            LIMIT 1
            `,
            [storeId]
        );

        let updatedManager = {
            email: null,
            manager_name: null,
        };

        if (staffRs.rowCount > 0) {
            const managerUserId = staffRs.rows[0].user_id;

            const userUpdated = await client.query(
                `
                UPDATE "user"
                SET
                    username = $1,
                    email = $2
                WHERE user_id = $3
                RETURNING username AS manager_name, email
                `,
                [
                    manager_name ? String(manager_name).trim() : null,
                    email ? String(email).trim() : null,
                    managerUserId,
                ]
            );

            if (userUpdated.rowCount > 0) {
                updatedManager = userUpdated.rows[0];
            }
        }

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: {
                ...updatedStore.rows[0],
                ...updatedManager,
            },
            message: "Cập nhật cửa hàng thành công",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("managerStoreController.updateStore error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

async function updateStoreStatus(req, res) {
    const storeId = Number(req.params.storeId);
    const { status } = req.body || {};

    if (!Number.isFinite(storeId)) {
        return res.status(400).json({
            success: false,
            message: "storeId không hợp lệ",
        });
    }

    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!["active", "inactive"].includes(normalizedStatus)) {
        return res.status(400).json({
            success: false,
            message: "status phải là active hoặc inactive",
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const updated = await client.query(
            `
            UPDATE franchise_store
            SET status = $1
            WHERE franchise_store_id = $2
            RETURNING
                franchise_store_id,
                store_code,
                name AS store_name,
                address,
                phone,
                status
            `,
            [normalizedStatus, storeId]
        );

        if (updated.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cửa hàng",
            });
        }

        await client.query(
            `
            UPDATE franchise_staff
            SET status = $1
            WHERE franchise_store_id = $2
            `,
            [normalizedStatus, storeId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: updated.rows[0],
            message:
                normalizedStatus === "active"
                    ? "Kích hoạt cửa hàng thành công"
                    : "Vô hiệu hóa cửa hàng thành công",
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("managerStoreController.updateStoreStatus error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    } finally {
        client.release();
    }
}

async function deleteStore(req, res) {
    const storeId = Number(req.params.storeId);

    if (!Number.isFinite(storeId)) {
        return res.status(400).json({
            success: false,
            message: "storeId không hợp lệ",
        });
    }

    try {
        const updated = await pool.query(
            `
            UPDATE franchise_store
            SET status = 'inactive'
            WHERE franchise_store_id = $1
            RETURNING
                franchise_store_id,
                store_code,
                name AS store_name,
                address,
                phone,
                status
            `,
            [storeId]
        );

        if (updated.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cửa hàng",
            });
        }

        return res.json({
            success: true,
            data: updated.rows[0],
            message: "Đã vô hiệu hóa cửa hàng",
        });
    } catch (err) {
        console.error("managerStoreController.deleteStore error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
}

module.exports = {
    getStores,
    createStore,
    updateStore,
    updateStoreStatus,
    deleteStore,
};