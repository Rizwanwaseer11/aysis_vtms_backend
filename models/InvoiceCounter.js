const mongoose = require("mongoose");

/**
 * Sequence counter per operationType per monthKey.
 */
const InvoiceCounterSchema = new mongoose.Schema(
  {
    operationType: { type: String, required: true },
    monthKey: { type: String, required: true }, // YYYY-MM
    lastNo: { type: Number, default: 0 }
  },
  { timestamps: true }
);

InvoiceCounterSchema.index({ operationType: 1, monthKey: 1 }, { unique: true });

module.exports = mongoose.model("InvoiceCounter", InvoiceCounterSchema);
