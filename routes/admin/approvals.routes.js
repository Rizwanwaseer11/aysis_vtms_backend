const router = require("express").Router();
const authJwt = require("../../middlewares/authJwt");
const requireRole = require("../../middlewares/requireRole");
const requirePermission = require("../../middlewares/requirePermission");
const c = require("../../controllers/admin/approvals.controller");

// Only VTMS officer or admin should approve/reject/edit.
router.use(authJwt);
router.use(requireRole(["VTMS_OFFICER","ADMIN"]));

router.get("/:operationType", requirePermission("OPERATIONS_APPROVE"), c.list);
router.patch("/:operationType/:id/approve", requirePermission("OPERATIONS_APPROVE"), c.approve);
router.patch("/:operationType/:id/reject", requirePermission("OPERATIONS_APPROVE"), c.reject);
router.patch("/:operationType/:id/edit", requirePermission("OPERATIONS_EDIT"), c.edit);

module.exports = router;
