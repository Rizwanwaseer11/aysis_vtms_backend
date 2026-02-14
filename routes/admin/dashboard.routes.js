const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/admin/dashboard.controller");

router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER","ADMIN","EMPLOYEE"]));

router.get("/kpis", c.kpis);

module.exports = router;
