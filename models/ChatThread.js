const mongoose = require("mongoose");

const ChatThreadSchema = new mongoose.Schema(
  {
    userAId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userBId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ChatThreadSchema.index({ userAId: 1, userBId: 1 }, { unique: true });

module.exports = mongoose.model("ChatThread", ChatThreadSchema);
