/**
 * requireRole
 * Example: requireRole(['ADMIN']) or requireRole(['SUPERVISOR','DRIVER'])
 * Works for USER and EMPLOYEE tokens.
 */
function requireRole(roles = []) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = requireRole;
