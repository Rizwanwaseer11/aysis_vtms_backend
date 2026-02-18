const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/media", require("./media.routes"));
router.use("/chat", require("./chat.routes"));

// admin panel (employees)
router.use("/admin/vehicle-types", require("./admin/vehicleTypes.routes"));
router.use("/admin/vehicles", require("./admin/vehicles.routes"));
router.use("/admin/users", require("./admin/users.routes"));
router.use("/admin/designations", require("./admin/designations.routes"));
router.use("/admin/permissions", require("./admin/permissions.routes"));
router.use("/admin/employees", require("./admin/employees.routes"));
router.use("/admin/geo", require("./admin/geo.routes"));
router.use("/admin/bins", require("./admin/bins.routes"));
router.use("/admin/points", require("./admin/points.routes"));
router.use("/admin/attendance", require("./admin/attendance.routes"));
router.use("/admin/dashboard", require("./admin/dashboard.routes"));
router.use("/admin/approvals", require("./admin/approvals.routes"));

// operations (field app)
router.use("/operations/gate", require("./operations/gate.routes"));
router.use("/operations/fork", require("./operations/fork.routes"));
router.use("/operations/flap", require("./operations/flap.routes"));
router.use("/operations/arm-roller", require("./operations/arm-roller.routes"));
router.use("/operations/bulk", require("./operations/bulk.routes"));
router.use("/operations/gts", require("./operations/gts.routes"));
router.use("/operations/lfs", require("./operations/lfs.routes"));

module.exports = router;
