const mongoose = require("mongoose");

const Bin5Schema = new mongoose.Schema(
  {
    binNumber: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bin5", Bin5Schema);
