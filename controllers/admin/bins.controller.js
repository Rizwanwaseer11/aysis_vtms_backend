const Bin08 = require("../../models/Bin08");
const Bin5 = require("../../models/Bin5");
const Ward = require("../../models/Ward");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");

async function listBin08(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const { wardId, q } = req.query;

    const filter = {};
    if (wardId) filter.wardId = wardId;
    if (q) filter.binNumber = { $regex: String(q).trim(), $options: "i" };

    const [items, total] = await Promise.all([
      Bin08.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Bin08.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "0.8 bins", { items }, meta);
  } catch (e) { next(e); }
}

async function createBin08(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["binNumber", "wardId", "lat", "lng", "radiusM"];
    const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const ward = await Ward.findById(body.wardId);
    if (!ward) return fail(res, "Ward not found", null, 404);

    const doc = await Bin08.create({
      binNumber: String(body.binNumber).trim(),
      wardId: ward._id,
      wardName: ward.name,
      ucId: ward.ucId,
      ucName: ward.ucName,
      zoneId: ward.zoneId,
      zoneName: ward.zoneName,
      lat: Number(body.lat),
      lng: Number(body.lng),
      radiusM: Number(body.radiusM)
    });

    return ok(res, "0.8 bin created", doc, null, 201);
  } catch (e) { next(e); }
}

async function updateBin08(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const doc = await Bin08.findById(id);
    if (!doc) return fail(res, "Bin not found", null, 404);

    if (body.binNumber !== undefined) doc.binNumber = String(body.binNumber).trim();
    if (body.lat !== undefined) doc.lat = Number(body.lat);
    if (body.lng !== undefined) doc.lng = Number(body.lng);
    if (body.radiusM !== undefined) doc.radiusM = Number(body.radiusM);
    if (body.isActive !== undefined) doc.isActive = Boolean(body.isActive);

    await doc.save();
    return ok(res, "0.8 bin updated", doc);
  } catch (e) { next(e); }
}

async function listBin5(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const q = (req.query.q || "").trim();

    const filter = {};
    if (q) filter.binNumber = { $regex: q, $options: "i" };

    const [items, total] = await Promise.all([
      Bin5.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Bin5.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "5 cubic bins", { items }, meta);
  } catch (e) { next(e); }
}

async function createBin5(req, res, next) {
  try {
    const { binNumber } = req.body || {};
    if (!binNumber) return fail(res, "binNumber is required");
    const doc = await Bin5.create({ binNumber: String(binNumber).trim() });
    return ok(res, "5 cubic bin created", doc, null, 201);
  } catch (e) { next(e); }
}

module.exports = { listBin08, createBin08, updateBin08, listBin5, createBin5 };
