const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const AuditLog = require("../../models/AuditLog");

const GateActivity = require("../../models/activities/GateActivity");
const ForkActivity = require("../../models/activities/ForkActivity");
const FlapActivity = require("../../models/activities/FlapActivity");
const ArmRollerActivity = require("../../models/activities/ArmRollerActivity");
const BulkActivity = require("../../models/activities/BulkActivity");
const GtsActivity = require("../../models/activities/GtsActivity");
const LfsActivity = require("../../models/activities/LfsActivity");

const MODEL_BY_OP = {
  GATE: GateActivity,
  FORK: ForkActivity,
  FLAP: FlapActivity,
  ARM_ROLLER: ArmRollerActivity,
  BULK: BulkActivity,
  GTS: GtsActivity,
  LFS: LfsActivity
};

function getModel(operationType) {
  const key = String(operationType || "").toUpperCase();
  return MODEL_BY_OP[key] || null;
}

/**
 * GET /admin/approvals/:operationType
 * filters: status (default PENDING), month, startDate/endDate, invoice, driverHr, supervisorHr
 */
async function list(req, res, next) {
  try {
    const { operationType } = req.params;
    const Model = getModel(operationType);
    if (!Model) return fail(res, "Invalid operationType", null, 400);

    const { page, perPage, limit, skip } = parsePagination(req.query);

    const status = (req.query.status || "PENDING").toUpperCase();
    const filter = { status };

    if (req.query.month) filter.monthKey = req.query.month;
    if (req.query.invoice) filter.invoiceNo = String(req.query.invoice).trim();
    if (req.query.driverHr) filter["driver.hrNumber"] = String(req.query.driverHr).trim();
    if (req.query.supervisorHr) filter["supervisor.hrNumber"] = String(req.query.supervisorHr).trim();

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Approvals list", { items }, meta);
  } catch (e) { next(e); }
}

/**
 * PATCH /admin/approvals/:operationType/:id/approve
 */
async function approve(req, res, next) {
  try {
    const { operationType, id } = req.params;
    const Model = getModel(operationType);
    if (!Model) return fail(res, "Invalid operationType", null, 400);

    const doc = await Model.findById(id);
    if (!doc) return fail(res, "Activity not found", null, 404);

    if (doc.status !== "PENDING") return fail(res, "Only PENDING can be approved", null, 400);

    doc.status = "APPROVED";
    doc.reviewedBy.employeeId = req.auth.id;
    doc.reviewedBy.name = req.auth.name || "";
    doc.reviewedBy.at = new Date();
    doc.reviewedBy.notes = String((req.body || {}).notes || "").trim();

    await doc.save();

    await AuditLog.create({
      actorKind: "EMPLOYEE",
      actorId: req.auth.id,
      action: "ACTIVITY_APPROVED",
      entityType: Model.modelName,
      entityId: doc._id,
      meta: { operationType: doc.operationType, invoiceNo: doc.invoiceNo }
    });

    return ok(res, "Approved", doc);
  } catch (e) { next(e); }
}

/**
 * PATCH /admin/approvals/:operationType/:id/reject
 */
async function reject(req, res, next) {
  try {
    const { operationType, id } = req.params;
    const Model = getModel(operationType);
    if (!Model) return fail(res, "Invalid operationType", null, 400);

    const { notes } = req.body || {};
    if (!notes) return fail(res, "notes is required for rejection");

    const doc = await Model.findById(id);
    if (!doc) return fail(res, "Activity not found", null, 404);

    if (doc.status !== "PENDING") return fail(res, "Only PENDING can be rejected", null, 400);

    doc.status = "REJECTED";
    doc.reviewedBy.employeeId = req.auth.id;
    doc.reviewedBy.name = req.auth.name || "";
    doc.reviewedBy.at = new Date();
    doc.reviewedBy.notes = String(notes).trim();

    await doc.save();

    await AuditLog.create({
      actorKind: "EMPLOYEE",
      actorId: req.auth.id,
      action: "ACTIVITY_REJECTED",
      entityType: Model.modelName,
      entityId: doc._id,
      meta: { operationType: doc.operationType, invoiceNo: doc.invoiceNo, notes: doc.reviewedBy.notes }
    });

    return ok(res, "Rejected", doc);
  } catch (e) { next(e); }
}

/**
 * PATCH /admin/approvals/:operationType/:id/edit
 * Admin/Officer can edit fields (including media IDs) as needed.
 * NOTE: Controller-level validation keeps things safe.
 */
async function edit(req, res, next) {
  try {
    const { operationType, id } = req.params;
    const Model = getModel(operationType);
    if (!Model) return fail(res, "Invalid operationType", null, 400);

    const doc = await Model.findById(id);
    if (!doc) return fail(res, "Activity not found", null, 404);

    // Only allow edit by VTMS officer / admin employee (handled by route middleware permission)
    const body = req.body || {};

    // Generic safe edits
    if (body.notes !== undefined) doc.notes = String(body.notes).trim();
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase();
      if (!["PENDING","APPROVED","REJECTED"].includes(s)) return fail(res, "Invalid status");
      doc.status = s;
    }

    // Proofs
    if (body.beforeMediaId !== undefined) doc.before.mediaId = body.beforeMediaId || null;
    if (body.afterMediaId !== undefined) doc.after.mediaId = body.afterMediaId || null;

    await doc.save();

    await AuditLog.create({
      actorKind: "EMPLOYEE",
      actorId: req.auth.id,
      action: "ACTIVITY_EDITED",
      entityType: Model.modelName,
      entityId: doc._id,
      meta: { operationType: doc.operationType, invoiceNo: doc.invoiceNo, patch: body }
    });

    return ok(res, "Activity updated", doc);
  } catch (e) { next(e); }
}

module.exports = { list, approve, reject, edit };
