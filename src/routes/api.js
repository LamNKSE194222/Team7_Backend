const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController.js");
const { Fdashboard } = require("../controllers/franchiseStaff_dashboardController");
const { Cdashboard } = require("../controllers/CentralKitchen_dashboardController");
const { getOrders } = require("../controllers/orderController.js");
const CentralKitchen_NewOrder = require("../controllers/CentralKitchen_NewOrder.js");
const { requireKitchenStaff } = require("../middleware/requireKitchenStaff");
const profileController = require("../controllers/profileController.js");
const { requireFranchiseStaff } = require("../middleware/requireFranchiseStaff");
const franchiseInventoryController = require("../controllers/franchiseInventoryController");
const { getCentralKitchenMaterialsInventory } = require("../controllers/CentralKitchenMaterialsInventory.js");
const receiveConfirmController = require("../controllers/receiveConfirmController");
const { readyToDeliver, getFulfilledOrders, getProcessingOrders, CentralGetOrders } = require("../controllers/CentralKitchenOrderStatusController");
const { getCentralKitchenProductInventory } = require("../controllers/centralKitchenProductInventoryController");
const ManagerProductController = require("../controllers/manager_product_controller.js");
const { Mdashboard } = require("../controllers/manager_dashboardController");
const { getManagerStorage } = require("../controllers/manager_inventoryController");
const adminUserController = require("../controllers/adminUserController");
const manager_accept_payment = require("../controllers/manager_accept_payment");

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and profile APIs
 *   - name: Product
 *     description: Product APIs
 *   - name: Franchise
 *     description: Franchise staff APIs
 *   - name: Central Kitchen
 *     description: Central Kitchen staff APIs
 */const { requireRole } = require("../middleware/requireRole");



