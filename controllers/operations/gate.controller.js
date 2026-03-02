const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const { nextInvoice } = require("../../utils/invoice");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const AttendanceShift = require("../../models/AttendanceShift");
const MediaFile = require("../../models/MediaFile");
const Model = require("../../models/activities/GateActivity");

/**
 * GATE Operation
 * Supervisor records vehicles leaving/returning yard. Vehicle number captured per activity.
 */

function requireGateUser(req, res) {
  if (req.auth?.kind !== "USER") {
    fail(res, "Forbidden: USER token required", null, 403);
    return false;
  }
  if (req.auth.role !== "ADMIN" && req.auth.operationType !== "GATE") {
    fail(res, "User operation mismatch", null, 403);
    return false;
  }
  return true;
}

function mustBeSelfOrAdmin(req, hrNumber) {
  const tokenHr = String(req.auth?.hrNumber || "").trim().toUpperCase();
  if (req.auth?.role === "ADMIN") return true;
  if (!tokenHr) return false;
  return tokenHr === String(hrNumber || "").trim().toUpperCase();
}

function parseDateOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /operations/gate/shift/active
 * Returns active shift for current supervisor.
 */
async function getActiveShift(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const hrNumber =
      req.auth.role === "ADMIN" && req.query.hrNumber
        ? String(req.query.hrNumber).trim().toUpperCase()
        : String(req.auth.hrNumber || "").trim().toUpperCase();
    if (!hrNumber) return ok(res, "Active shift", null);

    const shift = await AttendanceShift.findOne({
      operationType: "GATE",
      status: "ONWORK",
      "supervisor.hrNumber": hrNumber
    })
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, "Active shift", shift || null);
  } catch (e) { next(e); }
}

/**
 * POST /operations/gate/shift/start
 * Body: { shiftType, hrNumber, startLat, startLng, supervisorMediaUrl? }
 */
async function startShift(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const body = req.body || {};
    const required = ["shiftType", "hrNumber", "startLat", "startLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const normalizedHr = String(body.hrNumber).trim().toUpperCase();
    if (!mustBeSelfOrAdmin(req, normalizedHr)) {
      return fail(res, "hrNumber does not match logged in user", null, 403);
    }

    // Validate user
    const user = await User.findOne({
      hrNumber: normalizedHr,
      isActive: true,
      deletedAt: null
    });
    if (!user) return fail(res, "HR number not found", null, 404);
    if (user.operationType !== "GATE") return fail(res, "User operation mismatch", null, 400);

    // Vehicle is optional for GATE shifts
    let vehicle = null;
    if (body.vehicleNumber) {
      vehicle = await Vehicle.findOne({ vehicleNumber: String(body.vehicleNumber).trim(), isActive: true });
      if (!vehicle) return fail(res, "Vehicle not found", null, 404);
    }

    const shift = await AttendanceShift.create({
      operationType: "GATE",
      shiftType: body.shiftType,
      supervisor: user.role === "SUPERVISOR"
        ? { userId: user._id, name: user.name, hrNumber: user.hrNumber }
        : { userId: null, name: "", hrNumber: "" },
      driver: user.role === "DRIVER"
        ? { userId: user._id, name: user.name, hrNumber: user.hrNumber }
        : { userId: null, name: "", hrNumber: "" },
      vehicle: vehicle
        ? { vehicleId: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleTypeName: vehicle.vehicleTypeName, ownership: vehicle.ownership }
        : { vehicleId: null, vehicleNumber: "", vehicleTypeName: "", ownership: "" },
      status: "ONWORK",
      start: {
        at: new Date(),
        lat: Number(body.startLat),
        lng: Number(body.startLng),
        supervisorMediaUrl: String(body.supervisorMediaUrl || ""),
        driverMediaUrl: String(body.driverMediaUrl || "")
      }
    });

    return ok(res, "Shift started", shift, null, 201);
  } catch (e) { next(e); }
}

/**
 * PATCH /operations/gate/shift/:id/end
 */
async function endShift(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const { id } = req.params;
    const body = req.body || {};
    const required = ["endLat", "endLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const shift = await AttendanceShift.findById(id);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "GATE") return fail(res, "Invalid shift operationType", null, 400);
    if (shift.status !== "ONWORK") return fail(res, "Shift already completed", null, 409);

    if (
      req.auth.role !== "ADMIN" &&
      String(shift.supervisor?.hrNumber || "").toUpperCase() !== String(req.auth.hrNumber || "").toUpperCase()
    ) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    shift.status = "COMPLETED";
    shift.end = {
      at: new Date(),
      lat: Number(body.endLat),
      lng: Number(body.endLng),
      supervisorMediaUrl: String(body.supervisorMediaUrl || ""),
      driverMediaUrl: String(body.driverMediaUrl || "")
    };
    await shift.save();

    return ok(res, "Shift ended", shift);
  } catch (e) { next(e); }
}

/**
 * GET /operations/gate/vehicle/:vehicleNumber
 * Lightweight lookup for supervisor flow.
 */
