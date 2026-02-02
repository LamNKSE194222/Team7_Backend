const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController");
const dashboardController = require("../controllers/franchiseStaff_dashboardController");

router.post("/auth/login", authController.login);
router.get("/auth/me", requireAuth, authController.me);

router.get("/products", requireAuth, productController.list);
router.get("/dashboard", requireAuth, dashboardController.dashboard);

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
