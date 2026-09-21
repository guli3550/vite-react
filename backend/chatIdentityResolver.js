// Canonical server-side identity resolver for customer chat routes.
const crypto = require("crypto");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SIGNING_SECRET = String(process.env.ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || "").trim();

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

function resolveChatIdentity(req) {
  const headers = req?.headers || {};

  const tgInit = String(headers["x-telegram-init-data"] || "").trim();
  if (tgInit) {
    const telegramId = verifyTelegramInitData(tgInit);
    return telegramId ? { telegramId, authType: "telegram_init", verified: true } : null;
  }

  const linkedToken = String(headers["x-guli-linked-token"] || "").trim();
  if (linkedToken) {
    const telegramId = verifyLinkedToken(linkedToken);
    return telegramId ? { telegramId, authType: "linked_token", verified: true } : null;
  }

  const authorization = String(headers.authorization || "").trim();
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) return null;
    try {
      const claims = verifyAccessToken(authorization.slice(7).trim());
      const telegramId = Number(claims?.telegram_id);
      return Number.isSafeInteger(telegramId) && telegramId > 0
        ? { telegramId, authType: "access_token", verified: true }
        : null;
    } catch {
      return null;
    }
  }

  const guestToken = String(headers["x-guli-guest-token"] || "").trim();
  if (guestToken) {
    const telegramId = verifyGuestToken(guestToken);
    return telegramId ? { telegramId, authType: "guest", verified: true } : null;
  }

  return null;
}

module.exports = { resolveChatIdentity };
