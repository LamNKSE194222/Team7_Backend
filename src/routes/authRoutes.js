const express = require("express");
const router = express.Router();
const { login, me } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); // nếu có

router.post("/login", login);
router.get("/me", verifyToken, me); // optional

module.exports = router;
