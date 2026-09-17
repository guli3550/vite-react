// Security boundary for the legacy /api/chat/messages route in index.js.
// The route historically trusted client-supplied telegram_id and sender.
// This preload wraps only that route so customer identity is server-verified.
const crypto = require("crypto");
const express = require("express");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyTelegramInitData(raw) {
  if (!BOT_TOKEN || !raw) return null;
  try {
    const params = new URLSearchParams(String(raw));
    const hash = params.get("hash") || "";
    const authDate = Number(params.get("auth_date"));
    if (!hash || !Number.isFinite(authDate)) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;

    params.delete("hash");
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
    if (!safeEqual(hash, expected)) return null;

    const user = JSON.parse(params.get("user") || "{}");
    const id = Number(user.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function resolveCustomerTelegramId(req) {
  const tgId = verifyTelegramInitData(req.headers?.["x-telegram-init-data"] || "");
  if (tgId) return tgId;

  const auth = String(req.headers?.authorization || "");
  if (auth.startsWith("Bearer ")) {
    try {
      const claims = verifyAccessToken(auth.slice(7).trim());
      const id = Number(claims?.telegram_id);
      if (Number.isSafeInteger(id) && id > 0) return id;
    } catch {}
  }

  return null;
}

const originalPost = express.application.post;
express.application.post = function guardedChatPost(path, ...handlers) {
  if (path === "/api/chat/messages" && handlers.length) {
    const guardedHandlers = [
      function chatMessageIdentityBoundary(req, res, next) {
        const telegramId = resolveCustomerTelegramId(req);
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
