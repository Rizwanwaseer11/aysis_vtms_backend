const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { ok, fail } = require("../../utils/response");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const cache = require("../../utils/cache");
const { CACHE_TTL_LIST_SECONDS } = require("../../config/env");

async function list(req, res, next) {
  try {
    const { page, perPage, limit, skip } = parsePagination(req.query);
    const q = (req.query.q || "").trim();

    const filter = { deletedAt: null };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { hrNumber: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ];
    }

    const cacheKey = cache.key(["users", q, page, perPage]);
    const cached = await cache.get(cacheKey);
    if (cached) return ok(res, "Users", cached.data, cached.meta);

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-passwordHash").lean(),
      User.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    const data = { items };
    await cache.set(cacheKey, { data, meta }, CACHE_TTL_LIST_SECONDS);

    return ok(res, "Users", data, meta);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    const required = ["name", "nicNumber", "hrNumber", "email", "password", "role", "operationType"];
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return fail(res, `Missing fields: ${missing.join(", ")}`);

    const passwordHash = await bcrypt.hash(String(body.password), 10);

    const doc = await User.create({
      name: String(body.name).trim(),
      fatherName: String(body.fatherName || "").trim(),
      nicNumber: String(body.nicNumber).trim(),
      hrNumber: String(body.hrNumber).trim(),
      email: String(body.email).toLowerCase().trim(),
      passwordHash,
      role: body.role,
      operationType: body.operationType,
      isActive: true
    });

    await cache.del("users");
    return ok(res, "User created", { id: doc._id }, null, 201);
  } catch (e) {
    if (String(e.message || "").includes("duplicate")) return fail(res, "User email/HR/NIC already exists", null, 409);
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const doc = await User.findById(id);
    if (!doc || doc.deletedAt) return fail(res, "User not found", null, 404);

    // Validation is intentionally here (your requirement).
    if (body.name !== undefined) doc.name = String(body.name).trim();
    if (body.fatherName !== undefined) doc.fatherName = String(body.fatherName).trim();
    if (body.nicNumber !== undefined) doc.nicNumber = String(body.nicNumber).trim();
    if (body.hrNumber !== undefined) doc.hrNumber = String(body.hrNumber).trim();
    if (body.email !== undefined) doc.email = String(body.email).toLowerCase().trim();
    if (body.role !== undefined) doc.role = body.role;
    if (body.operationType !== undefined) doc.operationType = body.operationType;
    if (body.isActive !== undefined) doc.isActive = Boolean(body.isActive);

    if (body.password) {
      doc.passwordHash = await bcrypt.hash(String(body.password), 10);
    }

    await doc.save();
    await cache.del("users");
    return ok(res, "User updated");
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await User.findById(id);
    if (!doc || doc.deletedAt) return fail(res, "User not found", null, 404);

    doc.deletedAt = new Date();
    doc.isActive = false;
    await doc.save();

    await cache.del("users");
    return ok(res, "User deleted (soft)");
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
