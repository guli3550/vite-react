// Production webhook hardening: reject unsigned Telegram webhook requests.
// Loaded before index.js and before telegramRuntimePatch.js.
const express = require("express");
const crypto = require("crypto");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const originalPost = express.application.post;
express.application.post = function webhookSecurityPost(path, ...handlers) {
  if (path === "/api/telegram/webhook" && handlers.length) {
    const wrapped = async function telegramWebhookSecurity(req, res, next) {
      // Do not silently protect production with an empty configured secret.
      // A deterministic token is derived only when TELEGRAM_WEBHOOK_SECRET is
      // intentionally absent, preserving compatibility with existing installs.
      const expected = SECRET || (BOT_TOKEN ? crypto.createHash("sha256").update(BOT_TOKEN).digest("hex").slice(0, 32) : "");
      const supplied = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (!expected || !safeEqual(supplied, expected)) {
        return res.status(401).json({ success: false, message: "Unauthorized webhook" });
      }
      return handlers[handlers.length - 1](req, res, next);
    };
    const nextHandlers = handlers.slice(0, -1).concat(wrapped);
    return originalPost.call(this, path, ...nextHandlers);
  }
  return originalPost.call(this, path, ...handlers);
};

process.env.TELEGRAM_WEBHOOK_SECRET = SECRET || (BOT_TOKEN ? crypto.createHash("sha256").update(BOT_TOKEN).digest("hex").slice(0, 32) : "");
