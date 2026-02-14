const mongoose = require("mongoose");

const WardSchema = new mongoose.Schema(
  {
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    zoneName: { type: String, required: true },
    ucId: { type: mongoose.Schema.Types.ObjectId, ref: "UC", required: true },
    ucName: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

WardSchema.index({ ucId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Ward", WardSchema);
