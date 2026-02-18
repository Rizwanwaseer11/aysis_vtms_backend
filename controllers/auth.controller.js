const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const { ok, fail } = require("../utils/response");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Designation = require("../models/Designation");

/**
 * POST /auth/user/login
 * Body: { email, password }
 */
async function userLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, "email and password are required", null, 400);

    const user = await User.findOne({ email: String(email).toLowerCase(), deletedAt: null });
    if (!user) return fail(res, "Invalid credentials", null, 401);
    if (!user.isActive) return fail(res, "You are inactive, kindly contact VTMS officer", null, 403);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return fail(res, "Invalid credentials", null, 401);

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { kind: "USER", id: user._id, role: user.role, operationType: user.operationType, hrNumber: user.hrNumber, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return ok(res, "Login success", { token, user: { id: user._id, name: user.name, role: user.role, operationType: user.operationType } });
  } catch (e) { next(e); }
}

/**
 * POST /auth/employee/login
 * Body: { email, password }
 * Employees are admin-panel users (including VTMS officer)
 */
async function employeeLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, "email and password are required", null, 400);

    const emp = await Employee.findOne({ email: String(email).toLowerCase(), deletedAt: null });
    if (!emp) return fail(res, "Invalid credentials", null, 401);
    if (!emp.isActive) return fail(res, "You are inactive, kindly contact VTMS officer", null, 403);

    const match = await bcrypt.compare(password, emp.passwordHash);
    if (!match) return fail(res, "Invalid credentials", null, 401);

    // Pull permissions from designation
    const desig = await Designation.findById(emp.designationId);
    const permissionKeys = desig?.permissionKeys || [];
    const pagePermissions = Array.isArray(emp.pagePermissions) ? emp.pagePermissions : [];

    emp.lastLoginAt = new Date();
    await emp.save();

    const token = jwt.sign(
      {
        kind: "EMPLOYEE",
        id: emp._id,
        role: emp.designationCode || "EMPLOYEE",
        name: emp.name,
        hrNumber: emp.hrNumber,
        permissions: permissionKeys,
        pages: pagePermissions
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return ok(res, "Login success", {
      token,
      employee: {
        id: emp._id,
        name: emp.name,
        designation: emp.designationName,
        designationCode: emp.designationCode,
        permissions: permissionKeys,
        pagePermissions
      }
    });
  } catch (e) { next(e); }
}

module.exports = { userLogin, employeeLogin };
