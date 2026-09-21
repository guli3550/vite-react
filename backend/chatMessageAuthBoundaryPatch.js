// Security boundary for the legacy /api/chat/messages route in index.js.
// The route historically trusted client-supplied telegram_id and sender.
// This preload wraps only that route so customer identity is server-verified.
const { resolveChatIdentity } = require("./chatIdentityResolver.js");

const originalPost = express.application.post;
express.application.post = function guardedChatPost(path, ...handlers) {
  if (path === "/api/chat/messages" && handlers.length) {
    const guardedHandlers = [
      function chatMessageIdentityBoundary(req, res, next) {
        const identity = resolveChatIdentity(req);
        const telegramId = identity?.verified ? Number(identity.telegramId) : null;
        if (!telegramId) {
          return res.status(401).json({ success: false, message: "Chat uchun tasdiqlangan Telegram sessiyasi talab qilinadi." });
        }

        req.body = req.body && typeof req.body === "object" ? req.body : {};
        // Never trust client-supplied ownership or sender role.
        req.body.telegram_id = telegramId;
        req.body.sender = "customer";
        return next();
      },
      ...handlers,
    ];
    console.log("[GULI Security] /api/chat/messages identity boundary active.");
    return originalPost.call(this, path, ...guardedHandlers);
  }
  return originalPost.call(this, path, ...handlers);
};
