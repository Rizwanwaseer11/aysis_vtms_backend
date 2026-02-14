const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/admin/points.controller");

router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER","ADMIN","EMPLOYEE"]));

router.get("/kundi", c.listKundis);
router.post("/kundi", c.createKundi);

router.get("/gts", c.listGts);
router.post("/gts", c.createGts);

module.exports = router;
