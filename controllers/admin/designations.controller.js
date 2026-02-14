const Designation = require("../../models/Designation");
const Permission = require("../../models/Permission");
const { ok, fail } = require("../../utils/response");

async function list(req, res, next) {
  try {
    const items = await Designation.find({}).sort({ name: 1 }).lean();
    return ok(res, "Designations", { items });
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name, code, permissionKeys } = req.body || {};
    if (!name) return fail(res, "name is required");

    // ensure provided permission keys exist (optional)
    if (Array.isArray(permissionKeys) && permissionKeys.length) {
      const found = await Permission.countDocuments({ key: { $in: permissionKeys } });
      if (found !== permissionKeys.length) return fail(res, "Some permission keys are invalid");
    }

    const doc = await Designation.create({
      name: String(name).trim(),
      code: String(code || "").trim().toUpperCase(),
      permissionKeys: Array.isArray(permissionKeys) ? permissionKeys : []
    });

    return ok(res, "Designation created", doc, null, 201);
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, permissionKeys, isActive } = req.body || {};
    const doc = await Designation.findById(id);
    if (!doc) return fail(res, "Designation not found", null, 404);

    if (name !== undefined) doc.name = String(name).trim();
    if (code !== undefined) doc.code = String(code).trim().toUpperCase();
    if (isActive !== undefined) doc.isActive = Boolean(isActive);

    if (permissionKeys !== undefined) {
      if (!Array.isArray(permissionKeys)) return fail(res, "permissionKeys must be array");
      const found = await Permission.countDocuments({ key: { $in: permissionKeys } });
      if (found !== permissionKeys.length) return fail(res, "Some permission keys are invalid");
      doc.permissionKeys = permissionKeys;
    }

    await doc.save();
    return ok(res, "Designation updated", doc);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await Designation.findById(id);
    if (!doc) return fail(res, "Designation not found", null, 404);
    await Designation.deleteOne({ _id: id });
    return ok(res, "Designation deleted");
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
