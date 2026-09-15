(() => {
  const express = require("express");
  const crypto = require("crypto");

  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const webhookPath = "/api/telegram/webhook";

  if (!secret) {
    console.warn("[GULI Telegram] TELEGRAM_WEBHOOK_SECRET is not configured; webhook secret validation is disabled.");
    return;
  }

  const safeEqual = (a, b) => {
    const left = Buffer.from(String(a || ""));
    const right = Buffer.from(String(b || ""));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  };

  const verifyWebhookSecret = (req, res, next) => {
    const received = String(req.headers["x-telegram-bot-api-secret-token"] || "");
    if (!safeEqual(received, secret)) {
      return res.status(401).json({ success: false, message: "Telegram webhook tasdig'i yaroqsiz." });
    }
    next();
  };

  const originalPost = express.application.post;
  express.application.post = function telegramWebhookSecretPost(path, ...handlers) {
    if (path === webhookPath) {
      return originalPost.call(this, path, verifyWebhookSecret, ...handlers);
    }
    return originalPost.call(this, path, ...handlers);
  };

  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function" && !globalThis.__GULI_TELEGRAM_WEBHOOK_SECRET_FETCH__) {
    globalThis.__GULI_TELEGRAM_WEBHOOK_SECRET_FETCH__ = true;
    globalThis.fetch = async (input, init = {}) => {
      let url = "";
      try { url = typeof input === "string" ? input : String(input?.url || ""); } catch {}
      if (!/https:\/\/api\.telegram\.org\/bot[^/]+\/setWebhook(?:\?|$)/i.test(url)) {
        return originalFetch(input, init);
      }
      try {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        headers.set("content-type", "application/json");
        const raw = typeof init?.body === "string" ? init.body : "{}";
        const body = JSON.parse(raw);
        body.secret_token = secret;
        return originalFetch(input, { ...init, headers, body: JSON.stringify(body) });
      } catch {
        return originalFetch(input, init);
      }
    };
  }

  console.log("[GULI Telegram] Webhook secret protection active.");
})();
