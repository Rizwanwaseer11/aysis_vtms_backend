const mongoose = require("mongoose");

const DesignationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, unique: true }, // VTMS_OFFICER etc
    permissionKeys: [{ type: String }], // store permission keys directly (fast token embedding)
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Designation", DesignationSchema);
