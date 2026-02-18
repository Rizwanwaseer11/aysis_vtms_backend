const mongoose = require("mongoose");
const { USER_PAGE_KEYS } = require("../utils/permissions");

/**
 * Employees are admin-panel staff (data trackers, VTMS officer, etc.)
 */
const EmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    nicNumber: { type: String, required: true, trim: true, unique: true },
    hrNumber: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: "Designation", required: true },
    designationName: { type: String, required: true },
    designationCode: { type: String, default: "" }, // VTMS_OFFICER
    pagePermissions: { type: [String], enum: USER_PAGE_KEYS, default: [] },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

EmployeeSchema.index({ designationCode: 1 });

module.exports = mongoose.model("Employee", EmployeeSchema);
