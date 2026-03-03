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

function requireForkUser(req, res) {
  if (req.auth?.kind !== "USER") {
    fail(res, "Forbidden: USER token required", null, 403);
    return false;
  }
  if (req.auth.role !== "ADMIN" && req.auth.operationType !== "FORK") {
    fail(res, "User operation mismatch", null, 403);
    return false;
  }
  return true;
}

function parseDateOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeVehicleNumber(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function vehicleNumberRegex(value) {
  const normalized = normalizeVehicleNumber(value);
  if (!normalized) return null;
  const escaped = normalized.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join("[^A-Z0-9]*")}$`, "i");
}

function normalizeHr(value) {
  return String(value || "").trim().toUpperCase();
}

function mustBelongToShift(req, shift) {
  if (req.auth.role === "ADMIN") return true;
  const tokenHr = normalizeHr(req.auth.hrNumber);
  if (!tokenHr) return false;
  return (
    tokenHr === normalizeHr(shift.supervisor?.hrNumber) ||
    tokenHr === normalizeHr(shift.driver?.hrNumber)
  );
}

/**
 * GET /operations/fork/shift/active
 * Returns active shift for current supervisor/driver.
 */
async function getActiveShift(req, res, next) {
  try {
    if (!requireForkUser(req, res)) return;
    const hrNumber =
      req.auth.role === "ADMIN" && req.query.hrNumber
        ? normalizeHr(req.query.hrNumber)
        : normalizeHr(req.auth.hrNumber || "");
    if (!hrNumber) return ok(res, "Active shift", null);

    const shift = await AttendanceShift.findOne({
      operationType: "FORK",
      status: "ONWORK",
      $or: [{ "supervisor.hrNumber": hrNumber }, { "driver.hrNumber": hrNumber }]
    })
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, "Active shift", shift || null);
  } catch (e) { next(e); }
}

/**
 * GET /operations/fork/driver/:hrNumber
 * Lightweight driver lookup for validation.
 */
async function getDriver(req, res, next) {
  try {
    if (!requireForkUser(req, res)) return;
    const hrNumber = normalizeHr(req.params.hrNumber);
    if (!hrNumber) return fail(res, "hrNumber is required");

    const driver = await User.findOne({ hrNumber, isActive: true, deletedAt: null }).lean();
    if (!driver) return fail(res, "Driver not found", null, 404);
    if (driver.role !== "DRIVER") return fail(res, "User is not a driver", null, 400);
    if (driver.operationType !== "FORK") return fail(res, "Driver operation is not FORK", null, 400);

    return ok(res, "Driver", {
      id: driver._id,
      name: driver.name,
      hrNumber: driver.hrNumber,
      role: driver.role,
      operationType: driver.operationType
    });
  } catch (e) { next(e); }
}

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
    if (!requireForkUser(req, res)) return;
    const body = req.body || {};
    const required = ["shiftType", "supervisorHr", "driverHr", "vehicleNumber", "startLat", "startLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    // Validate supervisor identity
    const supervisorHr = normalizeHr(body.supervisorHr);
    const driverHr = normalizeHr(body.driverHr);

    if (req.auth.role !== "ADMIN") {
      const tokenHr = normalizeHr(req.auth.hrNumber);
      if (req.auth.role === "SUPERVISOR" && tokenHr !== supervisorHr) {
        return fail(res, "supervisorHr does not match logged in user", null, 403);
      }
      if (req.auth.role === "DRIVER" && tokenHr !== driverHr) {
        return fail(res, "driverHr does not match logged in user", null, 403);
      }
    }

    const supervisor = await User.findOne({ hrNumber: supervisorHr, isActive: true, deletedAt: null });
    if (!supervisor) return fail(res, "Supervisor not found", null, 404);
    if (supervisor.role !== "SUPERVISOR") return fail(res, "Supervisor role is invalid", null, 400);
    if (supervisor.operationType !== "FORK") return fail(res, "Supervisor operation is not FORK", null, 400);

    const driver = await User.findOne({ hrNumber: driverHr, isActive: true, deletedAt: null });
    if (!driver) return fail(res, "Driver not found", null, 404);
    if (driver.role !== "DRIVER") return fail(res, "Driver role is invalid", null, 400);
    if (driver.operationType !== "FORK") return fail(res, "Driver operation is not FORK", null, 400);

    const vehicleNumber = String(body.vehicleNumber || "").trim().toUpperCase();
    const regex = vehicleNumberRegex(vehicleNumber);
    const vehicle = await Vehicle.findOne({ vehicleNumber: regex || vehicleNumber, isActive: true });
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    const existingShift = await AttendanceShift.findOne({
      operationType: "FORK",
      status: "ONWORK",
      $or: [
        { "supervisor.hrNumber": supervisor.hrNumber },
        { "driver.hrNumber": driver.hrNumber }
      ]
    }).lean();
    if (existingShift) {
      return fail(res, "An active shift already exists", { shiftId: existingShift._id }, 409);
    }

    // Create shift record
    const shift = await AttendanceShift.create({
      operationType: "FORK",
      shiftType: body.shiftType,
      supervisor: { userId: supervisor._id, name: supervisor.name, hrNumber: supervisor.hrNumber },
      driver: { userId: driver._id, name: driver.name, hrNumber: driver.hrNumber },
      vehicle: { vehicleId: vehicle._id, vehicleNumber: vehicle.vehicleNumber, vehicleTypeName: vehicle.vehicleTypeName, ownership: vehicle.ownership },
      status: "ONWORK",
      forkStats: { gtsTrips: 0, laborers: 0 },
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
    if (!requireForkUser(req, res)) return;
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
    if (shift.status !== "ONWORK") return fail(res, "Shift is not active", null, 409);
    if (!mustBelongToShift(req, shift)) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

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
    let zoneId = body.zoneId;
    let ucId = body.ucId;
    let wardId = body.wardId;
    let zoneName = body.zoneName || "";
    let ucName = body.ucName || "";
    let wardName = body.wardName || "";

    if (body.binId) {
      bin = await Bin08.findById(body.binId);
      if (!bin) return fail(res, "Bin not found", null, 404);

      binNumber = bin.binNumber;
      defaultLat = bin.lat;
      defaultLng = bin.lng;
      radiusM = bin.radiusM;
      zoneId = bin.zoneId;
      ucId = bin.ucId;
      wardId = bin.wardId;
      zoneName = bin.zoneName || zoneName;
      ucName = bin.ucName || ucName;
      wardName = bin.wardName || wardName;

      distanceM = haversineMeters(defaultLat, defaultLng, Number(body.beforeLat), Number(body.beforeLng));
      placed = distanceM <= radiusM;
    } else {
      binNumber = String(body.manualBinNumber).trim().toUpperCase();
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

      geo: { zoneId, ucId, wardId, zoneName, ucName, wardName },

      before: { at: parseDateOrNow(body.beforeAt), lat: Number(body.beforeLat), lng: Number(body.beforeLng), mediaId: beforeMedia._id },
      after: { at: parseDateOrNow(body.afterAt), lat: Number(body.afterLat), lng: Number(body.afterLng), mediaId: afterMedia._id },

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
    if (!requireForkUser(req, res)) return;
    const { id } = req.params;
    const body = req.body || {};
    const required = ["endLat","endLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const shift = await AttendanceShift.findById(id);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "FORK") return fail(res, "Invalid shift operationType", null, 400);
    if (shift.status === "COMPLETED") return ok(res, "Shift already completed", shift);
    if (!mustBelongToShift(req, shift)) {
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
 * GET /operations/fork/stats
 * Returns bins done + gts trips + laborers for the shift.
 */
async function stats(req, res, next) {
  try {
    if (!requireForkUser(req, res)) return;
    let attendanceId = req.query.attendanceId;

    if (!attendanceId && req.auth.role !== "ADMIN" && req.auth.hrNumber) {
      const activeShift = await AttendanceShift.findOne({
        operationType: "FORK",
        status: "ONWORK",
        $or: [
          { "supervisor.hrNumber": normalizeHr(req.auth.hrNumber) },
          { "driver.hrNumber": normalizeHr(req.auth.hrNumber) }
        ]
      }).sort({ createdAt: -1 }).lean();
      if (activeShift) attendanceId = activeShift._id;
    }

    if (!attendanceId) {
      return ok(res, "fork stats", { binsDone: 0, gtsTrips: 0, laborers: 0, attendanceId: null });
    }

    const [binsDone, shift] = await Promise.all([
      ForkActivity.countDocuments({ operationType: "FORK", deletedAt: null, attendanceId }),
      AttendanceShift.findById(attendanceId).lean()
    ]);

    const gtsTrips = Number(shift?.forkStats?.gtsTrips || 0);
    const laborers = Number(shift?.forkStats?.laborers || 0);
    return ok(res, "fork stats", { binsDone, gtsTrips, laborers, attendanceId });
  } catch (e) { next(e); }
}

/**
 * PATCH /operations/fork/shift/:id/stats
 * Body: { gtsTrips, laborers, gtsTripsDelta, laborersDelta }
 */
async function updateShiftStats(req, res, next) {
  try {
    if (!requireForkUser(req, res)) return;
    const { id } = req.params;
    const body = req.body || {};

    const shift = await AttendanceShift.findById(id);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "FORK") return fail(res, "Invalid shift operationType", null, 400);
    if (!mustBelongToShift(req, shift)) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    const nextStats = { ...(shift.forkStats || {}) };
    const hasAbsolute = body.gtsTrips !== undefined || body.laborers !== undefined;
    const hasDelta = body.gtsTripsDelta !== undefined || body.laborersDelta !== undefined;
    if (!hasAbsolute && !hasDelta) {
      return fail(res, "No stats provided");
    }

    if (body.gtsTrips !== undefined) nextStats.gtsTrips = Math.max(0, Number(body.gtsTrips || 0));
    if (body.laborers !== undefined) nextStats.laborers = Math.max(0, Number(body.laborers || 0));
    if (body.gtsTripsDelta !== undefined) {
      nextStats.gtsTrips = Math.max(0, Number(nextStats.gtsTrips || 0) + Number(body.gtsTripsDelta || 0));
    }
    if (body.laborersDelta !== undefined) {
      nextStats.laborers = Math.max(0, Number(nextStats.laborers || 0) + Number(body.laborersDelta || 0));
    }

    shift.forkStats = nextStats;
    await shift.save();
    return ok(res, "Fork shift stats updated", shift.forkStats);
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
    if (req.query.vehicleNumber) {
      const raw = String(req.query.vehicleNumber).trim().toUpperCase();
      const regex = vehicleNumberRegex(raw);
      filter["vehicle.vehicleNumber"] = regex || raw;
    }
    if (req.query.binNumber) {
      filter["fork.binNumber"] = String(req.query.binNumber).trim().toUpperCase();
    }

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
      ForkActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("before.mediaId", "url thumbUrl")
        .populate("after.mediaId", "url thumbUrl")
        .lean(),
      ForkActivity.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };

    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);
    return ok(res, "Fork activities", data, meta);
  } catch (e) { next(e); }
}

module.exports = {
  getActiveShift,
  getDriver,
  startShift,
  createActivity,
  endShift,
  stats,
  updateShiftStats,
  list
};
