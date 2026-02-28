const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ success: false, message: "Missing token" });

<<<<<<< HEAD
=======

>>>>>>> 2908730f5ccfd86b38feed9a459e69bdf9821e49
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
}

module.exports = { requireAuth };
