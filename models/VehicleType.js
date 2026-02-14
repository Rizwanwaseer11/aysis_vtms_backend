const mongoose = require("mongoose");

const VehicleTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // Fork, Flap, Loader, MT...
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VehicleType", VehicleTypeSchema);
