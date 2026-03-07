function requireManager(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    if (req.user.role !== "manager") {
        return res.status(403).json({
            success: false,
            message: "Forbidden: manager only",
        });
    }

    next();
}

module.exports = { requireManager };