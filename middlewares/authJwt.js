const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

/**
 * authJwt
 * Attaches req.auth = { kind: 'USER'|'EMPLOYEE', id, role, permissions? }
 */
function authJwt(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: token missing" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized: invalid token" });
  }
}

module.exports = authJwt;
