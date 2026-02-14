const ChatThread = require("../models/ChatThread");
const ChatMessage = require("../models/ChatMessage");

/**
 * Chat socket events
 * - join: join your own room for receiving messages
 * - send: send text/voice message
 */
module.exports = function registerChat(io) {
  io.on("connection", (socket) => {
    const userId = socket.user.id;
    socket.join(String(userId));

    socket.on("chat:send", async (payload, ack) => {
      try {
        const { toUserId, type, text, voiceUrl } = payload || {};
        if (!toUserId) throw new Error("toUserId required");

        // Ensure thread exists
        const a = String(userId);
        const b = String(toUserId);

        const pair = a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
        let thread = await ChatThread.findOne(pair);
        if (!thread) thread = await ChatThread.create(pair);

        const msg = await ChatMessage.create({
          threadId: thread._id,
          senderUserId: userId,
          type: type === "VOICE" ? "VOICE" : "TEXT",
          text: type === "VOICE" ? "" : String(text || ""),
          voiceMediaUrl: type === "VOICE" ? String(voiceUrl || "") : "",
          sentAt: new Date()
        });

        thread.lastMessageAt = new Date();
        await thread.save();

        // Emit to receiver room + sender room
        io.to(String(toUserId)).emit("chat:message", { threadId: thread._id, message: msg });
        io.to(String(userId)).emit("chat:message", { threadId: thread._id, message: msg });

        if (ack) ack({ success: true });
      } catch (e) {
        if (ack) ack({ success: false, message: e.message });
      }
    });

    socket.on("disconnect", () => {});
  });
};
