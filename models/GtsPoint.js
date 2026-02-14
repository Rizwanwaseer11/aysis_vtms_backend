const mongoose = require("mongoose");

const GtsPointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusM: { type: Number, default: 80 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GtsPoint", GtsPointSchema);
