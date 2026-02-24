const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController");
const { Fdashboard } = require("../controllers/franchiseStaff_dashboardController");
const { Cdashboard } = require("../controllers/CentralKitchen_dashboardController");
const { createOrder } = require("../controllers/orderController")
const { getOrders } = require("../controllers/orderController")
const CentralKitchen_CreateOrders = require("../controllers/CentralKitchen_CreateOrders");
const { requireKitchenStaff } = require("../middleware/requireKitchenStaff");

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


router.post("/CreateOrders", requireAuth, orderController.createOrder);

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


// Central Kitchen - New Orders page
router.get("/centralKitchen/orders/new", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.listNewOrders);
router.get("/centralKitchen/orders/:orderId", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.getNewOrderDetail);
router.post("/centralKitchen/orders/:orderId/approve", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.acceptNewOrder);
router.post("/centralKitchen/orders/:orderId/reject", requireAuth, requireKitchenStaff, CentralKitchen_CreateOrders.rejectNewOrder);

module.exports = router;