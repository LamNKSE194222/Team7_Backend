const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController.js");
const { Fdashboard } = require("../controllers/franchiseStaff_dashboardController");
const { Cdashboard } = require("../controllers/CentralKitchen_dashboardController");
const { createOrder, getOrders } = require("../controllers/orderController.js");
const CentralKitchen_CreateOrders = require("../controllers/CentralKitchen_CreateOrders");
const { requireKitchenStaff } = require("../middleware/requireKitchenStaff");
const CentralKitChenReportController = require("../controllers/CentralKitChenReportController.js");
const profileController = require("../controllers/profileController.js");
const { requireFranchiseStaff } = require("../middleware/requireFranchiseStaff");
const franchiseInventoryController = require("../controllers/franchiseInventoryController");
const { getCentralKitchenMaterialsInventory } = require("../controllers/CentralKitchenMaterialsInventory.js");



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
 *         message:
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
 *             $ref: '#/components/schemas/ExpiringMaterialRow'
 *         expiry_days:
 *           type: integer
 *           example: 60
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
 * tags:
 *   - name: Product
 *     description: Product APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
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
 */

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
 *     description: Fetch dashboard data for franchise staff
 *     tags:
 *       - Franchise Store
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardResponse'
 *       401:
 *         description: Unauthorized
 */

router.get("/franchiseStaff_dashboard", requireAuth, Fdashboard);

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

router.get("/CentralKitchenStaff_dashborad", requireAuth, Cdashboard);

/**
 * @swagger
 * /api/CreateOrders:
 *   post:
 *     summary: Tạo đơn hàng mới (Franchise Staff)
 *     description: Franchise staff tạo đơn hàng gửi về central kitchen
 *     tags:
 *       - Franchise Store
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *           example:
 *             desired_date: "2026-02-10T09:00:00Z"
 *             note: "Giao buổi sáng"
 *             items:
 *               - product_id: 1
 *                 qty: 10
 *               - product_id: 2
 *                 qty: 5
 *     responses:
 *       201:
 *         description: Tạo đơn hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         order_id:
 *                           type: string
 *                           example: "10"
 *                         order_code:
 *                           type: string
 *                           example: "ORD-1770384235884"
 *                         status:
 *                           type: string
 *                           example: "pending"
 *       400:
 *         description: Lỗi validate dữ liệu
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không phải franchise staff
 */

router.post("/CreateOrders", requireAuth, createOrder);

/**
 * @swagger
 * /api/ViewOrders: 
 *   get:
 *     summary: Xem danh sách đơn hàng
 *     description: |
 *       Lấy danh sách đơn hàng của franchise store hiện tại.
 *       - Chỉ franchise staff được phép truy cập
 *       - Có thể lọc theo trạng thái đơn hàng hoặc tìm theo mã đơn
 *     tags:
 *       - Franchise Store
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         description: Lọc theo trạng thái đơn hàng
 *         schema:
 *           type: string
 *           enum:
 *             - pending
 *             - approved
 *             - processing
 *             - fulfilled
 *             - cancelled
 *       - in: query
 *         name: keyword
 *         required: false
 *         description: Tìm kiếm theo mã đơn hàng (order_code)
 *         schema:
 *           type: string
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
 *                         example: "1"
 *                       order_code:
 *                         type: string
 *                         example: "ORD-001"
 *                       status:
 *                         type: string
 *                         example: "pending"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-28T13:05:33.480Z"
 *                       desired_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-31T13:05:33.480Z"
 *                       note:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       delivered_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *                       total_items:
 *                         type: string
 *                         example: "2"
 *                       product_names:
 *                         type: string
 *                         nullable: true
 *                         example: "Mooncake - Mung Bean 150g, Mooncake - Mixed Nuts 150g"
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized - Chưa đăng nhập
 *       403:
 *         description: Forbidden - Không có quyền xem đơn hàng
 *       500:
 *         description: Server error
 */

router.get("/ViewOrders", requireAuth, getOrders);