async function getVehicle(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const vehicleNumber = String(req.params.vehicleNumber || "").trim();
    if (!vehicleNumber) return fail(res, "vehicleNumber is required");

    const vehicle = await Vehicle.findOne({ vehicleNumber, isActive: true }).lean();
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    return ok(res, "Vehicle", {
      id: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleTypeName: vehicle.vehicleTypeName,
      ownership: vehicle.ownership
    });
  } catch (e) { next(e); }
}

/**
 * GET /operations/gate/activity/open?vehicleNumber=...
 * Returns open activity (before captured, after pending).
 */
async function getOpenActivity(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const vehicleNumber = String(req.query.vehicleNumber || "").trim();
    if (!vehicleNumber) return fail(res, "vehicleNumber is required");

    const filter = {
      operationType: "GATE",
      deletedAt: null,
      "vehicle.vehicleNumber": vehicleNumber,
      "after.at": null
    };
    if (req.query.attendanceId) filter.attendanceId = req.query.attendanceId;
    if (req.auth.role !== "ADMIN" && req.auth.hrNumber) {
      filter["supervisor.hrNumber"] = String(req.auth.hrNumber).toUpperCase();
    }

    const doc = await Model.findOne(filter).sort({ createdAt: -1 }).lean();
    return ok(res, "Open activity", doc || null);
  } catch (e) { next(e); }
}

/**
 * POST /operations/gate/activity/before
 * Starts a new vehicle trip (OUT).
 */
async function createBeforeActivity(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const body = req.body || {};
    const required = ["attendanceId", "vehicleNumber", "beforeLat", "beforeLng", "beforeMediaId"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const shift = await AttendanceShift.findById(body.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "GATE") return fail(res, "Invalid shift operationType", null, 400);
    if (shift.status !== "ONWORK") return fail(res, "Shift is not active", null, 409);
    if (
      req.auth.role !== "ADMIN" &&
      String(shift.supervisor?.hrNumber || "").toUpperCase() !== String(req.auth.hrNumber || "").toUpperCase()
    ) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    const vehicleNumber = String(body.vehicleNumber).trim();
    const vehicle = await Vehicle.findOne({ vehicleNumber, isActive: true });
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    const open = await Model.findOne({
      operationType: "GATE",
      deletedAt: null,
      "vehicle.vehicleNumber": vehicleNumber,
      "after.at": null
    }).lean();
    if (open) return fail(res, "Vehicle already has open gate activity", { openActivityId: open._id }, 409);

    const beforeMedia = await MediaFile.findById(body.beforeMediaId);
    if (!beforeMedia) return fail(res, "beforeMediaId is invalid", null, 400);

    const { invoiceNo, monthKey } = await nextInvoice("GATE", null);

    const doc = await Model.create({
      operationType: "GATE",
      invoiceNo,
      monthKey,
      status: "PENDING",
      attendanceId: shift._id,
      supervisor: shift.supervisor,
      driver: shift.driver,
      vehicle: {
        vehicleId: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleTypeName: vehicle.vehicleTypeName,
        ownership: vehicle.ownership
      },
      geo: {
        zoneId: body.zoneId || null,
        ucId: body.ucId || null,
        wardId: body.wardId || null,
        zoneName: body.zoneName || "",
        ucName: body.ucName || "",
        wardName: body.wardName || ""
      },
      before: {
        at: parseDateOrNow(body.beforeAt),
        lat: Number(body.beforeLat),
        lng: Number(body.beforeLng),
        mediaId: beforeMedia._id
      },
      after: {
        at: null,
        lat: null,
        lng: null,
        mediaId: null
      },
      notes: String(body.notes || "").trim(),
      gate: { gtsPointId: body.gtsPointId || null, gtsPointName: body.gtsPointName || "", eventType: "OUT" }
    });

    await cache.del("dashboardKpis");
    await cache.del("gateList");

    return ok(res, "gate activity started", doc, null, 201);
  } catch (e) { next(e); }
}

/**
 * PATCH /operations/gate/activity/:id/after
 * Completes a trip (IN).
 */
async function completeAfterActivity(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const { id } = req.params;
    const body = req.body || {};
    const required = ["afterLat", "afterLng", "afterMediaId"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const doc = await Model.findById(id);
    if (!doc) return fail(res, "Gate activity not found", null, 404);
    if (doc.operationType !== "GATE") return fail(res, "Invalid operation type", null, 400);
    if (doc.after?.at) return fail(res, "Gate activity already completed", null, 409);

    const shift = await AttendanceShift.findById(doc.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.status !== "ONWORK") return fail(res, "Shift is not active", null, 409);
    if (req.auth.role !== "ADMIN" && shift.supervisor?.hrNumber !== req.auth.hrNumber) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    const afterMedia = await MediaFile.findById(body.afterMediaId);
    if (!afterMedia) return fail(res, "afterMediaId is invalid", null, 400);

    doc.after = {
      at: parseDateOrNow(body.afterAt),
      lat: Number(body.afterLat),
      lng: Number(body.afterLng),
      mediaId: afterMedia._id
    };
    doc.notes = String(body.notes || "").trim();
    doc.gate = { ...doc.gate, eventType: "INOUT" };

    await doc.save();
    await cache.del("dashboardKpis");
    await cache.del("gateList");

    return ok(res, "gate activity completed", doc);
  } catch (e) { next(e); }
}

