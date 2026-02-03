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
 *      schema:
 *          dashboard:
 *              type: object
 *              properties:
 *                  _
 *          
 */

/**
 * @swagger
 * /api/franchiseStaff_dashboard:
 * get:
 *      summary: To come to the dashboard of franchise staff
 *      description: this api is use to fetch data from database
 *      response: 
 *          200:
 *              description: this api is use to fetch data from database
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *                          items:
 *                              $ref: #components/schema/dashboard
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
