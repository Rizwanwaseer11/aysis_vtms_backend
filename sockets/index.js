const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const registerChat = require("./chat.socket");

/**
 * Socket.IO is ONLY for chat (text/voice).
 * No live location sharing.
 */
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  // Basic auth: client sends token in auth.token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const payload = jwt.verify(token, JWT_SECRET);
      // Only field users participate in chat in your flow
      if (payload.kind !== "USER") return next(new Error("Only USER can connect to chat"));
      socket.user = payload;
      return next();
    } catch (e) {
      return next(new Error("Unauthorized"));
    }
  });

  registerChat(io);

  return io;
}

module.exports = { initSockets };
