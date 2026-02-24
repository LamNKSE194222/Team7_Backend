function requireFranchiseStaff(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.franchise_store_id) {
        return res.status(403).json({
            success: false,
            message: "Chỉ franchise staff mới được phép truy cập",
            error_code: "FORBIDDEN",
        });
    }

    next();
}

module.exports = { requireFranchiseStaff };