const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/admin/permissions.controller");

// Admin-panel routes (EMPLOYEE tokens).
router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER", "ADMIN", "EMPLOYEE"]));

router.get("/", c.list);

module.exports = router;
