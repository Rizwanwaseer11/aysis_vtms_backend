const mongoose = require("mongoose");

const KundiPointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    zoneName: { type: String, required: true },
    ucId: { type: mongoose.Schema.Types.ObjectId, ref: "UC", required: true },
    ucName: { type: String, required: true },
    wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
    wardName: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusM: { type: Number, default: 50 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

KundiPointSchema.index({ wardId: 1 });

module.exports = mongoose.model("KundiPoint", KundiPointSchema);
