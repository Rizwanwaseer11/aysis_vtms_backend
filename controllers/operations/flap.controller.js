const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const { nextInvoice } = require("../../utils/invoice");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const AttendanceShift = require("../../models/AttendanceShift");
const MediaFile = require("../../models/MediaFile");
const Model = require("../../models/activities/FlapActivity");

/**
 * FLAP Operation
 * Supervisor + driver. Logs MT (mini truper) unloading into flap vehicle.
 */

function requireFlapUser(req, res) {
  if (req.auth?.kind !== "USER") {
    fail(res, "Forbidden: USER token required", null, 403);
    return false;
  }
  if (req.auth.role !== "ADMIN" && req.auth.operationType !== "FLAP") {
    fail(res, "User operation mismatch", null, 403);
    return false;
  }
  return true;
}

function parseDateOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeHr(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeNicNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function nicNumberRegex(value) {
  const normalized = normalizeNicNumber(value);
  if (!normalized) return null;
  const escaped = normalized.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join("[^0-9]*")}$`);
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

function mustBelongToShift(req, shift) {
  if (req.auth.role === "ADMIN") return true;
  const tokenHr = normalizeHr(req.auth.hrNumber);
  if (!tokenHr) return false;
  return (
    tokenHr === normalizeHr(shift.supervisor?.hrNumber) ||
    tokenHr === normalizeHr(shift.driver?.hrNumber)
  );
}

async function resolveUser({ nicNumber, hrNumber, roleLabel }) {
  let lookup = null;
  if (nicNumber) {
    const normalized = normalizeNicNumber(nicNumber);
    if (!normalized || normalized.length !== 13) {
      return { error: `${roleLabel} nicNumber must be 13 digits` };
    }
    const regex = nicNumberRegex(normalized);
    lookup = { nicNumber: regex || normalized };
  } else if (hrNumber) {
    lookup = { hrNumber: normalizeHr(hrNumber) };
  }

  if (!lookup) return { error: `${roleLabel} identifier is required` };

  const user = await User.findOne({
    ...lookup,
    isActive: true,
    deletedAt: null
  });
  if (!user) return { error: `${roleLabel} not found`, status: 404 };
  return { user };
}

/**
 * GET /operations/flap/shift/active
 * Returns active shift for current supervisor/driver.
 */
async function getActiveShift(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const hrNumber =
      req.auth.role === "ADMIN" && req.query.hrNumber
        ? normalizeHr(req.query.hrNumber)
        : normalizeHr(req.auth.hrNumber || "");
    if (!hrNumber) return ok(res, "Active shift", null);

    const shift = await AttendanceShift.findOne({
      operationType: "FLAP",
      status: "ONWORK",
      $or: [{ "supervisor.hrNumber": hrNumber }, { "driver.hrNumber": hrNumber }]
    })
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, "Active shift", shift || null);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /operations/flap/driver/:nicNumber
 * Lookup driver by NIC number.
 */
async function getDriverByNic(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const raw = String(req.params.nicNumber || "").trim();
    const normalized = normalizeNicNumber(raw);
    if (!normalized || normalized.length !== 13) {
      return fail(res, "nicNumber must be 13 digits");
    }

    const regex = nicNumberRegex(normalized);
    const driver = await User.findOne({
      nicNumber: regex || normalized,
      isActive: true,
      deletedAt: null
    }).lean();
    if (!driver) return fail(res, "Driver not found", null, 404);
    if (driver.role !== "DRIVER") return fail(res, "User is not a driver", null, 400);

    return ok(res, "Driver", {
      id: driver._id,
      name: driver.name,
      hrNumber: driver.hrNumber,
      nicNumber: driver.nicNumber,
      role: driver.role,
      operationType: driver.operationType
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /operations/flap/vehicle/:vehicleNumber
 * Lookup vehicle by number.
 */
async function getVehicle(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const vehicleNumber = String(req.params.vehicleNumber || "").trim().toUpperCase();
    if (!vehicleNumber) return fail(res, "vehicleNumber is required");

    const regex = vehicleNumberRegex(vehicleNumber);
    const vehicle = await Vehicle.findOne({
      vehicleNumber: regex || vehicleNumber,
      isActive: true
    }).lean();
    if (!vehicle) return fail(res, "Vehicle not found", null, 404);

    return ok(res, "Vehicle", {
      id: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleTypeName: vehicle.vehicleTypeName,
      ownership: vehicle.ownership
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /operations/flap/shift/start
 * Body: {
 *  shiftType, supervisorNic? or supervisorHr?, driverNic or driverHr, vehicleNumber?,
 *  startLat, startLng, supervisorMediaUrl?, driverMediaUrl?
 * }
 */
async function startShift(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const body = req.body || {};
    const required = ["shiftType", "startLat", "startLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");

    const supervisorNic = body.supervisorNic || body.supervisorNIC || body.supervisor_nic || "";
    const driverNic = body.driverNic || body.driverNIC || body.driver_nic || "";
    const supervisorHr = body.supervisorHr || body.supervisorHR || body.hrNumber || "";
    const driverHr = body.driverHr || body.driverHR || "";
    const isDriverStarter = req.auth.role === "DRIVER";

    if (!driverNic && !driverHr) missing.push("driverNic");
    if (!isDriverStarter && !supervisorNic && !supervisorHr) missing.push("supervisorNic");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    let supervisor = null;
    if (supervisorNic || supervisorHr) {
      const supervisorResult = await resolveUser({
        nicNumber: supervisorNic,
        hrNumber: supervisorHr,
        roleLabel: "Supervisor"
      });
      if (supervisorResult.error) {
        return fail(res, supervisorResult.error, null, supervisorResult.status || 400);
      }
      supervisor = supervisorResult.user;
      if (supervisor.role !== "SUPERVISOR") return fail(res, "Supervisor role is invalid", null, 400);
      if (supervisor.operationType !== "FLAP") return fail(res, "Supervisor operation is not FLAP", null, 400);
    }

    const driverResult = await resolveUser({
      nicNumber: driverNic,
      hrNumber: driverHr,
      roleLabel: "Driver"
    });
    if (driverResult.error) {
      return fail(res, driverResult.error, null, driverResult.status || 400);
    }
    const driver = driverResult.user;
    if (driver.role !== "DRIVER") return fail(res, "Driver role is invalid", null, 400);
    if (driver.operationType !== "FLAP") return fail(res, "Driver operation is not FLAP", null, 400);

    if (req.auth.role !== "ADMIN") {
      const tokenHr = normalizeHr(req.auth.hrNumber);
      if (req.auth.role === "SUPERVISOR") {
        if (!supervisor) return fail(res, "supervisorNic is required for supervisor login");
        if (tokenHr !== normalizeHr(supervisor.hrNumber)) {
          return fail(res, "supervisor does not match logged in user", null, 403);
        }
      }
      if (req.auth.role === "DRIVER" && tokenHr !== normalizeHr(driver.hrNumber)) {
        return fail(res, "driver does not match logged in user", null, 403);
      }
    }

    const shiftUsers = [{ "driver.hrNumber": driver.hrNumber }];
    if (supervisor?.hrNumber) {
      shiftUsers.push({ "supervisor.hrNumber": supervisor.hrNumber });
    }
    const existingShift = await AttendanceShift.findOne({
      operationType: "FLAP",
      status: "ONWORK",
      $or: shiftUsers
    }).lean();
    if (existingShift) {
      return fail(res, "An active shift already exists", { shiftId: existingShift._id }, 409);
    }

    let vehicle = null;
    if (body.vehicleNumber) {
      const vehicleNumber = String(body.vehicleNumber).trim().toUpperCase();
      const regex = vehicleNumberRegex(vehicleNumber);
      vehicle = await Vehicle.findOne({ vehicleNumber: regex || vehicleNumber, isActive: true });
      if (!vehicle) return fail(res, "Vehicle not found", null, 404);
    }

    const shift = await AttendanceShift.create({
      operationType: "FLAP",
      shiftType: body.shiftType,
      supervisor: supervisor
        ? { userId: supervisor._id, name: supervisor.name, hrNumber: supervisor.hrNumber }
        : { userId: null, name: "", hrNumber: "" },
      driver: { userId: driver._id, name: driver.name, hrNumber: driver.hrNumber },
      vehicle: vehicle
        ? {
            vehicleId: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            vehicleTypeName: vehicle.vehicleTypeName,
            ownership: vehicle.ownership
          }
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
  } catch (e) {
    next(e);
  }
}

/**
 * POST /operations/flap/activity
 */
async function createActivity(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const body = req.body || {};
    const required = [
      "attendanceId",
      "beforeLat",
      "beforeLng",
      "afterLat",
      "afterLng",
      "beforeMediaId",
      "afterMediaId",
      "mtNumber",
      "averageLoad"
    ];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const averageLoad = Number(body.averageLoad);
    if (!Number.isFinite(averageLoad) || averageLoad < 1 || averageLoad > 100) {
      return fail(res, "averageLoad must be between 1 and 100");
    }

    const shift = await AttendanceShift.findById(body.attendanceId);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "FLAP") return fail(res, "Invalid shift operationType", null, 400);
    if (shift.status !== "ONWORK") return fail(res, "Shift is not active", null, 409);
    if (!mustBelongToShift(req, shift)) {
      return fail(res, "Forbidden: shift does not belong to you", null, 403);
    }

    const mtNumber = String(body.mtNumber).trim().toUpperCase();
    if (!mtNumber) return fail(res, "mtNumber is required");

    const { invoiceNo, monthKey } = await nextInvoice("FLAP", null);

    const [beforeMedia, afterMedia] = await Promise.all([
      MediaFile.findById(body.beforeMediaId),
      MediaFile.findById(body.afterMediaId)
    ]);
    if (!beforeMedia) return fail(res, "beforeMediaId is invalid", null, 400);
    if (!afterMedia) return fail(res, "afterMediaId is invalid", null, 400);

    const vehicleNumberForCount = String(
      body.vehicleNumber || shift.vehicle?.vehicleNumber || ""
    ).trim();
    const visitFilter = {
      operationType: "FLAP",
      deletedAt: null,
      "flap.mtNumber": mtNumber
    };
    if (vehicleNumberForCount) {
      visitFilter["vehicle.vehicleNumber"] = vehicleNumberForCount;
    } else {
      visitFilter.attendanceId = shift._id;
    }

    const mtVisitCount = (await Model.countDocuments(visitFilter)) + 1;

    const doc = await Model.create({
      operationType: "FLAP",
      invoiceNo,
      monthKey,
      status: "PENDING",
      attendanceId: shift._id,
      supervisor: shift.supervisor,
      driver: shift.driver,
      vehicle: body.vehicleNumber
        ? { ...shift.vehicle, vehicleNumber: String(body.vehicleNumber).trim() }
        : shift.vehicle,
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
        at: parseDateOrNow(body.afterAt),
        lat: Number(body.afterLat),
        lng: Number(body.afterLng),
        mediaId: afterMedia._id
      },
      notes: String(body.notes || "").trim(),
      flap: {
        mtNumber,
        mtVisitCount,
        averageLoad
      }
    });

    await cache.del("dashboardKpis");
    await cache.del("flapList");

    return ok(res, "flap activity created", doc, null, 201);
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /operations/flap/shift/:id/end
 */
async function endShift(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    const { id } = req.params;
    const body = req.body || {};
    const required = ["endLat", "endLng"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const shift = await AttendanceShift.findById(id);
    if (!shift) return fail(res, "Attendance shift not found", null, 404);
    if (shift.operationType !== "FLAP") return fail(res, "Invalid shift operationType", null, 400);
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
  } catch (e) {
    next(e);
  }
}

/**
 * GET /operations/flap/stats
 * Returns MT serviced count for the shift.
 */
async function stats(req, res, next) {
  try {
    if (!requireFlapUser(req, res)) return;
    let attendanceId = req.query.attendanceId;

    if (!attendanceId && req.auth.role !== "ADMIN" && req.auth.hrNumber) {
      const activeShift = await AttendanceShift.findOne({
        operationType: "FLAP",
        status: "ONWORK",
        $or: [
          { "supervisor.hrNumber": normalizeHr(req.auth.hrNumber) },
          { "driver.hrNumber": normalizeHr(req.auth.hrNumber) }
        ]
      })
        .sort({ createdAt: -1 })
        .lean();
      if (activeShift) attendanceId = activeShift._id;
    }

    if (!attendanceId) {
      return ok(res, "flap stats", { mtServiced: 0, attendanceId: null });
    }

    const mtServiced = await Model.countDocuments({
      operationType: "FLAP",
      deletedAt: null,
      attendanceId
    });
    return ok(res, "flap stats", { mtServiced, attendanceId });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /operations/flap/list (admin table)
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
    if (req.query.mtNumber) filter["flap.mtNumber"] = String(req.query.mtNumber).trim().toUpperCase();

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const cacheKey = cache.key(["flapList", JSON.stringify(filter), page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "flap activities", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      Model.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("before.mediaId", "url thumbUrl")
        .populate("after.mediaId", "url thumbUrl")
        .lean(),
      Model.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };
    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);

    return ok(res, "flap activities", data, meta);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getActiveShift,
  getDriverByNic,
  getVehicle,
  startShift,
  createActivity,
  endShift,
  stats,
  list
};
