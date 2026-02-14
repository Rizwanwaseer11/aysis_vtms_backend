const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatThread", required: true },
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["TEXT","VOICE"], default: "TEXT" },
    text: { type: String, default: "" },
    voiceMediaUrl: { type: String, default: "" }, // store link
    sentAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ChatMessageSchema.index({ threadId: 1, sentAt: -1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
