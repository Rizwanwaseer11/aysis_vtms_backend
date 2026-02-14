const bcrypt = require("bcryptjs");
const Employee = require("../../models/Employee");
const Designation = require("../../models/Designation");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");

async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const q = (req.query.q || "").trim();

    const filter = { deletedAt: null };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { hrNumber: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { designationName: { $regex: q, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-passwordHash").lean(),
      Employee.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Employees", { items }, meta);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["name", "nicNumber", "hrNumber", "email", "password", "designationId"];
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const desig = await Designation.findById(body.designationId);
    if (!desig) return fail(res, "Designation not found", null, 404);

    const passwordHash = await bcrypt.hash(String(body.password), 10);

    const doc = await Employee.create({
      name: String(body.name).trim(),
      fatherName: String(body.fatherName || "").trim(),
      nicNumber: String(body.nicNumber).trim(),
      hrNumber: String(body.hrNumber).trim(),
      email: String(body.email).toLowerCase().trim(),
      passwordHash,
      designationId: desig._id,
      designationName: desig.name,
      designationCode: desig.code || ""
    });

    return ok(res, "Employee created", { id: doc._id }, null, 201);
  } catch (e) {
    if (String(e.message || "").includes("duplicate")) return fail(res, "Employee email/HR/NIC already exists", null, 409);
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const doc = await Employee.findById(id);
    if (!doc || doc.deletedAt) return fail(res, "Employee not found", null, 404);

    if (body.name !== undefined) doc.name = String(body.name).trim();
    if (body.fatherName !== undefined) doc.fatherName = String(body.fatherName).trim();
    if (body.nicNumber !== undefined) doc.nicNumber = String(body.nicNumber).trim();
    if (body.hrNumber !== undefined) doc.hrNumber = String(body.hrNumber).trim();
    if (body.email !== undefined) doc.email = String(body.email).toLowerCase().trim();
    if (body.isActive !== undefined) doc.isActive = Boolean(body.isActive);

    if (body.designationId !== undefined) {
      const desig = await Designation.findById(body.designationId);
      if (!desig) return fail(res, "Designation not found", null, 404);
      doc.designationId = desig._id;
      doc.designationName = desig.name;
      doc.designationCode = desig.code || "";
    }

    if (body.password) {
      doc.passwordHash = await bcrypt.hash(String(body.password), 10);
    }

    await doc.save();
    return ok(res, "Employee updated");
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await Employee.findById(id);
    if (!doc || doc.deletedAt) return fail(res, "Employee not found", null, 404);

    doc.deletedAt = new Date();
    doc.isActive = false;
    await doc.save();

    return ok(res, "Employee deleted (soft)");
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
