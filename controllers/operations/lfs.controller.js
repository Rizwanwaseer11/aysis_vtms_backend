const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const { nextInvoice } = require("../../utils/invoice");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const AttendanceShift = require("../../models/AttendanceShift");
const MediaFile = require("../../models/MediaFile");
const Model = require("../../models/activities/LfsActivity");

/**
 * LFS Operation
 * Supervisor only. Transfer from GTS point to recycle/landfill.
 */

/**
 * POST /operations/lfs/shift/start
 * Body fields depend on operation role.
 */
async function startShift(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["shiftType","hrNumber","startLat","startLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    // Validate user
    const user = await User.findOne({ hrNumber: String(body.hrNumber).trim(), isActive: true, deletedAt: null });
    if (!user) return fail(res, "User not found", null, 404);
    if (user.operationType !== "LFS") return fail(res, "User operation mismatch", null, 400);

    // Vehicle is optional for some operations (GTS/LFS/GATE uses vehicle per activity)
    let vehicle = null;
    if (body.vehicleNumber) {
      vehicle = await Vehicle.findOne({ vehicleNumber: String(body.vehicleNumber).trim(), isActive: true });
      if (!vehicle) return fail(res, "Vehicle not found", null, 404);
    }

    const shift = await AttendanceShift.create({
      operationType: "LFS",
      shiftType: body.shiftType,
      supervisor: user.role === "SUPERVISOR" ? { userId: user._id, name: user.name, hrNumber: user.hrNumber } : { userId: null, name: "", hrNumber: "" },
      driver: user.role === "DRIVER" ? { userId: user._id, name: user.name, hrNumber: user.hrNumber } : { userId: null, name: "", hrNumber: "" },
      vehicle: vehicle ? {
        vehicleId: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleTypeName: vehicle.vehicleTypeName, ownership: vehicle.ownership
      } : { vehicleId: null, vehicleNumber: "", vehicleTypeName: "", ownership: "" },
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
 * POST /operations/lfs/activity
 */
async function createActivity(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["attendanceId","beforeLat","beforeLng","afterLat","afterLng","beforeMediaId","afterMediaId"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

if (!body.gtsPointId) return fail(res, "gtsPointId is required"); if (!body.vehicleNumber) return fail(res, "vehicleNumber is required");

    const shift = await AttendanceShift.findById(body.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "LFS") return fail(res, "Invalid shift operationType", null, 400);

    const { invoiceNo, monthKey } = await nextInvoice("LFS", null);

    const [beforeMedia, afterMedia] = await Promise.all([
      MediaFile.findById(body.beforeMediaId),
      MediaFile.findById(body.afterMediaId)
    ]);
    if (!beforeMedia) return fail(res, "beforeMediaId is invalid", null, 400);
    if (!afterMedia) return fail(res, "afterMediaId is invalid", null, 400);

    const doc = await Model.create({
      operationType: "LFS",
      invoiceNo,
      monthKey,
      status: "PENDING",
      attendanceId: shift._id,
      supervisor: shift.supervisor,
      driver: shift.driver,
      vehicle: body.vehicleNumber ? { ...shift.vehicle, vehicleNumber: String(body.vehicleNumber).trim() } : shift.vehicle,
      geo: {
        zoneId: body.zoneId || null,
        ucId: body.ucId || null,
        wardId: body.wardId || null,
        zoneName: body.zoneName || "",
        ucName: body.ucName || "",
        wardName: body.wardName || ""
      },
      before: { at: new Date(), lat: Number(body.beforeLat), lng: Number(body.beforeLng), mediaId: beforeMedia._id },
      after: { at: new Date(), lat: Number(body.afterLat), lng: Number(body.afterLng), mediaId: afterMedia._id },
      notes: String(body.notes || "").trim(),
      lfs: { gtsPointId: body.gtsPointId, gtsPointName: body.gtsPointName || "", visitCount: Number(body.visitCount || 1) }
    });

    await cache.del("dashboardKpis");
    await cache.del("lfsList");

    return ok(res, "lfs activity created", doc, null, 201);
  } catch (e) { next(e); }
}

/**
 * PATCH /operations/lfs/shift/:id/end
 */
async function endShift(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const required = ["endLat","endLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const shift = await AttendanceShift.findById(id);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);

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
 * GET /operations/lfs/list (admin table)
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

    const cacheKey = cache.key(["lfsList", JSON.stringify(filter), page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "lfs activities", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };
    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);

    return ok(res, "lfs activities", data, meta);
  } catch (e) { next(e); }
}

module.exports = { startShift, createActivity, endShift, list };
