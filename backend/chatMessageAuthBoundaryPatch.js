// Security boundary for the legacy /api/chat/messages route in index.js.
// The route historically trusted client-supplied telegram_id and sender.
// This preload wraps only that route so customer identity is server-verified.
const crypto = require("crypto");
const express = require("express");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
// Same signing secret chatRealtimePatch.js / chatGuestSessionHardeningPatch.js /
// chatMediaStorageRuntime.js use for guest + linked chat tokens.
const SIGNING_SECRET = ADMIN_SECRET || BOT_TOKEN;

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

// Browser guest sessions. Two token shapes exist in production and both must
// be accepted: the legacy `${id}.${exp}.${sig}` format still verified by
// chatRealtimePatch.js's own verifyGuest(), and the current
// `${base64url(JSON{guestId,exp})}.${sig}` format issued by
// chatGuestSessionHardeningPatch.js's GET /api/chat/guest-session (the only
// guest-session endpoint the frontend actually calls today).
function verifyGuestToken(raw) {
  if (!SIGNING_SECRET) return null;
  const token = String(raw || "");
  const parts = token.split(".");
  if (parts.length === 3) {
    const [id, exp, sig] = parts;
    if (!id || !exp || !sig || Number(exp) <= Date.now()) return null;
    const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(`${id}.${exp}`).digest("base64url");
    if (!safeEqual(sig, expected)) return null;
    const n = Number(id);
    return Number.isSafeInteger(n) && n < 0 ? n : null;
  }
  if (parts.length === 2) {
    const [body, sig] = parts;
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
    if (!safeEqual(sig, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      const n = Number(payload.guestId);
      if (!Number.isSafeInteger(n) || n >= 0) return null;
      if (!(Number(payload.exp) > Date.now())) return null;
      return n;
    } catch {
      return null;
    }
  }
  return null;
}

// Browser customers linked via the Telegram Login Widget
// (chatRealtimePatch.js's POST /api/chat/browser-login).
function verifyLinkedToken(raw) {
  if (!SIGNING_SECRET) return null;
  const token = String(raw || "");
  const [prefix, id, exp, sig] = token.split(".");
  if (prefix !== "linked" || !id || !exp || !sig || !(Number(exp) > Date.now())) return null;
  const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(`linked.${id}.${exp}`).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
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

  const linkedId = verifyLinkedToken(req.headers?.["x-guli-linked-token"] || "");
  if (linkedId) return linkedId;

  const guestId = verifyGuestToken(req.headers?.["x-guli-guest-token"] || "");
  if (guestId) return guestId;

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
