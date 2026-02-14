const KundiPoint = require("../../models/KundiPoint");
const GtsPoint = require("../../models/GtsPoint");
const Ward = require("../../models/Ward");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");

async function listKundis(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const { wardId, q } = req.query;

    const filter = {};
    if (wardId) filter.wardId = wardId;
    if (q) filter.name = { $regex: String(q).trim(), $options: "i" };

    const [items, total] = await Promise.all([
      KundiPoint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      KundiPoint.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Kundi points", { items }, meta);
  } catch (e) { next(e); }
}

async function createKundi(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["name","wardId","lat","lng"];
    const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const ward = await Ward.findById(body.wardId);
    if (!ward) return fail(res, "Ward not found", null, 404);

    const doc = await KundiPoint.create({
      name: String(body.name).trim(),
      wardId: ward._id,
      wardName: ward.name,
      ucId: ward.ucId,
      ucName: ward.ucName,
      zoneId: ward.zoneId,
      zoneName: ward.zoneName,
      lat: Number(body.lat),
      lng: Number(body.lng),
      radiusM: Number(body.radiusM || 50)
    });

    return ok(res, "Kundi created", doc, null, 201);
  } catch (e) { next(e); }
}

async function listGts(req, res, next) {
  try {
    const items = await GtsPoint.find({}).sort({ name: 1 }).lean();
    return ok(res, "GTS points", { items });
  } catch (e) { next(e); }
}

async function createGts(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["name","lat","lng"];
    const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const doc = await GtsPoint.create({
      name: String(body.name).trim(),
      lat: Number(body.lat),
      lng: Number(body.lng),
      radiusM: Number(body.radiusM || 80)
    });

    return ok(res, "GTS point created", doc, null, 201);
  } catch (e) { next(e); }
}

module.exports = { listKundis, createKundi, listGts, createGts };
