const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const c = require("../../controllers/operations/gate.controller");

// Field operations routes (USER tokens)
router.use(authJwt);
router.use(requireRole(["SUPERVISOR","DRIVER","ADMIN","VTMS_OFFICER"]));

// Shift management
router.get("/shift/active", c.getActiveShift);
router.post("/shift/start", c.startShift);
router.patch("/shift/:id/end", c.endShift);

// Gate stats
router.get("/stats", c.stats);

// Vehicle lookup + activity lifecycle
router.get("/vehicle/:vehicleNumber", c.getVehicle);
router.get("/activity/open", c.getOpenActivity);
router.post("/activity/before", c.createBeforeActivity);
router.patch("/activity/:id/after", c.completeAfterActivity);
router.post("/activity", c.createActivity);

// Admin list view (EMPLOYEE tokens) can call this via separate endpoint if desired.
// For simplicity we keep it here; you can also mount under /admin/operations later.
router.get("/list", c.list);

module.exports = router;
