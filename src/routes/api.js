const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController");
const franchiseStaff_dashboardController = require("../controllers/franchiseStaff_dashboardController");


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
router.get("/franchiseStaff_dashboard", requireAuth, franchiseStaff_dashboardController.dashboard);

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
 * /api/franchiseStaff_dashboard:
 *   get:
 *     summary: Franchise staff dashboard
 *     description: Fetch dashboard data for franchise staff
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