/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     BaseResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           nullable: true
 *         message:
 *           type: string
 *           nullable: true
 *           example: null
 *         error_code:
 *           type: string
 *           nullable: true
 *           example: null
 *
 *     DashboardCards:
 *       type: object
 *       properties:
 *         pending:
 *           type: integer
 *           example: 1
 *         approved:
 *           type: integer
 *           example: 0
 *         processing:
 *           type: integer
 *           example: 1
 *         fulfilled:
 *           type: integer
 *           example: 1
 *
 *     OrderSummary:
 *       type: object
 *       properties:
 *         order_id:
 *           type: string
 *           example: "1"
 *         order_code:
 *           type: string
 *           example: "ORD-001"
 *         status:
 *           type: string
 *           example: "pending"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-28T13:05:33.480Z"
 *         delivered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         desired_date:
 *           type: string
 *           format: date-time
 *           example: "2026-01-31T13:05:33.480Z"
 *         product_count:
 *           type: integer
 *           example: 2
 *         store_name:
 *           type: string
 *           nullable: true
 *           example: "Franchise Store - District 1"
 *
 *     OrderListItem:
 *       type: object
 *       properties:
 *         order_id:
 *           type: string
 *           example: "1"
 *         order_code:
 *           type: string
 *           example: "ORD-001"
 *         status:
 *           type: string
 *           example: "pending"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-28T13:05:33.480Z"
 *         desired_date:
 *           type: string
 *           format: date-time
 *           example: "2026-01-31T13:05:33.480Z"
 *         note:
 *           type: string
 *           nullable: true
 *           example: null
 *         delivered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         total_items:
 *           type: string
 *           example: "2"
 *         product_names:
 *           type: string
 *           nullable: true
 *           example: "Mooncake - Mung Bean 150g, Mooncake - Mixed Nuts 150g"
 *
 *     CentralKitchenFulfilledOrderItem:
 *       type: object
 *       properties:
 *         order_id:
 *           type: string
 *           example: "1"
 *         order_code:
 *           type: string
 *           example: "ORD-001"
 *         status:
 *           type: string
 *           example: "pending"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-01-28T13:05:33.480Z"
 *         desired_date:
 *           type: string
 *           format: date-time
 *           example: "2026-01-31T13:05:33.480Z"
 *         note:
 *           type: string
 *           nullable: true
 *           example: null
 *         delivered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         total_items:
 *           type: string
 *           example: "2"
 *         product_names:
 *           type: string
 *           nullable: true
 *           example: "Mooncake - Mung Bean 150g, Mooncake - Mixed Nuts 150g"
 *
 *     OrderItemDetail:
 *       type: object
 *       properties:
 *         product_name:
 *           type: string
 *           example: "Mooncake - Mung Bean 150g"
 *         qty:
 *           type: number
 *           example: 10
 *         uom:
 *           type: string
 *           example: "piece"
 *         unit_price:
 *           type: number
 *           example: 50000
 *
 *     OrderDetail:
 *       type: object
 *       properties:
 *         order_id:
 *           type: string
 *           example: "1"
 *         order_code:
 *           type: string
 *           example: "ORD-001"
 *         status:
 *           type: string
 *           example: "pending"
 *         created_at:
 *           type: string
 *           format: date-time
 *         desired_date:
 *           type: string
 *           format: date-time
 *         delivered_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         note:
 *           type: string
 *           nullable: true
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItemDetail'
 *
 *     DashboardData:
 *       type: object
 *       properties:
 *         cards:
 *           $ref: '#/components/schemas/DashboardCards'
 *         pending_orders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderSummary'
 *         recent_orders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderSummary'
 *         expiring_materials:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CkExpiringMaterialRow'
 *         expiry_days:
 *           type: integer
 *           example: 60
 *
 *     OrderListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OrderListItem'
 *
 *     OrderDetailResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/OrderDetail'
 *
 *     CreateOrderItem:
 *       type: object
 *       required:
 *         - product_id
 *         - qty
 *       properties:
 *         product_id:
 *           type: integer
 *           example: 1
 *         qty:
 *           type: number
 *           example: 10
 *
 *     CreateOrderRequest:
 *       type: object
 *       required:
 *         - desired_date
 *         - items
 *       properties:
 *         desired_date:
 *           type: string
 *           format: date-time
 *           example: "2026-02-10T09:00:00Z"
 *         note:
 *           type: string
 *           nullable: true
 *           example: "Giao buổi sáng"
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/CreateOrderItem'
 *
 *     CkExpiringMaterialRow:
 *       type: object
 *       properties:
 *         material_id:
 *           type: string
 *           example: "2"
 *         material_name:
 *           type: string
 *           example: "Đậu xanh đã cà vỏ"
 *         uom:
 *           type: string
 *           example: "kg"
 *         on_hand_qty:
 *           type: string
 *           example: "200.000"
 *         expiry_date:
 *           type: string
 *           format: date-time
 *           example: "2026-04-14T17:00:00.000Z"
 *         days_left:
 *           type: integer
 *           example: 43
 *         inventory_code:
 *           type: string
 *           example: "CK-INV-001"
 *         last_updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T13:32:22.818Z"
 *
 *     CkInventoryMaterialRow:
 *       type: object
 *       properties:
 *         inventory_item_id:
 *           type: string
 *           example: "2"
 *         material_id:
 *           type: string
 *           example: "2"
 *         material_name:
 *           type: string
 *           example: "Đậu xanh đã cà vỏ"
 *         uom:
 *           type: string
 *           example: "kg"
 *         on_hand_qty:
 *           type: string
 *           example: "200.000"
 *         expiry_date:
 *           type: string
 *           format: date-time
 *           example: "2026-04-14T17:00:00.000Z"
 *         days_left:
 *           type: integer
 *           example: 43
 *         inventory_code:
 *           type: string
 *           example: "CK-INV-001"
 *         last_updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T13:32:22.818Z"
 *
 *     CentralKitchenDashboardResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/DashboardData'
 *
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Mooncake - Mung Bean 150g"
 *         uom:
 *           type: string
 *           example: "piece"
 *         sku:
 *           type: string
 *           example: "SKU-MC-MUNG-150"
 *         price:
 *           type: number
 *           example: 50000
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Bánh trung thu nhân đậu xanh 150g"
 *
 *     ProductListResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *
 *     StorageItem:
 *       type: object
 *       properties:
 *         inventory_item_id:
 *           type: string
 *           example: "2"
 *         product_id:
 *           type: string
 *           example: "1"
 *         product_code:
 *           type: string
 *           example: "SKU-MC-MUNG-150"
 *         product_name:
 *           type: string
 *           example: "Bánh Trung Thu - Đậu Xanh 150g"
 *         category_name:
 *           type: string
 *           example: "Mooncake"
 *         quantity:
 *           type: string
 *           description: "available = on_hand_qty - reserved_qty (Postgres numeric thường trả dạng string)"
 *           example: "70.000"
 *         expiry_date:
 *           type: string
 *           format: date
 *           nullable: true
 *           example: null
 *
 *     AdjustInventoryItemRequest:
 *       type: object
 *       required:
 *         - delta
 *       properties:
 *         delta:
 *           type: number
 *           description: "Số lượng điều chỉnh. Dương = cộng thêm, âm = trừ bớt. Không được bằng 0."
 *           example: -5
 *
 *     AdjustInventoryItemResult:
 *       type: object
 *       properties:
 *         inventory_item_id:
 *           type: integer
 *           example: 2
 *         product_id:
 *           type: integer
 *           example: 1
 *         old_qty:
 *           type: number
 *           example: 70
 *         new_qty:
 *           type: number
 *           example: 65
 *         adjusted_by_staff_id:
 *           type: integer
 *           example: 10
 *
 *     SeedInventoryItemRequest:
 *       type: object
 *       required:
 *         - product_id
 *         - qty
 *       properties:
 *         product_id:
 *           type: integer
 *           example: 1
 *         qty:
 *           type: number
 *           example: 100
 *
 *     FranchiseInventoryItemRow:
 *       type: object
 *       description: "RETURNING * từ bảng franchise_inventory_item"
 *       properties:
 *         inventory_item_id:
 *           type: integer
 *           example: 2
 *         inventory_id:
 *           type: integer
 *           example: 1
 *         product_id:
 *           type: integer
 *           example: 1
 *         on_hand_qty:
 *           type: string
 *           example: "100.000"
 *         reserved_qty:
 *           type: string
 *           example: "0.000"
 *         last_updated_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-02-24T07:15:00.000Z"
 *
 *     ConfirmReceiptRequest:
 *       type: object
 *       required:
 *         - rating
 *       properties:
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *         comment:
 *           type: string
 *           nullable: true
 *           example: "Hàng giao đúng và đủ"
 *
 *     ConfirmReceiptResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               properties:
 *                 order_id:
 *                   type: integer
 *                   example: 15
 *                 order_code:
 *                   type: string
 *                   example: "ORD-1770384235884"
 *                 status:
 *                   type: string
 *                   example: "confirmed"
 *                 received_confirmed_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-03-05T09:00:00Z"
 * 
 *     AdminUserListItem:
 *       type: object
 *       properties:
 *         user_id:
 *           type: integer
 *           example: 8
 *         username:
 *           type: string
 *           example: Nguyen Khanh Lam
 *         email:
 *           type: string
 *           example: storestaff3@moon.com
 *         role:
 *           type: string
 *           example: franchise_staff
 *         role_label:
 *           type: string
 *           example: Cửa Hàng
 *         status:
 *           type: string
 *           example: active
 *         status_label:
 *           type: string
 *           example: Hoạt động
 *         franchise_store_id:
 *           type: integer
 *           nullable: true
 *           example: 6
 *         franchise_store_name:
 *           type: string
 *           nullable: true
 *           example: Chi nhánh Quận 7
 *         central_kitchen_id:
 *           type: integer
 *           nullable: true
 *           example: null
 *         central_kitchen_name:
 *           type: string
 *           nullable: true
 *           example: null
 *         manager_code:
 *           type: string
 *           nullable: true
 *           example: null
 *         franchise_staff_code:
 *           type: string
 *           nullable: true
 *           example: FS-STAFF-006
 *         kitchen_staff_code:
 *           type: string
 *           nullable: true
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-03-10T21:26:31.257Z
 *         last_login_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2026-03-10T22:10:00.000Z
 *
 *     AdminUserListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AdminUserListItem'
 *         message:
 *           type: string
 *           nullable: true
 *           example: null
 *
 *     AdminUpdateUserRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *       properties:
 *         username:
 *           type: string
 *           example: Nguyễn Văn A Updated
 *         email:
 *           type: string
 *           format: email
 *           example: store1_updated@franchise.com
 *
 *     AdminUpdateUserResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             user_id:
 *               type: integer
 *               example: 5
 *             username:
 *               type: string
 *               example: Nguyễn Văn A Updated
 *             email:
 *               type: string
 *               example: store1_updated@franchise.com
 *             status:
 *               type: string
 *               example: active
 *             created_at:
 *               type: string
 *               format: date-time
 *               example: 2026-03-10T21:26:31.257Z
 *             last_login_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *               example: null
 *         message:
 *           type: string
 *           example: Cập nhật user thành công
 *
 *     AdminResetPasswordRequest:
 *       type: object
 *       required:
 *         - new_password
 *       properties:
 *         new_password:
 *           type: string
 *           minLength: 6
 *           example: 12345678
 *
 *     AdminUpdateStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: inactive
 *
 *     AdminUpdateStatusResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             user_id:
 *               type: integer
 *               example: 5
 *             username:
 *               type: string
 *               example: Nguyễn Văn A
 *             email:
 *               type: string
 *               example: store1@franchise.com
 *             status:
 *               type: string
 *               example: inactive
 *         message:
 *           type: string
 *           example: Vô hiệu hóa tài khoản thành công
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *           examples:
 *             franchise_staff:
 *               summary: Franchise staff login
 *               value:
 *                 email: "storestaff1@moon.vn"
 *                 password: "123456"
 *             kitchen_staff:
 *               summary: Kitchen staff login
 *               value:
 *                 email: "kitchen1@moon.vn"
 *                 password: "123456"
 *             manager:
 *               summary: Manager login
 *               value:
 *                 email: "manager1@moon.vn"
 *                 password: "123456"
 *             admin:
 *               summary: Admin login
 *               value:
 *                 email: "admin@moon.vn"
 *                 password: "123456"
 *     responses:
 *       200:
 *         description: Login success
 *       401:
 *         description: Invalid credentials
 */
