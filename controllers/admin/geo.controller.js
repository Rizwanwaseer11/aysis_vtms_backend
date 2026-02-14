const Zone = require("../../models/Zone");
const UC = require("../../models/UC");
const Ward = require("../../models/Ward");
const { ok, fail } = require("../../utils/response");

/**
 * Zones
 */
async function createZone(req, res, next) {
  try {
    const { name } = req.body || {};
    if (!name) return fail(res, "name is required");
    const doc = await Zone.create({ name: String(name).trim() });
    return ok(res, "Zone created", doc, null, 201);
  } catch (e) { next(e); }
}

async function listZones(req, res, next) {
  try {
    const items = await Zone.find({}).sort({ name: 1 }).lean();
    return ok(res, "Zones", { items });
  } catch (e) { next(e); }
}

/**
 * UCs
 */
async function createUC(req, res, next) {
  try {
    const { zoneId, name } = req.body || {};
    if (!zoneId) return fail(res, "zoneId is required");
    if (!name) return fail(res, "name is required");

    const zone = await Zone.findById(zoneId);
    if (!zone) return fail(res, "Zone not found", null, 404);

    const doc = await UC.create({ zoneId: zone._id, zoneName: zone.name, name: String(name).trim() });
    return ok(res, "UC created", doc, null, 201);
  } catch (e) { next(e); }
}

async function listUCs(req, res, next) {
  try {
    const { zoneId } = req.query;
    const filter = {};
    if (zoneId) filter.zoneId = zoneId;

    const items = await UC.find(filter).sort({ name: 1 }).lean();
    return ok(res, "UCs", { items });
  } catch (e) { next(e); }
}

/**
 * Wards
 */
async function createWard(req, res, next) {
  try {
    const { ucId, name } = req.body || {};
    if (!ucId) return fail(res, "ucId is required");
    if (!name) return fail(res, "name is required");

    const uc = await UC.findById(ucId);
    if (!uc) return fail(res, "UC not found", null, 404);

    const doc = await Ward.create({
      zoneId: uc.zoneId,
      zoneName: uc.zoneName,
      ucId: uc._id,
      ucName: uc.name,
      name: String(name).trim()
    });

    return ok(res, "Ward created", doc, null, 201);
  } catch (e) { next(e); }
}

async function listWards(req, res, next) {
  try {
    const { ucId, zoneId } = req.query;
    const filter = {};
    if (zoneId) filter.zoneId = zoneId;
    if (ucId) filter.ucId = ucId;

    const items = await Ward.find(filter).sort({ name: 1 }).lean();
    return ok(res, "Wards", { items });
  } catch (e) { next(e); }
}

module.exports = { createZone, listZones, createUC, listUCs, createWard, listWards };
