const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/admin/geo.controller");

router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER","ADMIN","EMPLOYEE"]));

router.get("/zones", c.listZones);
router.post("/zones", c.createZone);

router.get("/ucs", c.listUCs);
router.post("/ucs", c.createUC);

router.get("/wards", c.listWards);
router.post("/wards", c.createWard);

module.exports = router;