router.post("/auth/login", authController.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Profile của user hiện tại (từ JWT)
 *     description: |
 *       Trả về thông tin user đã đăng nhập từ token.
 *       Dùng chung cho mọi nghiệp vụ (franchise_staff / kitchen_staff / manager / user).
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       example: "3"
 *                     role:
 *                       type: string
 *                       example: "kitchen_staff"
 *                     franchise_store_id:
 *                       nullable: true
 *                       example: null
 *                     central_kitchen_id:
 *                       nullable: true
 *                       example: "2"
 *                     iat:
 *                       type: integer
 *                       example: 1770651752
 *                     exp:
 *                       type: integer
 *                       example: 1771256552
 *                 message:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized (không có token / token sai)
 */
router.get("/auth/me", requireAuth, authController.me);
router.post("/auth/logout", requireAuth, authController.logout);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm (chỉ active)
 *     description: Trả về danh sách product có is_active = TRUE, sắp xếp theo product_id DESC.
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: 2
 *                   name: "Mooncake - Mixed Nuts 150g"
 *                   uom: "piece"
 *                   sku: "SKU-MC-NUTS-150"
 *                   price: 60000
 *                   description: "Bánh trung thu thập cẩm 150g"
 *                 - id: 1
 *                   name: "Mooncake - Mung Bean 150g"
 *                   uom: "piece"
 *                   sku: "SKU-MC-MUNG-150"
 *                   price: 50000
 *                   description: "Bánh trung thu nhân đậu xanh 150g"
 *               message: null
 *       401:
 *         description: Unauthorized (không có token / token sai)
 *       500:
 *         description: DB error
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "DB error"
 */
router.get("/products", requireAuth, productController.list);

/**
 * @swagger
 * /api/franchiseStaff_dashboard:
 *   get:
 *     summary: Franchise staff dashboard
 *     description: |
 *       Lấy dữ liệu tổng quan cho cửa hàng franchise hiện tại, bao gồm:
 *       - tổng tiền đã thanh toán
 *       - tổng tiền chờ thanh toán
 *       - tổng số đơn hàng
 *       - số lượng đơn theo từng trạng thái
 *       - danh sách đơn hàng gần đây có phân trang
 *     tags:
 *       - Franchise
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Trang hiện tại của danh sách đơn gần đây
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *         description: Số lượng đơn hàng mỗi trang
 *     responses:
 *       200:
 *         description: Lấy dashboard thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         paid_amount:
 *                           type: number
 *                           example: 4000000
 *                           description: Tổng tiền các đơn đã thanh toán
 *                         unpaid_amount:
 *                           type: number
 *                           example: 8000000
 *                           description: Tổng tiền các đơn chưa thanh toán
 *                         total_orders:
 *                           type: integer
 *                           example: 36
 *                           description: Tổng số đơn hàng của cửa hàng
 *                     cards:
 *                       type: object
 *                       properties:
 *                         pending:
 *                           type: integer
 *                           example: 1
 *                         approved:
 *                           type: integer
 *                           example: 0
 *                         processing:
 *                           type: integer
 *                           example: 5
 *                         fulfilled:
 *                           type: integer
 *                           example: 4
 *                         confirmed:
 *                           type: integer
 *                           example: 20
 *                         cancelled:
 *                           type: integer
 *                           example: 6
 *                     
 *             example:
 *               success: true
 *               data:
 *                 summary:
 *                   paid_amount: 4000000
 *                   unpaid_amount: 8000000
 *                   total_orders: 36
 *                 cards:
 *                   pending: 1
 *                   approved: 0
 *                   processing: 5
 *                   fulfilled: 4
 *                   confirmed: 20
 *                   cancelled: 6
 *                 pagination:
 *                   page: 1
 *                   limit: 5
 *                   total_items: 36
 *                   total_pages: 8
 *                   has_next_page: true
 *                   has_prev_page: false
 *                 recent_orders:
 *                   - order_id: 91
 *                     order_code: "ORD-1773278920610"
 *                     status: "confirmed"
 *                     payment_status: "paid"
 *                     created_at: "2026-03-12T01:28:40.608Z"
 *                     desired_date: "2026-03-12T00:00:00.000Z"
 *                     fulfilled_at: "2026-03-11T18:29:27.027Z"
 *                     total_amount: 4000000
 *                     total_items: 2
 *                     total_product_qty: 15
 *                     product_names: "Bánh Trung Thu - Đậu Xanh 150g, Bánh Trung Thu - Thập Cẩm 150g"
 *                   - order_id: 92
 *                     order_code: "ORD-1773323847981"
 *                     status: "processing"
 *                     payment_status: "unpaid"
 *                     created_at: "2026-03-12T13:58:21.246Z"
 *                     desired_date: "2026-03-10T00:00:00.000Z"
 *                     fulfilled_at: null
 *                     total_amount: 960000
 *                     total_items: 1
 *                     total_product_qty: 20
 *                     product_names: "Bánh Trung Thu - Đậu Xanh 150g"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Không có quyền xem dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Không có quyền xem dashboard"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */
router.get("/franchiseStaff_dashboard", requireAuth, requireFranchiseStaff, Fdashboard);

/**
 * @swagger
 * /api/franchise/payment-orders:
 *   get:
 *     summary: Lấy dữ liệu trang thanh toán đơn hàng
 *     description: |
 *       API dùng cho trang Thanh Toán Đơn Hàng của franchise staff.
 *       Dữ liệu được phân loại theo payment_status:
 *       - unpaid -> Đơn Hàng Chờ Thanh Toán
 *       - paid -> Lịch Sử Thanh Toán
 *
 *       Trường paid_at là thời gian đã thanh toán của đơn hàng.
 *       Chỉ xuất hiện trong payment_history.
 *     tags:
 *       - Franchise
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thanh toán thành công
 */
router.get("/franchise/payment-orders", requireAuth, requireFranchiseStaff, orderController.getPaymentOrders);

/**
 * @swagger
 * /api/CentralKitchenStaff_dashborad:
 *   get:
 *     tags:
 *       - Central Kitchen
 *     summary: Central Kitchen Dashboard
 *     description: Dashboard cho nhân viên bếp trung tâm (kitchen_staff)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: expiry_days
 *         schema:
 *           type: integer
 *           example: 60
 *           default: 7
 *           minimum: 0
 *         description: Số ngày lọc cảnh báo HSD (expiry_date <= today + expiry_days)
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CentralKitchenDashboardResponse'
 *             examples:
 *               example:
 *                 value:
 *                   success: true
 *                   data:
 *                     cards:
 *                       pending: 10
 *                       approved: 1
 *                       processing: 0
 *                       fulfilled: 4
 *                     pending_orders:
 *                       - order_id: "26"
 *                         order_code: "ORD-1772352962908"
 *                         status: "pending"
 *                         desired_date: "2026-03-18T00:00:00.000Z"
 *                         created_at: "2026-03-01T08:16:02.898Z"
 *                         franchise_store_id: "1"
 *                         store_name: "Franchise Store - District 1"
 *                         product_count: 1
 *                     recent_orders:
 *                       - order_id: "27"
 *                         order_code: "ORD-1772413228972"
 *                         status: "confirmed"
 *                         created_at: "2026-03-02T01:00:28.936Z"
 *                         delivered_at: null
 *                         desired_date: "2026-03-02T00:00:00.000Z"
 *                         store_name: "Franchise Store - District 1"
 *                         product_count: 1
 *                     expiring_materials:
 *                       - material_id: "2"
 *                         material_name: "Đậu xanh đã cà vỏ"
 *                         on_hand_qty: "200.000"
 *                         expiry_date: "2026-04-14T17:00:00.000Z"
 *                         last_updated_at: "2026-03-02T13:32:22.818Z"
 *                         inventory_code: "CK-INV-001"
 *                         days_left: 43
 *                     expiry_days: 60
 *                   message: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get("/CentralKitchenStaff_dashborad", requireAuth, requireKitchenStaff, Cdashboard);

/**
 * @swagger
 * /api/Franchise_ViewOrders:
 *   get:
 *     summary: Lấy danh sách đơn hàng của franchise store hiện tại
 *     tags:
 *       - Franchise
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách đơn hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       order_id:
 *                         type: string
 *                         example: "92"
 *                       order_code:
 *                         type: string
 *                         example: "ORD-1773323847981"
 *                       status:
 *                         type: string
 *                         example: "processing"
 *                       payment_status:
 *                         type: string
 *                         example: "unpaid"
 *                       paid_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-03-12T13:58:21.246Z"
 *                       desired_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-03-10T00:00:00.000Z"
 *                       fulfilled_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                       total_amount:
 *                         type: string
 *                         example: "960000"
 *                       total_items:
 *                         type: integer
 *                         example: 1
 *                       total_product_qty:
 *                         type: integer
 *                         example: 20
 *                       product_names:
 *                         type: string
 *                         example: "Bánh Trung Thu - Đậu Xanh 150g"
 *                       product_details:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             product_id:
 *                               type: integer
 *                               example: 1
 *                             product_name:
 *                               type: string
 *                               example: "Bánh Trung Thu - Đậu Xanh 150g"
 *                             qty:
 *                               type: integer
 *                               example: 20
 *                             unit_price:
 *                               type: integer
 *                               example: 48000
 *                             line_total:
 *                               type: integer
 *                               example: 960000
 *             example:
 *               success: true
 *               data:
 *                 - order_id: "92"
 *                   order_code: "ORD-1773323847981"
 *                   status: "processing"
 *                   payment_status: "unpaid"
 *                   paid_at: null
 *                   created_at: "2026-03-12T13:58:21.246Z"
 *                   desired_date: "2026-03-10T00:00:00.000Z"
 *                   fulfilled_at: null
 *                   total_amount: "960000"
 *                   total_items: 1
 *                   total_product_qty: 20
 *                   product_names: "Bánh Trung Thu - Đậu Xanh 150g"
 *                   product_details:
 *                     - product_id: 1
 *                       product_name: "Bánh Trung Thu - Đậu Xanh 150g"
 *                       qty: 20
 *                       unit_price: 48000
 *                       line_total: 960000
 *       403:
 *         description: Không có quyền xem đơn
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Không có quyền xem đơn"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Lỗi server"
 */
router.get("/Franchise_ViewOrders", requireAuth, requireFranchiseStaff, getOrders);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Franchise staff tạo đơn hàng
 *     tags: [Franchise]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - desired_date
 *               - items
 *             properties:
 *               desired_date:
 *                 type: string
 *                 format: date
 *                 example: 2026-03-10
 *               note:
 *                 type: string
 *                 example: Giao buổi sáng
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 1
 *                     qty:
 *                       type: integer
 *                       example: 20
 *     responses:
 *       201:
 *         description: Tạo đơn thành công
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
router.post("/orders", requireAuth, requireFranchiseStaff, orderController.createOrder);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   patch:
 *     summary: Hủy/Xóa đơn hàng của franchise
 *     description: |
 *       Franchise staff được phép xóa đơn hàng của chính cửa hàng mình.
 *       Chỉ cho phép xóa khi đơn đang ở trạng thái **pending**.
 *       Khi xóa thành công, dữ liệu trong `order_item` và `orders` sẽ bị xóa khỏi hệ thống.
 *     tags:
 *       - Franchise
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         description: ID của đơn hàng cần xóa
 *         schema:
 *           type: integer
 *           example: 93
 *     responses:
 *       200:
 *         description: Xóa đơn hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Hủy đơn hàng thành công
 *       400:
 *         description: orderId không hợp lệ hoặc trạng thái đơn không cho phép xóa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: orderId không hợp lệ
 *       403:
 *         description: Không có quyền xóa đơn hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Không có quyền hủy đơn
 *       404:
 *         description: Không tìm thấy đơn hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Không tìm thấy đơn hàng
 *       500:
 *         description: Lỗi server khi xóa đơn hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Lỗi server khi hủy đơn hàng
 */
router.patch("/orders/:orderId", requireAuth, requireFranchiseStaff, orderController.cancelOrder);

/**
 * @swagger
 * /api/centralKitchen/orders/new:
 *   get:
 *     summary: Danh sách đơn hàng mới (pending)
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/centralKitchen/orders/new", requireAuth, requireKitchenStaff, CentralKitchen_NewOrder.listNewOrders);

/**
 * @swagger
 * /api/centralKitchen/orders/processing:
 *   get:
 *     summary: Lấy danh sách đơn hàng processing của central kitchen hiện tại
 *     description: |
 *       Trả về danh sách các đơn hàng thuộc central kitchen của kitchen staff đang đăng nhập
 *       và đang ở trạng thái **processing**.
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng processing
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - order_id: 53
 *                   order_code: "ORD-1772954758765"
 *                   franchise_store_id: 1
 *                   store_name: "Franchise Store - District 1"
 *                   central_kitchen_id: 2
 *                   status: "processing"
 *                   created_at: "2026-03-08T09:00:00.000Z"
 *                   desired_date: "2026-03-09T00:00:00.000Z"
 *                   total_items: "1"
 *                   product_names: "Bánh Trung Thu - Đậu Xanh 150g"
 *               message: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get("/centralKitchen/orders/processing", requireAuth, requireKitchenStaff, getProcessingOrders);

/**
 * @swagger
 * /api/centralKitchen/orders/fulfilled:
 *   get:
 *     summary: Lấy danh sách đơn hàng fulfilled của central kitchen hiện tại
 *     description: |
 *       Trả về danh sách các đơn hàng thuộc central kitchen của kitchen staff đang đăng nhập
 *       và đang ở trạng thái **fulfilled**.
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng fulfilled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CentralKitchenFulfilledOrderItem'
 *             example:
 *               success: true
 *               data:
 *                 - order_id: 6
 *                   order_code: "ORD-006"
 *                   status: "fulfilled"
 *                   fulfilled_at: "2026-01-05T10:30:00.000Z"
 *                   franchise_store_id: 2
 *                   store_name: "Franchise Store - District 1"
 *                   total_items: "2"
 *                   product_names: "Mooncake - Mung Bean 150g, Mooncake - Mixed Nuts 150g"
 *               message: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get("/centralKitchen/orders/fulfilled", requireAuth, requireKitchenStaff, getFulfilledOrders);

/**
 * @swagger
 * /api/centralKitchen/orders/{orderId}:
 *   get:
 *     summary: Chi tiết đơn hàng
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 */
router.get("/centralKitchen/orders/:orderId", requireAuth, requireKitchenStaff, CentralKitchen_NewOrder.getNewOrderDetail);

/**
 * @swagger
 * /api/centralKitchen/orders/{orderId}/approve:
 *   post:
 *     summary: Duyệt đơn (pending -> approved)
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 */
router.post("/centralKitchen/orders/:orderId/approve", requireAuth, requireKitchenStaff, CentralKitchen_NewOrder.acceptNewOrder);

/**
 * @swagger
 * /api/centralKitchen/View_orders:
 *   get:
 *     summary: Lấy danh sách đơn hàng của central kitchen
 *     description: |
 *       API dùng để lấy danh sách đơn hàng thuộc central kitchen đang đăng nhập.
 *       Kết quả trả về bao gồm thông tin đơn hàng, chi nhánh franchise đặt đơn,
 *       tổng tiền, tổng số lượng sản phẩm và danh sách chi tiết sản phẩm trong từng đơn.
 *     tags:
 *       - Central Kitchen
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách đơn hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       order_id:
 *                         type: string
 *                         example: "92"
 *                       order_code:
 *                         type: string
 *                         example: "ORD-1773323847981"
 *                       status:
 *                         type: string
 *                         example: "processing"
 *                       payment_status:
 *                         type: string
 *                         example: "unpaid"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-03-12T13:58:21.246Z"
 *                       desired_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-03-10T00:00:00.000Z"
 *                       fulfilled_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                       franchise_store_id:
 *                         type: string
 *                         example: "1"
 *                       franchise_store_name:
 *                         type: string
 *                         example: "Chi nhánh Quận 1"
 *                       total_amount:
 *                         type: string
 *                         example: "960000"
 *                       total_items:
 *                         type: integer
 *                         example: 1
 *                       total_product_qty:
 *                         type: integer
 *                         example: 20
 *                       product_names:
 *                         type: string
 *                         example: "Bánh Trung Thu - Đậu Xanh 150g"
 *                       product_details:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             product_id:
 *                               type: integer
 *                               example: 1
 *                             product_name:
 *                               type: string
 *                               example: "Bánh Trung Thu - Đậu Xanh 150g"
 *                             qty:
 *                               type: integer
 *                               example: 20
 *                             unit_price:
 *                               type: integer
 *                               example: 48000
 *                             line_total:
 *                               type: integer
 *                               example: 960000
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Lỗi server khi lấy danh sách đơn hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.get("/centralKitchen/View_orders", requireAuth, requireKitchenStaff, CentralGetOrders);

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Cập nhật thông tin profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Manager One"
 *     responses:
 *       200:
 *         description: Cập nhật profile thành công
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 user_id: "2"
 *                 username: "Manager One"
 *                 email: "manager1@moon.vn"
 *                 status: "active"
 *               message: null
 *       400:
 *         description: Lỗi validation
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Server error
 */
router.patch("/profile", requireAuth, profileController.updateProfile);

/**
 * @swagger
 * /api/profile/change-password:
 *   patch:
 *     summary: Đổi mật khẩu user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *                 example: "123456"
 *               new_password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: null
 *               message: "Đổi mật khẩu thành công"
 *       401:
 *         description: Sai mật khẩu hoặc chưa đăng nhập
 *       400:
 *         description: Lỗi validation
 *       500:
 *         description: Server error
 */
router.patch("/profile/change-password", requireAuth, profileController.changePassword);

/**
 * @swagger
 * /api/franchise/inventory/storage:
 *   get:
 *     tags: [Franchise]
 *     summary: Lấy danh sách tồn kho (storage) của cửa hàng franchise hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy storage thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StorageItem'
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *             example:
 *               success: true
 *               data:
 *                 - inventory_item_id: "2"
 *                   product_id: "1"
 *                   product_code: "SKU-MC-MUNG-150"
 *                   product_name: "Bánh Trung Thu - Đậu Xanh 150g"
 *                   category_name: "Mooncake"
 *                   quantity: "70.000"
 *                   expiry_date: null
 *               message: null
 *       401:
 *         description: Chưa đăng nhập / token không hợp lệ
 *       403:
 *         description: Không đúng role franchise staff
 *       500:
 *         description: Server/DB error
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Server/DB error"
 *               error_code: "SERVER_ERROR"
 */
router.get("/franchise/inventory/storage", requireAuth, requireFranchiseStaff, franchiseInventoryController.getStorage);

/**
 * @swagger
 * /api/central-kitchen/materials-inventory:
 *   get:
 *     tags:
 *       - Central Kitchen
 *     summary: Get materials inventory + expiring materials (Central Kitchen Staff)
 *     description: |
 *       Trả về danh sách tồn kho nguyên liệu (inventory_items) và danh sách nguyên liệu sắp hết hạn (expiring_materials).
 *       Lọc sắp hết hạn theo tham số expiry_days (expiry_date <= today + expiry_days).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: expiry_days
 *         required: false
 *         schema:
 *           type: integer
 *           example: 60
 *           default: 60
 *           minimum: 0
 *         description: Số ngày để lọc nguyên liệu sắp hết hạn
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           example: 50
 *           default: 50
 *           minimum: 1
 *         description: Giới hạn số dòng trả về trong inventory_items
 *       - in: query
 *         name: expiring_limit
 *         required: false
 *         schema:
 *           type: integer
 *           example: 8
 *           default: 8
 *           minimum: 1
 *         description: Giới hạn số dòng trả về trong expiring_materials
 *     responses:
 *       200:
 *         description: Lấy danh sách tồn kho và nguyên liệu sắp hết hạn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     expiry_days:
 *                       type: integer
 *                       example: 60
 *                     expiring_count:
 *                       type: integer
 *                       example: 3
 *                     expiring_materials:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CkExpiringMaterialRow'
 *                     inventory_items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CkInventoryMaterialRow'
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *             example:
 *               success: true
 *               data:
 *                 expiry_days: 60
 *                 expiring_count: 3
 *                 expiring_materials:
 *                   - material_id: "2"
 *                     material_name: "Đậu xanh đã cà vỏ"
 *                     uom: "kg"
 *                     on_hand_qty: "200.000"
 *                     expiry_date: "2026-04-14T17:00:00.000Z"
 *                     days_left: 43
 *                     inventory_code: "CK-INV-001"
 *                     last_updated_at: "2026-03-02T13:32:22.818Z"
 *                   - material_id: "10"
 *                     material_name: "Trứng muối"
 *                     uom: "quả"
 *                     on_hand_qty: "300.000"
 *                     expiry_date: "2026-04-14T17:00:00.000Z"
 *                     days_left: 43
 *                     inventory_code: "CK-INV-001"
 *                     last_updated_at: "2026-03-02T13:32:22.818Z"
 *                   - material_id: "3"
 *                     material_name: "Hạt sen"
 *                     uom: "kg"
 *                     on_hand_qty: "150.000"
 *                     expiry_date: "2026-04-29T17:00:00.000Z"
 *                     days_left: 58
 *                     inventory_code: "CK-INV-001"
 *                     last_updated_at: "2026-03-02T13:32:22.818Z"
 *                 inventory_items:
 *                   - inventory_item_id: "2"
 *                     material_id: "2"
 *                     material_name: "Đậu xanh đã cà vỏ"
 *                     uom: "kg"
 *                     on_hand_qty: "200.000"
 *                     expiry_date: "2026-04-14T17:00:00.000Z"
 *                     days_left: 43
 *                     inventory_code: "CK-INV-001"
 *                     last_updated_at: "2026-03-02T13:32:22.818Z"
 *                   - inventory_item_id: "10"
 *                     material_id: "10"
 *                     material_name: "Trứng muối"
 *                     uom: "quả"
 *                     on_hand_qty: "300.000"
 *                     expiry_date: "2026-04-14T17:00:00.000Z"
 *                     days_left: 43
 *                     inventory_code: "CK-INV-001"
 *                     last_updated_at: "2026-03-02T13:32:22.818Z"
 *               message: null
 *       401:
 *         description: Chưa đăng nhập / token không hợp lệ
 *       403:
 *         description: Không đúng role kitchen staff hoặc không thuộc central kitchen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   nullable: true
 *                   example: null
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   nullable: true
 *                   example: null
 *                 message:
 *                   type: string
 *                   example: "Inventory error"
 */
router.get("/central-kitchen/materials-inventory", requireAuth, requireKitchenStaff, getCentralKitchenMaterialsInventory);

/**
 * @swagger
 * /api/orders/delivered:
 *   get:
 *     summary: Lấy danh sách đơn hàng đã giao chờ xác nhận
 *     tags: [Franchise]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng đã giao
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - order_id: 6
 *                   order_code: ORD-006
 *                   status: fulfilled
 *                   delivered_at: 2026-01-05
 *                   product_name: Bánh Nướng Trà Xanh
 *                   qty: 20
 *       401:
 *         description: Unauthorized
 */
router.get("/orders/delivered", requireAuth, requireFranchiseStaff, receiveConfirmController.listOrders);

/**
 * @swagger
 * /api/orders/{orderId}/confirm-receipt:
 *   post:
 *     summary: Xác nhận đã nhận hàng
 *     description: |
 *       Franchise staff xác nhận đã nhận đơn hàng khi đơn ở trạng thái **fulfilled**.
 *       Khi xác nhận thành công:
 *       - status -> confirmed
 *       - lưu rating và comment
 *     tags:
 *       - Franchise
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 15
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmReceiptRequest'
 *           example:
 *             rating: 5
 *             comment: "Hàng giao đủ và đúng chất lượng"
 *     responses:
 *       200:
 *         description: Xác nhận thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfirmReceiptResponse'
 *       400:
 *         description: Sai trạng thái đơn hàng hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Không có quyền với đơn hàng này
 *       404:
 *         description: Không tìm thấy đơn hàng
 *       500:
 *         description: Server error
 */
router.post("/orders/:orderId/confirm-receipt", requireAuth, requireFranchiseStaff, receiveConfirmController.confirmReceipt);

/**
 * @swagger
 * /api/centralKitchen/orders/{orderId}/ready-to-deliver:
 *   post:
 *     summary: Đơn hàng đã chuẩn bị xong và sẵn sàng giao
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID đơn hàng
 *     responses:
 *       200:
 *         description: Order chuyển sang trạng thái ready_to_deliver
 *       404:
 *         description: Order not found
 */
router.post("/centralKitchen/orders/:orderId/ready-to-deliver", requireAuth, requireKitchenStaff, readyToDeliver);

/**
 * @swagger
 * /api/centralKitchen/product-inventory:
 *   get:
 *     summary: Lấy danh sách sản phẩm tồn kho của bếp trung tâm
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm tồn kho của central kitchen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       inventory_item_id:
 *                         type: integer
 *                         example: 2
 *                       central_kitchen_id:
 *                         type: integer
 *                         example: 2
 *                       product_id:
 *                         type: integer
 *                         example: 2
 *                       sku:
 *                         type: string
 *                         example: SKU-MC-NUTS-150
 *                       product_name:
 *                         type: string
 *                         example: Bánh Trung Thu - thập cẩm 150g
 *                       uom:
 *                         type: string
 *                         example: cái
 *                       price:
 *                         type: string
 *                         example: "55000.00"
 *                       product_type_name:
 *                         type: string
 *                         example: Mooncake
 *                       on_hand_qty:
 *                         type: string
 *                         example: "500.000"
 *                       min_qty:
 *                         type: string
 *                         example: "200.000"
 *                       expiry_date:
 *                         type: string
 *                         format: date-time
 *                         example: 2026-02-14T17:00:00.000Z
 *                       last_updated_at:
 *                         type: string
 *                         format: date-time
 *                         example: 2026-03-07T12:55:09.165Z
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       403:
 *         description: Forbidden hoặc không phải kitchen staff
 *       500:
 *         description: Load product inventory error
 */
router.get("/centralKitchen/product-inventory", requireAuth, requireKitchenStaff, getCentralKitchenProductInventory);

/**
 * @swagger
 * /api/manager/dashboard:
 *   get:
 *     summary: Manager Dashboard
 *     description: Get dashboard statistics including order stats, stock totals, and material inventory
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     cards:
 *                       type: object
 *                       properties:
 *                         total_orders_month:
 *                           type: integer
 *                           example: 5
 *                         low_stock_alerts:
 *                           type: integer
 *                           example: 0
 *                         total_product_stock:
 *                           type: integer
 *                           example: 650
 *                         total_material_stock:
 *                           type: integer
 *                           example: 1466
 *                     materials_inventory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           inventory_item_id:
 *                             type: string
 *                             example: "2"
 *                           material_name:
 *                             type: string
 *                             example: "Đậu xanh đã cà vỏ"
 *                           on_hand_qty:
 *                             type: string
 *                             example: "142.200"
 *                           expiry_date:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-04-14T17:00:00.000Z"
 *                           uom:
 *                             type: string
 *                             example: "kg"
 *                           material_type:
 *                             type: string
 *                             example: "Nhân bánh"
 *                           status:
 *                             type: string
 *                             example: "active"
 *                     low_stock_alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     threshold:
 *                       type: integer
 *                       example: 5
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/manager/dashboard", requireAuth, requireRole("manager", "admin"), Mdashboard);

/**
 * @swagger
 * /api/manager/product_inventory:
 *   get:
 *     summary: Manager Inventory Overview (System-wide storage)
 *     tags: [Manager]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/manager/product_inventory", requireAuth, requireRole("manager", "admin"), getManagerStorage);

/**
 * @swagger
 * /api/Manager_create_products:
 *   post:
 *     summary: Create a new product with materials
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_type_id
 *               - name
 *               - uom
 *               - sku
 *               - price
 *             properties:
 *               product_type_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: Bánh Trung Thu - Đậu Xanh 150g
 *               uom:
 *                 type: string
 *                 example: cái
 *               sku:
 *                 type: string
 *                 example: SKU-MC-MUNG-150
 *               price:
 *                 type: number
 *                 example: 45000
 *               description:
 *                 type: string
 *                 example: Bánh trung thu nhân đậu xanh truyền thống
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - material_id
 *                     - qty_required
 *                     - uom
 *                   properties:
 *                     material_id:
 *                       type: integer
 *                       example: 1
 *                     qty_required:
 *                       type: number
 *                       example: 0.05
 *                     uom:
 *                       type: string
 *                       example: kg
 *                     note:
 *                       type: string
 *                       example: Bột mì làm vỏ bánh
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/Manager_create_products", requireAuth, requireRole("manager", "admin"), ManagerProductController.createProduct);

/**
 * @swagger
 * /api/Manager_view_products:
 *   get:
 *     summary: Get all products
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product list retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/Manager_view_products", requireAuth, requireRole("manager", "admin"), ManagerProductController.getProducts);

/**
 * @swagger
 * /api/Manager_view_detail_products/{id}:
 *   get:
 *     summary: Get product detail by ID
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Product detail retrieved successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/Manager_view_detail_products/:id", requireAuth, requireRole("manager", "admin"), ManagerProductController.getProductById);

/**
 * @swagger
 * /api/Manager_update_products/{id}:
 *   put:
 *     summary: Update product information and materials
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_type_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: Bánh Trung Thu - Đậu Xanh 150g Updated
 *               uom:
 *                 type: string
 *                 example: cái
 *               sku:
 *                 type: string
 *                 example: SKU-MC-MUNG-150
 *               price:
 *                 type: number
 *                 example: 48000
 *               description:
 *                 type: string
 *                 example: Bánh trung thu đậu xanh đã cập nhật
 *               is_active:
 *                 type: boolean
 *                 example: true
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - material_id
 *                     - qty_required
 *                     - uom
 *                   properties:
 *                     material_id:
 *                       type: integer
 *                       example: 1
 *                     qty_required:
 *                       type: number
 *                       example: 0.05
 *                     uom:
 *                       type: string
 *                       example: kg
 *                     note:
 *                       type: string
 *                       example: Bột mì cập nhật
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/Manager_update_products/:id", requireAuth, requireRole("manager", "admin"), ManagerProductController.updateProduct);

/**
 * @swagger
 * /api/Manager_delete_products/{id}:
 *   delete:
 *     summary: Soft delete product (set is_active = false)
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/Manager_delete_products/:id", requireAuth, requireRole("manager", "admin"), ManagerProductController.deleteProduct);

/**
 * @swagger
 * /api/Manager_restore_products/{id}:
 *   patch:
 *     summary: Restore soft-deleted product (set is_active = true)
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Product restored successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/Manager_restore_products/:id", requireAuth, requireRole("manager", "admin"), ManagerProductController.restoreProduct);

/**
 * @swagger
 * /api/Manager_comfirmPaymentOrder/orders/{orderId}:
 *   patch:
 *     summary: Xác nhận đơn hàng đã thanh toán
 *     description: Chuyển payment_status từ unpaid sang paid cho đơn hàng đã được xác nhận
 *     tags:
 *       - Manager
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         description: ID đơn hàng cần xác nhận thanh toán
 *         schema:
 *           type: integer
 *           example: 57
 *     responses:
 *       200:
 *         description: Xác nhận thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Xác nhận thanh toán thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_id:
 *                       type: string
 *                       example: "57"
 *                     order_code:
 *                       type: string
 *                       example: ORD-1772959916308
 *                     status:
 *                       type: string
 *                       example: confirmed
 *                     payment_status:
 *                       type: string
 *                       example: paid
 *                     paid_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-03-14T08:10:27.900Z"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-03-08T08:52:45.560Z"
 *       400:
 *         description: orderId không hợp lệ hoặc đơn hàng không đủ điều kiện xác nhận thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Đơn không tồn tại, không thuộc cửa hàng của bạn, chưa được xác nhận hoặc đã thanh toán
 *       403:
 *         description: Không có quyền xác nhận thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Không có quyền xác nhận thanh toán
 *       500:
 *         description: Lỗi máy chủ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Server error
 */
router.patch("/Manager_comfirmPaymentOrder/orders/:orderId", requireAuth, requireRole("manager", "admin"), manager_accept_payment.confirmPaymentOrder);

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin user management APIs
 */
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách người dùng cho admin
 *     description: |
 *       Admin lấy danh sách toàn bộ user trong hệ thống.
 *       Hỗ trợ:
 *       - tìm kiếm theo username hoặc email qua `keyword`
 *       - lọc theo vai trò qua `role`
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *         description: Tìm theo username hoặc email
 *         example: admin
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, admin, manager, franchise_staff, kitchen_staff]
 *           default: all
 *         description: Lọc theo vai trò
 *         example: franchise_staff
 *     responses:
 *       200:
 *         description: Lấy danh sách user thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *             examples:
 *               allUsers:
 *                 value:
 *                   success: true
 *                   data:
 *                     - user_id: 8
 *                       username: "Nguyen Khanh Lam"
 *                       email: "storestaff3@moon.com"
 *                       role: "franchise_staff"
 *                       role_label: "Cửa Hàng"
 *                       status: "active"
 *                       status_label: "Hoạt động"
 *                       franchise_store_id: 6
 *                       franchise_store_name: "Chi nhánh Quận 7"
 *                       central_kitchen_id: null
 *                       central_kitchen_name: null
 *                       manager_code: null
 *                       franchise_staff_code: "FS-STAFF-006"
 *                       kitchen_staff_code: null
 *                       created_at: "2026-03-10T21:26:31.257Z"
 *                       last_login_at: "2026-03-10T22:10:00.000Z"
 *                   message: null
 *       401:
 *         description: Unauthorized - thiếu token hoặc token không hợp lệ
 *       403:
 *         description: Forbidden - yêu cầu role admin
 *       500:
 *         description: Server/DB error
 */
