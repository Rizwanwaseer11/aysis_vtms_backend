/**
 * requirePermission
 * Only meaningful for EMPLOYEE tokens (admin panel staff).
 * req.auth.permissions should include permission keys.
 */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    const kind = req.auth?.kind;
    if (kind !== "EMPLOYEE") {
      return res.status(403).json({ success: false, message: "Forbidden: employee permission required" });
    }

    const perms = req.auth?.permissions || [];
    if (!perms.includes(permissionKey)) {
      return res.status(403).json({ success: false, message: "Forbidden: missing permission" });
    }
    next();
  };
}

module.exports = requirePermission;
