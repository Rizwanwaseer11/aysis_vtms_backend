const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const { haversineMeters } = require("../../utils/geo");
const { nextInvoice } = require("../../utils/invoice");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const Bin08 = require("../../models/Bin08");
const AttendanceShift = require("../../models/AttendanceShift");
const MediaFile = require("../../models/MediaFile");
const ForkActivity = require("../../models/activities/ForkActivity");

/**
 * FORK Operation
 * - Supervisor + Driver
 * - Works only on 0.8 bins (Bin08)
 */

/**
 * POST /operations/fork/shift/start
 * Body:
 *  {
 *    shiftType, supervisorHr, driverHr, vehicleNumber,
 *    startLat, startLng,
 *    supervisorMediaUrl, driverMediaUrl
 *  }
 */
async function startShift(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["shiftType", "supervisorHr", "driverHr", "vehicleNumber", "startLat", "startLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    // Validate supervisor identity
    const supervisor = await User.findOne({ hrNumber: String(body.supervisorHr).trim(), isActive: true, deletedAt: null });
    if (!supervisor) return fail(res, "Supervisor not found", null, 404);
    if (supervisor.operationType !== "FORK") return fail(res, "Supervisor operation is not FORK", null, 400);

    const driver = await User.findOne({ hrNumber: String(body.driverHr).trim(), isActive: true, deletedAt: null });
    if (!driver) return fail(res, "Driver not found", null, 404);

    const vehicle = await Vehicle.findOne({ vehicleNumber: String(body.vehicleNumber).trim(), isActive: true });
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    // Create shift record
    const shift = await AttendanceShift.create({
      operationType: "FORK",
      shiftType: body.shiftType,
      supervisor: { userId: supervisor._id, name: supervisor.name, hrNumber: supervisor.hrNumber },
      driver: { userId: driver._id, name: driver.name, hrNumber: driver.hrNumber },
      vehicle: { vehicleId: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleTypeName: vehicle.vehicleTypeName, ownership: vehicle.ownership },
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
 * POST /operations/fork/activity
 * Body:
 *  {
 *    attendanceId,
 *    zoneId, ucId, wardId,
 *    binId OR manualBinNumber,
 *    beforeLat, beforeLng, afterLat, afterLng,
 *    beforeMediaId, afterMediaId,
 *    notes
 *  }
 */
async function createActivity(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["attendanceId","zoneId","ucId","wardId","beforeLat","beforeLng","afterLat","afterLng","beforeMediaId","afterMediaId"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    if (!body.binId && !body.manualBinNumber) {
      return fail(res, "binId or manualBinNumber is required");
    }

    const shift = await AttendanceShift.findById(body.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "FORK") return fail(res, "Invalid shift operationType", null, 400);

    // Generate invoice
    const { invoiceNo, monthKey } = await nextInvoice("FORK", null);

    // Get bin info for radius check if binId provided
    let bin = null;
    let placed = null;
    let distanceM = null;
    let defaultLat = null;
    let defaultLng = null;
    let radiusM = null;
    let binNumber = "";

    if (body.binId) {
      bin = await Bin08.findById(body.binId);
      if (!bin) return fail(res, "Bin not found", null, 404);

      binNumber = bin.binNumber;
      defaultLat = bin.lat;
      defaultLng = bin.lng;
      radiusM = bin.radiusM;

      distanceM = haversineMeters(defaultLat, defaultLng, Number(body.beforeLat), Number(body.beforeLng));
      placed = distanceM <= radiusM;
    } else {
      binNumber = String(body.manualBinNumber).trim();
    }

    // Validate media existence (optional but recommended)
    const [beforeMedia, afterMedia] = await Promise.all([
      MediaFile.findById(body.beforeMediaId),
      MediaFile.findById(body.afterMediaId)
    ]);
    if (!beforeMedia) return fail(res, "beforeMediaId is invalid", null, 400);
    if (!afterMedia) return fail(res, "afterMediaId is invalid", null, 400);

    const doc = await ForkActivity.create({
      operationType: "FORK",
      invoiceNo,
      monthKey,
      status: "PENDING",
      attendanceId: shift._id,

      supervisor: shift.supervisor,
      driver: shift.driver,
      vehicle: shift.vehicle,

      geo: { zoneId: body.zoneId, ucId: body.ucId, wardId: body.wardId },

      before: { at: new Date(), lat: Number(body.beforeLat), lng: Number(body.beforeLng), mediaId: beforeMedia._id },
      after: { at: new Date(), lat: Number(body.afterLat), lng: Number(body.afterLng), mediaId: afterMedia._id },

      notes: String(body.notes || "").trim(),

      fork: {
        binId: bin ? bin._id : null,
        binNumber,
        manualBinNumber: bin ? "" : binNumber,
        radiusM,
        defaultLat,
        defaultLng,
        distanceM,
        placed
      }
    });

    // Cache invalidation for list + KPIs
    await cache.del("dashboardKpis");
    await cache.del("approvals");
    await cache.del("forkList");

    return ok(res, "Fork activity created", doc, null, 201);
  } catch (e) { next(e); }
}

/**
 * PATCH /operations/fork/shift/:id/end
 * Body: { endLat, endLng, supervisorMediaUrl, driverMediaUrl }
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
    if (shift.status === "COMPLETED") return ok(res, "Shift already completed", shift);

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
 * GET /operations/fork/list (admin table)
 * filters: status, month, startDate/endDate, invoice, driverHr, supervisorHr, placed
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
    if (req.query.placed !== undefined) filter["fork.placed"] = req.query.placed === "true";

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const cacheKey = cache.key(["forkList", JSON.stringify(filter), page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "Fork activities", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      ForkActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ForkActivity.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };

    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);
    return ok(res, "Fork activities", data, meta);
  } catch (e) { next(e); }
}

module.exports = { startShift, createActivity, endShift, list };
