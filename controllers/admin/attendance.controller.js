const AttendanceShift = require("../../models/AttendanceShift");
const { ok } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");

/**
 * Attendance list for admin panel:
 * filters: startDate/endDate, month, supervisorHr, driverHr, status, operationType
 */
async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (req.query.operationType) filter.operationType = req.query.operationType;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.supervisorHr) filter["supervisor.hrNumber"] = req.query.supervisorHr;
    if (req.query.driverHr) filter["driver.hrNumber"] = req.query.driverHr;

    // date range on start.at
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    if (startDate || endDate) {
      filter["start.at"] = {};
      if (startDate) filter["start.at"].$gte = new Date(startDate);
      if (endDate) filter["start.at"].$lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      AttendanceShift.find(filter).sort({ "start.at": -1 }).skip(skip).limit(limit).lean(),
      AttendanceShift.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Attendance", { items }, meta);
  } catch (e) { next(e); }
}

module.exports = { list };