/**
 * POST /operations/gate/activity
 * Legacy endpoint (before + after in one request).
 */
async function createActivity(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const body = req.body || {};
    const required = ["attendanceId", "beforeLat", "beforeLng", "afterLat", "afterLng", "beforeMediaId", "afterMediaId"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);
    if (!body.vehicleNumber) return fail(res, "vehicleNumber is required");

    const shift = await AttendanceShift.findById(body.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "GATE") return fail(res, "Invalid shift operationType", null, 400);
    if (shift.status !== "ONWORK") return fail(res, "Shift is not active", null, 409);
    if (req.auth.role !== "ADMIN" && shift.supervisor?.hrNumber !== req.auth.hrNumber) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    const vehicleNumber = String(body.vehicleNumber).trim();
    const vehicle = await Vehicle.findOne({ vehicleNumber, isActive: true });
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    const [beforeMedia, afterMedia] = await Promise.all([
      MediaFile.findById(body.beforeMediaId),
      MediaFile.findById(body.afterMediaId)
    ]);
    if (!beforeMedia) return fail(res, "beforeMediaId is invalid", null, 400);
    if (!afterMedia) return fail(res, "afterMediaId is invalid", null, 400);

    const { invoiceNo, monthKey } = await nextInvoice("GATE", null);

    const doc = await Model.create({
      operationType: "GATE",
      invoiceNo,
      monthKey,
      status: "PENDING",
      attendanceId: shift._id,
      supervisor: shift.supervisor,
      driver: shift.driver,
      vehicle: {
        vehicleId: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleTypeName: vehicle.vehicleTypeName,
        ownership: vehicle.ownership
      },
      geo: {
        zoneId: body.zoneId || null,
        ucId: body.ucId || null,
        wardId: body.wardId || null,
        zoneName: body.zoneName || "",
        ucName: body.ucName || "",
        wardName: body.wardName || ""
      },
      before: { at: parseDateOrNow(body.beforeAt), lat: Number(body.beforeLat), lng: Number(body.beforeLng), mediaId: beforeMedia._id },
      after: { at: parseDateOrNow(body.afterAt), lat: Number(body.afterLat), lng: Number(body.afterLng), mediaId: afterMedia._id },
      notes: String(body.notes || "").trim(),
      gate: { gtsPointId: body.gtsPointId || null, gtsPointName: body.gtsPointName || "", eventType: "INOUT" }
    });

    await cache.del("dashboardKpis");
    await cache.del("gateList");

    return ok(res, "gate activity created", doc, null, 201);
  } catch (e) { next(e); }
}

/**
 * GET /operations/gate/stats
 * Returns "vehicles in field" and "proceed today".
 */
async function stats(req, res, next) {
  try {
    if (!requireGateUser(req, res)) return;
    const filter = { operationType: "GATE", deletedAt: null };

    let attendanceId = req.query.attendanceId;
    if (!attendanceId && req.auth.role !== "ADMIN" && req.auth.hrNumber) {
      const activeShift = await AttendanceShift.findOne({
        operationType: "GATE",
        status: "ONWORK",
        "supervisor.hrNumber": req.auth.hrNumber
      }).sort({ createdAt: -1 }).lean();
      if (activeShift) attendanceId = activeShift._id;
    }

    if (attendanceId) filter.attendanceId = attendanceId;

    const todayStart = startOfToday();
    const [inField, proceedToday] = await Promise.all([
      Model.countDocuments({ ...filter, "after.at": null }),
      Model.countDocuments({ ...filter, createdAt: { $gte: todayStart } })
    ]);

    return ok(res, "gate stats", { inField, proceedToday, attendanceId: attendanceId || null });
  } catch (e) { next(e); }
}

/**
 * GET /operations/gate/list (admin table)
 */
async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.month) filter.monthKey = req.query.month;
    if (req.query.invoice) filter.invoiceNo = String(req.query.invoice).trim();
    if (req.query.driverHr) filter["driver.hrNumber"] = String(req.query.driverHr).trim();
    if (req.query.supervisorHr) filter["supervisor.hrNumber"] = String(req.query.supervisorHr).trim();
    if (req.query.vehicleNumber) filter["vehicle.vehicleNumber"] = String(req.query.vehicleNumber).trim();

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const cacheKey = cache.key(["gateList", JSON.stringify(filter), page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "gate activities", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };
    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);

    return ok(res, "gate activities", data, meta);
  } catch (e) { next(e); }
}

module.exports = {
  getActiveShift,
  startShift,
  endShift,
  getVehicle,
  getOpenActivity,
  createBeforeActivity,
  completeAfterActivity,
  createActivity,
  stats,
  list
};
