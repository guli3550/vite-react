// Production webhook hardening: reject unsigned Telegram webhook requests.
// Loaded before index.js and before telegramRuntimePatch.js.
const express = require("express");
const crypto = require("crypto");

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const originalPost = express.application.post;
express.application.post = function webhookSecurityPost(path, ...handlers) {
  if (path === "/api/telegram/webhook" && handlers.length) {
    const guard = function telegramWebhookSecurity(req, res, next) {
      const supplied = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (!SECRET || !safeEqual(supplied, SECRET)) {
        return res.status(401).json({ success: false, message: "Unauthorized webhook" });
      }
      return next();
    };

    // Preserve every existing route middleware/handler; only prepend the guard.
    return originalPost.call(this, path, guard, ...handlers);
  }
  return originalPost.call(this, path, ...handlers);
};
