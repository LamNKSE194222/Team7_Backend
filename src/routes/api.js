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
const receiveConfirmController = require("../controllers/receiveConfirmController");
const centralKitchenOrderStatusController = require("../controllers/centralKitchenOrderStatusController");


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
 *
 *     DashboardResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/BaseResponse'
 *         - type: object
 *           properties:
 *             data:
 *               $ref: '#/components/schemas/DashboardData'
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
 *     summary: Central kitchen dashboard
 *     description: Get dashboard data for central kitchen staff, including order statistics, pending orders, recent orders and low stock alerts.
 *     tags:
 *       - Central Kitchen
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
 *                         pending:
 *                           type: integer
 *                           example: 1
 *                         approved:
 *                           type: integer
 *                           example: 1
 *                         processing:
 *                           type: integer
 *                           example: 2
 *                         fulfilled:
 *                           type: integer
 *                           example: 2
 *                     pending_orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_id:
 *                             type: string
 *                             example: "1"
 *                           order_code:
 *                             type: string
 *                             example: "ORD-001"
 *                           status:
 *                             type: string
 *                             example: "pending"
 *                           desired_date:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-01-31T13:05:33.480Z"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-01-28T13:05:33.480Z"
 *                           franchise_store_id:
 *                             type: string
 *                             example: "1"
 *                           store_name:
 *                             type: string
 *                             example: "Franchise Store - District 1"
 *                           product_count:
 *                             type: integer
 *                             example: 2
 *                     recent_orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_id:
 *                             type: string
 *                             example: "1"
 *                           order_code:
 *                             type: string
 *                             example: "ORD-001"
 *                           status:
 *                             type: string
 *                             example: "pending"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-01-28T13:05:33.480Z"
 *                           delivered_at:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             example: null
 *                           desired_date:
 *                             type: string
 *                             format: date-time
 *                             example: "2026-01-31T13:05:33.480Z"
 *                           store_name:
 *                             type: string
 *                             example: "Franchise Store - District 1"
 *                           product_count:
 *                             type: integer
 *                             example: 2
 *                     low_stock_alerts:
 *                       type: array
 *                       description: List of low stock materials
 *                       items:
 *                         type: object
 *                       example: []
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
 *         description: Forbidden - Not central kitchen staff
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
router.get("/ViewOrders", requireAuth, getOrders);

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


router.get("/ViewOrders", requireAuth, orderController.getOrders);


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
 * /api/centralKitchen/orders/status:
 *   get:
 *     summary: Central Kitchen - Danh sách đơn theo trạng thái (tab)
 *     tags: [Central Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approved, processing, fulfilled]
 *         example: processing
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not kitchen staff)
 */
router.get("/centralKitchen/orders/status", requireAuth, requireKitchenStaff, centralKitchenOrderStatusController.listByStatus);

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
 * /api/orders/{orderId}/confirm-receipt:
 *   post:
 *     summary: Franchise staff xác nhận nhận hàng & gửi đánh giá (fulfilled -> confirmed)
 *     description: |
 *       Franchise staff xác nhận đã nhận hàng cho 1 đơn hàng đã giao (status = fulfilled),
 *       đồng thời gửi đánh giá (rating + comment).
 *       - Chỉ cho phép khi order thuộc franchise_store_id của staff
 *       - Chỉ cho phép khi status = fulfilled
 *       - Thành công sẽ chuyển status -> confirmed
 *     tags:
 *       - Franchise Store
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *                 example: "ok"
 *     responses:
 *       200:
 *         description: Confirm thành công (status -> confirmed)
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
 *                   example: "Đã xác nhận nhận hàng"
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_id:
 *                       type: integer
 *                       example: 4
 *                     order_code:
 *                       type: string
 *                       example: "ORD-006"
 *                     status:
 *                       type: string
 *                       example: "confirmed"
 *                     received_confirmed_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-02-27T10:20:00.000Z"
 *       400:
 *         description: Validate lỗi hoặc đơn không ở trạng thái fulfilled
 *         content:
 *           application/json:
 *             examples:
 *               invalidRating:
 *                 summary: rating không hợp lệ
 *                 value:
 *                   success: false
 *                   message: "rating phải từ 1 đến 5"
 *               notFulfilled:
 *                 summary: đơn chưa fulfilled
 *                 value:
 *                   success: false
 *                   message: "Chỉ xác nhận khi đơn ở trạng thái fulfilled"
 *       401:
 *         description: Unauthorized (không có token / token sai)
 *       403:
 *         description: Forbidden (không phải franchise staff / đơn không thuộc store)
 *       404:
 *         description: Không tìm thấy đơn hàng
 *       500:
 *         description: Server error
 */
router.post("/orders/:orderId/confirm-receipt", requireAuth, requireFranchiseStaff, receiveConfirmController.confirmReceipt);

/**
 * @swagger
 * /api/franchise/orders/receive-confirm:
 *   get:
 *     summary: Danh sách đơn cho màn Xác nhận nhận hàng (Tất cả/Đã giao/Đã xác nhận)
 *     description: |
 *       Trả về danh sách đơn của franchise store hiện tại để hiển thị trên màn "Xác nhận nhận hàng".
 *       filter:
 *       - all: (fulfilled + confirmed)
 *       - delivered: fulfilled
 *       - confirmed: confirmed
 *     tags: [Franchise Store]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, delivered, confirmed]
 *         example: delivered
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *         example: "ORD-00"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         example: 20
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       order_id:
 *                         type: integer
 *                         example: 4
 *                       order_code:
 *                         type: string
 *                         example: "ORD-006"
 *                       status:
 *                         type: string
 *                         example: "fulfilled"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       delivered_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       received_confirmed_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (franchise staff only)
 *       500:
 *         description: Server error
 */
router.get("/franchise/orders/receive-confirm", requireAuth, requireFranchiseStaff, receiveConfirmController.listOrders);


/**
 * @swagger
 * /api/centralKitchen/orders/{orderId}/start-processing:
 *   post:
 *     summary: Central Kitchen - Bắt đầu chuẩn bị (approved -> processing)
 *     tags: [Central Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *         example: 4
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Đơn không ở approved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 */
router.post("/centralKitchen/orders/:orderId/ready-to-deliver", requireAuth, requireKitchenStaff, centralKitchenOrderStatusController.readyToDeliver);

module.exports = router;
