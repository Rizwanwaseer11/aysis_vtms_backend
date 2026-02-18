const mongoose = require("mongoose");
const { DESIGNATION_PERMISSION_KEYS } = require("../utils/permissions");

const DesignationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, unique: true }, // VTMS_OFFICER etc
    permissionKeys: { type: [String], enum: DESIGNATION_PERMISSION_KEYS, default: [] }, // READ/WRITE/EDIT/APPROVE/ALL
    isActive: { type: Boolean, default: true },
    createdAt:{ type: Date, default: Date.now },
    updatedAt:{ type: Date, default: Date.now }
  },
  
  { timestamps: true }
);

module.exports = mongoose.model("Designation", DesignationSchema);
