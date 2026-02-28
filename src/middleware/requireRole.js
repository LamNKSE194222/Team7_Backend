function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: requires role ${allowedRoles.join(" or ")}`
            });
        }

        next();
    };
}

module.exports = { requireRole };