const mongoose = require("mongoose");

/**
 * Users are field staff: drivers & supervisors.
 */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    nicNumber: { type: String, required: true, trim: true },
    hrNumber: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["DRIVER", "SUPERVISOR", "ADMIN"], required: true },
    operationType: {
      type: String,
      enum: ["GATE", "FORK", "FLAP", "ARM_ROLLER", "BULK", "GTS", "LFS"],
      required: true
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

UserSchema.index({ name: 1 });
UserSchema.index({ operationType: 1, role: 1, isActive: 1 });

module.exports = mongoose.model("User", UserSchema);
