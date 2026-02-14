const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, unique: true },
    vehicleTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "VehicleType", required: true },
    vehicleTypeName: { type: String, required: true }, // snapshot for faster listing
    ownership: { type: String, enum: ["COMPANY", "PRIVATE"], default: "COMPANY" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VehicleSchema.index({ vehicleTypeId: 1, isActive: 1 });

module.exports = mongoose.model("Vehicle", VehicleSchema);
