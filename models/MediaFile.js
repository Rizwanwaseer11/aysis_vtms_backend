const mongoose = require("mongoose");

/**
 * Stores URLs only (images stored on Hostinger storage or local dev storage).
 */
const MediaFileSchema = new mongoose.Schema(
  {
    linkedTo: { type: String, enum: ["ACTIVITY","ATTENDANCE","CHAT_VOICE"], required: true },
    activityType: { type: String, default: "" }, // GATE/FORK/...
    activityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    attendanceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    uploaderKind: { type: String, enum: ["USER","EMPLOYEE"], required: true },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, required: true },

    kind: { type: String, enum: ["BEFORE","AFTER","SHIFT_START","SHIFT_END","VOICE"], required: true },

    url: { type: String, required: true },
    thumbUrl: { type: String, default: "" },

    watermarkStatus: { type: String, enum: ["PENDING","DONE","FAILED"], default: "PENDING" },
    meta: { type: Object, default: {} }, // zone/uc/ward/bin/coords printed etc.

    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

MediaFileSchema.index({ activityId: 1, createdAt: -1 });
MediaFileSchema.index({ attendanceId: 1, createdAt: -1 });

module.exports = mongoose.model("MediaFile", MediaFileSchema);
