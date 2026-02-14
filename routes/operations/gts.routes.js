const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/operations/gts.controller");

// Field operations routes (USER tokens)
router.use(authJwt);
router.use(requireRole(["SUPERVISOR","DRIVER","ADMIN"]));

router.post("/shift/start", c.startShift);
router.patch("/shift/:id/end", c.endShift);
router.post("/activity", c.createActivity);

// Admin list view (EMPLOYEE tokens) can call this via separate endpoint if desired.
// For simplicity we keep it here; you can also mount under /admin/operations later.
router.get("/list", c.list);

module.exports = router;
