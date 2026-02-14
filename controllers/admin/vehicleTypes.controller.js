const VehicleType = require("../../models/VehicleType");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const q = (req.query.q || "").trim();

    const filter = {};
    if (q) filter.name = { $regex: q, $options: "i" };

    const cacheKey = cache.key(["vehicleTypes", q, page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "Vehicle types", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      VehicleType.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      VehicleType.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };

    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);
    return ok(res, "Vehicle types", data, meta);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name } = req.body || {};
    if (!name) return fail(res, "name is required");

    const doc = await VehicleType.create({ name: String(name).trim() });

    await cache.del("vehicleTypes");
    return ok(res, "Vehicle type created", doc, null, 201);
  } catch (e) {
    if (String(e.message || "").includes("duplicate")) return fail(res, "Vehicle type already exists", null, 409);
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body || {};
    const doc = await VehicleType.findById(id);
    if (!doc) return fail(res, "Vehicle type not found", null, 404);

    if (name !== undefined) doc.name = String(name).trim();
    if (isActive !== undefined) doc.isActive = Boolean(isActive);
    await doc.save();

    await cache.del("vehicleTypes");
    return ok(res, "Vehicle type updated", doc);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await VehicleType.findById(id);
    if (!doc) return fail(res, "Vehicle type not found", null, 404);

    await VehicleType.deleteOne({ _id: id });

    await cache.del("vehicleTypes");
    return ok(res, "Vehicle type deleted");
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
