const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/operations/fork.controller");
const geo = require("../../controllers/admin/geo.controller");
const bins = require("../../controllers/admin/bins.controller");

// Field operations routes (USER tokens)
router.use(authJwt);
router.use(requireRole(["SUPERVISOR","DRIVER","ADMIN"]));

router.get("/shift/active", c.getActiveShift);
router.post("/shift/start", c.startShift);
router.patch("/shift/:id/end", c.endShift);
router.patch("/shift/:id/stats", c.updateShiftStats);
router.post("/activity", c.createActivity);
router.get("/stats", c.stats);
router.get("/driver/:hrNumber", c.getDriver);

// Geo + bin lookups for fork (read-only)
router.get("/geo/zones", geo.listZones);
router.get("/geo/ucs", geo.listUCs);
router.get("/geo/wards", geo.listWards);
router.get("/bins", bins.listBin08);

// Admin list view (EMPLOYEE tokens) can call this via separate endpoint if desired.
// For simplicity we keep it here; you can also mount under /admin/operations later.
router.get("/list", c.list);

module.exports = router;
