const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/admin/bins.controller");

router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER","ADMIN","EMPLOYEE"]));

router.get("/bin08", c.listBin08);
router.post("/bin08", c.createBin08);
router.patch("/bin08/:id", c.updateBin08);

router.get("/bin5", c.listBin5);
router.post("/bin5", c.createBin5);

module.exports = router;
