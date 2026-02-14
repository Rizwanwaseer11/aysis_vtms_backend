const { ok, fail } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const ChatThread = require("../models/ChatThread");
const ChatMessage = require("../models/ChatMessage");

/**
 * GET /chat/threads
 * Returns threads for logged-in USER.
 */
async function listThreads(req, res, next) {
  try {
    const userId = req.auth.id;
    const { page, perPage, limit, skip } = parsePagination(req.query);

    const filter = { $or: [{ userAId: userId }, { userBId: userId }] };

    const [items, total] = await Promise.all([
      ChatThread.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
      ChatThread.countDocuments(filter)
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Threads", { items }, meta);
  } catch (e) { next(e); }
}

/**
 * GET /chat/threads/:threadId/messages
 */
async function listMessages(req, res, next) {
  try {
    const { threadId } = req.params;
    const userId = String(req.auth.id);

    const thread = await ChatThread.findById(threadId);
    if (!thread) return fail(res, "Thread not found", null, 404);

    if (![String(thread.userAId), String(thread.userBId)].includes(userId)) {
      return fail(res, "Forbidden", null, 403);
    }

    const { page, perPage, limit, skip } = parsePagination(req.query);

    const [items, total] = await Promise.all([
      ChatMessage.find({ threadId }).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
      ChatMessage.countDocuments({ threadId })
    ]);

    const meta = buildMeta({ page, perPage, total, limit });
    return ok(res, "Messages", { items }, meta);
  } catch (e) { next(e); }
}

module.exports = { listThreads, listMessages };
