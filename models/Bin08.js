const mongoose = require("mongoose");

const Bin08Schema = new mongoose.Schema(
  {
    binNumber: { type: String, required: true, unique: true, trim: true },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    zoneName: { type: String, required: true },
    ucId: { type: mongoose.Schema.Types.ObjectId, ref: "UC", required: true },
    ucName: { type: String, required: true },
    wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
    wardName: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusM: { type: Number, required: true, default: 30 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

Bin08Schema.index({ wardId: 1 });
Bin08Schema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model("Bin08", Bin08Schema);
