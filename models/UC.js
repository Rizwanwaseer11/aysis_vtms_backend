const mongoose = require("mongoose");

const UCSchema = new mongoose.Schema(
  {
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    zoneName: { type: String, required: true }, // snapshot
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

UCSchema.index({ zoneId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("UC", UCSchema);