router.get("/admin/users", requireAuth, requireRole("admin"), adminUserController.listUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   patch:
 *     summary: Chỉnh sửa thông tin người dùng
 *     description: Admin cập nhật username và email của user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateUserRequest'
 *           example:
 *             username: "Nguyễn Văn A Updated"
 *             email: "store1_updated@franchise.com"
 *     responses:
 *       200:
 *         description: Cập nhật user thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUpdateUserResponse'
 *             example:
 *               success: true
 *               data:
 *                 user_id: 5
 *                 username: "Nguyễn Văn A Updated"
 *                 email: "store1_updated@franchise.com"
 *                 status: "active"
 *                 created_at: "2026-03-10T21:26:31.257Z"
 *                 last_login_at: null
 *               message: "Cập nhật user thành công"
 *       400:
 *         description: Validation error hoặc email đã tồn tại
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - yêu cầu role admin
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Server/DB error
 */
router.patch("/admin/users/:userId", requireAuth, requireRole("admin"), adminUserController.updateUser);

/**
 * @swagger
 * /api/admin/users/{userId}/reset-password:
 *   patch:
 *     summary: Đặt lại mật khẩu người dùng
 *     description: Admin đặt mật khẩu mới cho user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminResetPasswordRequest'
 *           example:
 *             new_password: "12345678"
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: null
 *               message: "Đặt lại mật khẩu thành công"
 *       400:
 *         description: Validation error - mật khẩu mới không hợp lệ
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - yêu cầu role admin
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Server/DB error
 */
router.patch("/admin/users/:userId/reset-password", requireAuth, requireRole("admin"), adminUserController.resetPassword);

/**
 * @swagger
 * /api/admin/users/{userId}/status:
 *   patch:
 *     summary: Vô hiệu hóa hoặc kích hoạt lại người dùng
 *     description: |
 *       Admin cập nhật trạng thái tài khoản user.
 *       - `active`: kích hoạt lại tài khoản
 *       - `inactive`: vô hiệu hóa tài khoản
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateStatusRequest'
 *           examples:
 *             deactivate:
 *               summary: Vô hiệu hóa user
 *               value:
 *                 status: inactive
 *             activate:
 *               summary: Kích hoạt lại user
 *               value:
 *                 status: active
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUpdateStatusResponse'
 *             examples:
 *               inactive:
 *                 value:
 *                   success: true
 *                   data:
 *                     user_id: 5
 *                     username: "Nguyễn Văn A"
 *                     email: "store1@franchise.com"
 *                     status: "inactive"
 *                   message: "Vô hiệu hóa tài khoản thành công"
 *               active:
 *                 value:
 *                   success: true
 *                   data:
 *                     user_id: 5
 *                     username: "Nguyễn Văn A"
 *                     email: "store1@franchise.com"
 *                     status: "active"
 *                   message: "Kích hoạt tài khoản thành công"
 *       400:
 *         description: Validation error hoặc admin tự vô hiệu hóa chính mình
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - yêu cầu role admin
 *       404:
 *         description: Không tìm thấy user
 *       500:
 *         description: Server/DB error
 */
router.patch("/admin/users/:userId/status", requireAuth, requireRole("admin"), adminUserController.updateUserStatus);

module.exports = router;
