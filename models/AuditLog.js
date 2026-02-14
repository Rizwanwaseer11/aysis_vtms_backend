const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    actorKind: { type: String, enum: ["USER","EMPLOYEE"], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true }, // ACTIVITY_APPROVED, ACTIVITY_REJECTED, ACTIVITY_EDITED, MEDIA_REPLACED ...
    entityType: { type: String, required: true }, // GateActivity, ForkActivity...
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ actorKind: 1, actorId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
