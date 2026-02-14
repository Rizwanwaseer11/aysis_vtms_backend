const cache = require("../../utils/cache");
const { ok } = require("../../utils/response");
const { CACHE_TTL_KPI_SECONDS } = require("../../config/env");

const GateActivity = require("../../models/activities/GateActivity");
const ForkActivity = require("../../models/activities/ForkActivity");
const FlapActivity = require("../../models/activities/FlapActivity");
const ArmRollerActivity = require("../../models/activities/ArmRollerActivity");
const BulkActivity = require("../../models/activities/BulkActivity");
const GtsActivity = require("../../models/activities/GtsActivity");
const LfsActivity = require("../../models/activities/LfsActivity");

const MODEL_BY_OP = {
  GATE: GateActivity,
  FORK: ForkActivity,
  FLAP: FlapActivity,
  ARM_ROLLER: ArmRollerActivity,
  BULK: BulkActivity,
  GTS: GtsActivity,
  LFS: LfsActivity
};

async function kpis(req, res, next) {
  try {
    const monthKey = (req.query.month || "").trim(); // optional YYYY-MM
    const cacheKey = cache.key(["dashboardKpis", monthKey || "all"]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "KPIs", cached);

    const result = {};
    for (const op of Object.keys(MODEL_BY_OP)) {
      const Model = MODEL_BY_OP[op];
      const filter = {};
      if (monthKey) filter.monthKey = monthKey;

      const [pending, approved, rejected, total] = await Promise.all([
        Model.countDocuments({ ...filter, status: "PENDING" }),
        Model.countDocuments({ ...filter, status: "APPROVED" }),
        Model.countDocuments({ ...filter, status: "REJECTED" }),
        Model.countDocuments(filter)
      ]);

      result[op] = { pending, approved, rejected, total };
    }

    await cache.set(cacheKey, result, CACHE_TTL_KPI_SECONDS);
    return ok(res, "KPIs", result);
  } catch (e) { next(e); }
}

module.exports = { kpis };