router.get("/health/db", async (req, res) => {
    try {
        const r = await pool.query("SELECT NOW() as now");
        res.json({ ok: true, now: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});
/**
 * @swagger
 * tags:
 *   - name: Central Kitchen
 *     description: Central Kitchen staff APIs
 */

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
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get("/centralKitchen/orders/new", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.listNewOrders);
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
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not Found }
 */
router.get("/centralKitchen/orders/:orderId", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.getNewOrderDetail);
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
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Conflict }
 */
router.post("/centralKitchen/orders/:orderId/approve", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.acceptNewOrder);
/**
 * @swagger
 * /api/centralKitchen/orders/{orderId}/reject:
 *   post:
 *     summary: Từ chối đơn (pending -> cancelled)
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 3
 *                 example: "Không đủ nguyên liệu"
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad Request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Conflict }
 */
router.post("/centralKitchen/orders/:orderId/reject", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.rejectNewOrder);

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Cập nhật profile cơ bản (username)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 example: "Kitchen Staff 01 (updated)"
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.patch("/profile", requireAuth, profileController.updateProfile);

/**
 * @swagger
 * /api/profile/change-password:
 *   patch:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *                 example: "123456"
 *               new_password:
 *                 type: string
 *                 example: "newpass123"
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized / wrong current password
 */
router.patch("/profile/change-password", requireAuth, profileController.changePassword);

/**
 * @swagger
 * /api/centralKitchen/report/dashboard:
 *   get:
 *     summary: Central Kitchen - Report Dashboard (cards + pending + low stock)
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pending_limit
 *         schema: { type: integer, example: 5 }
 *         description: Số lượng đơn pending trả về
 *       - in: query
 *         name: threshold
 *         schema: { type: number, example: 5 }
 *         description: Ngưỡng cảnh báo tồn kho (available_qty <= threshold)
 *       - in: query
 *         name: low_stock_limit
 *         schema: { type: integer, example: 5 }
 *         description: Số lượng cảnh báo tồn kho trả về
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not kitchen staff)
 */
router.get("/centralKitchen/report/dashboard", requireAuth, requireKitchenStaff, CentralKitChenReportController.dashboardReport);

/**
 * @swagger
 * /api/centralKitchen/report/summary:
 *   get:
 *     summary: Central Kitchen - Summary report theo khoảng thời gian
 *     tags: [Central Kitchen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time, example: "2026-01-01T00:00:00Z" }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time, example: "2026-02-01T00:00:00Z" }
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not kitchen staff)
 */
router.get("/centralKitchen/report/summary", requireAuth, requireKitchenStaff, CentralKitChenReportController.summaryReport);

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
 *       required: [delta]
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
 *       required: [product_id, qty]
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
 * tags:
 *   - name: Franchise Inventory
 *     description: API kho cho franchise staff
 */

/**
 * @swagger
 * /api/franchise/inventory/storage:
 *   get:
 *     tags: [Franchise Inventory]
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
 * /api/franchise/inventory/items/{inventoryItemId}/adjust:
 *   post:
 *     tags: [Franchise Inventory]
 *     summary: Điều chỉnh số lượng on_hand_qty của 1 inventory item (+/-)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryItemId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdjustInventoryItemRequest'
 *           example:
 *             delta: -5
 *     responses:
 *       200:
 *         description: Adjust thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AdjustInventoryItemResult'
 *                 message:
 *                   type: string
 *                   example: "Adjusted"
 *             example:
 *               success: true
 *               data:
 *                 inventory_item_id: 2
 *                 product_id: 1
 *                 old_qty: 70
 *                 new_qty: 65
 *                 adjusted_by_staff_id: 10
 *               message: "Adjusted"
 *       400:
 *         description: Validation error hoặc không đủ tồn để trừ
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *             examples:
 *               invalidInput:
 *                 summary: delta không hợp lệ
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "delta phải là number và khác 0"
 *                   error_code: "VALIDATION_ERROR"
 *               insufficientStock:
 *                 summary: Không đủ tồn để trừ
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "Không đủ tồn để trừ"
 *                   error_code: "INSUFFICIENT_STOCK"
 *       404:
 *         description: Inventory item không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Inventory item không tồn tại"
 *               error_code: "NOT_FOUND"
 *       401:
 *         description: Chưa đăng nhập / token không hợp lệ
 *       403:
 *         description: Không đúng role franchise staff
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BaseResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Internal server error"
 *               error_code: "INTERNAL_ERROR"
 */
router.post("/franchise/inventory/items/:inventoryItemId/adjust", requireAuth, requireFranchiseStaff, franchiseInventoryController.adjustItem);

/**
 * @swagger
 * /api/dev/franchise/inventory/seed:
 *   post:
 *     tags: [Franchise Inventory]
 *     summary: Seed 1 product vào kho của store hiện tại (insert/update franchise_inventory_item)
 *     description: Insert vào franchise_inventory_item, nếu trùng (inventory_id, product_id) thì update on_hand_qty.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SeedInventoryItemRequest'
 *           example:
 *             product_id: 1
 *             qty: 100
 *     responses:
 *       200:
 *         description: Seed thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/FranchiseInventoryItemRow'
 *                 message:
 *                   type: string
 *                   example: "Seed thành công"
 *             example:
 *               success: true
 *               data:
 *                 inventory_item_id: 2
 *                 inventory_id: 1
 *                 product_id: 1
 *                 on_hand_qty: "100.000"
 *                 reserved_qty: "0.000"
 *                 last_updated_at: "2026-02-24T07:15:00.000Z"
 *               message: "Seed thành công"
 *       400:
 *         description: Store chưa có inventory
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
 *                   example: "Store chưa có inventory"
 *       401:
 *         description: Chưa đăng nhập / token không hợp lệ
 *       403:
 *         description: Không đúng role franchise staff
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
router.post("/dev/franchise/inventory/seed", requireAuth, requireFranchiseStaff, franchiseInventoryController.seedInventoryItem);

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
router.get("/central-kitchen/materials-inventory", requireAuth, getCentralKitchenMaterialsInventory);

module.exports = router;