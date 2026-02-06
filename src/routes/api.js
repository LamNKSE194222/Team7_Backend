const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController");
const { Fdashboard } = require("../controllers/franchiseStaff_dashboardController");
const { Cdashboard } = require("../controllers/CentralKitchen_dashboardController");

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
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
 *     RecentOrder:
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
 *           nullable: true
 *           format: date-time
 *           example: null
 *         product_count:
 *           type: integer
 *           example: 2
 *
 *     DashboardData:
 *       type: object
 *       properties:
 *         cards:
 *           $ref: '#/components/schemas/DashboardCards'
 *         recent_orders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RecentOrder'
 *
 *     DashboardResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/DashboardData'
 *         message:
 *           type: string
 *           nullable: true
 *           example: null
 */


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "storestaff1@moon.vn"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login success
 *       401:
 *         description: Invalid credentials
 */

router.post("/auth/login", authController.login);
router.get("/auth/me", requireAuth, authController.me);
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



router.post("/orders", requireAuth, orderController.create);
router.get("/orders", requireAuth, orderController.list);
router.get("/orders/:id", requireAuth, orderController.detail);

router.get("/health/db", async (req, res) => {
    try {
        const r = await pool.query("SELECT NOW() as now");
        res.json({ ok: true, now: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = router;
