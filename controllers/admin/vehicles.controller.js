const Vehicle = require("../../models/Vehicle");
const VehicleType = require("../../models/VehicleType");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const q = (req.query.q || "").trim();

    const filter = { };
    if (q) {
      filter.$or = [
        { vehicleNumber: { $regex: q, $options: "i" } },
        { vehicleTypeName: { $regex: q, $options: "i" } },
      ];
    }

    const cacheKey = cache.key(["vehicles", q, page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "Vehicles", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      Vehicle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Vehicle.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };
    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);

    return ok(res, "Vehicles", data, meta);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { vehicleNumber, vehicleTypeId, ownership } = req.body || {};
    if (!vehicleNumber) return fail(res, "vehicleNumber is required");
    if (!vehicleTypeId) return fail(res, "vehicleTypeId is required");

    const vt = await VehicleType.findById(vehicleTypeId);
    if (!vt) return fail(res, "Vehicle type not found", null, 404);

    const doc = await Vehicle.create({
      vehicleNumber: String(vehicleNumber).trim(),
      vehicleTypeId: vt._id,
      vehicleTypeName: vt.name,
      ownership: ownership === "PRIVATE" ? "PRIVATE" : "COMPANY"
    });

    await cache.del("vehicles");
    return ok(res, "Vehicle created", doc, null, 201);
  } catch (e) {
    if (String(e.message || "").includes("duplicate")) return fail(res, "Vehicle number already exists", null, 409);
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { vehicleNumber, vehicleTypeId, ownership, isActive } = req.body || {};

    const doc = await Vehicle.findById(id);
    if (!doc) return fail(res, "Vehicle not found", null, 404);

    if (vehicleNumber !== undefined) doc.vehicleNumber = String(vehicleNumber).trim();

    if (vehicleTypeId !== undefined) {
      const vt = await VehicleType.findById(vehicleTypeId);
      if (!vt) return fail(res, "Vehicle type not found", null, 404);
      doc.vehicleTypeId = vt._id;
      doc.vehicleTypeName = vt.name;
    }

    if (ownership !== undefined) doc.ownership = ownership === "PRIVATE" ? "PRIVATE" : "COMPANY";
    if (isActive !== undefined) doc.isActive = Boolean(isActive);

    await doc.save();
    await cache.del("vehicles");
    return ok(res, "Vehicle updated", doc);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await Vehicle.findById(id);
    if (!doc) return fail(res, "Vehicle not found", null, 404);

    await Vehicle.deleteOne({ _id: id });
    await cache.del("vehicles");
    return ok(res, "Vehicle deleted");
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
