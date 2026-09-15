// Canonical Telegram profile enrichment for browser authentication.
// Serves the signed avatar proxy that the canonical /api/v1/auth/verify-otp
// and /api/v1/auth/me handlers (canonicalTelegramProfileIdentityBoundaryPatch.js,
// canonicalCustomerProfileSelfHealPatch.js) build telegram-avatar URLs against.
//
// ROOT-CAUSE FIX (profile "Y" avatar + stray email icon):
// This file used to ALSO wrap POST /api/v1/auth/verify-otp a second time via a
// direct express.application.post monkeypatch (an older, now-superseded
// enrichment path that ran *after* the canonical enrichment layer below it in
// the require() chain). Because it ran last, it silently overwrote the
// already-correct canonical response with its own redundant Telegram API
// call - and it explicitly set `payload.data.user.email = '@' + username`,
// which is why the customer profile UI showed a leftover email icon
// displaying the Telegram username, and why the avatar sometimes reverted to
// the "Y" letter fallback when this second, redundant Telegram API call
// happened to fail or hit a rate limit that the canonical call did not.
// The canonical patches (canonicalTelegramProfileIdentityBoundaryPatch.js /
// canonicalCustomerProfileSelfHealPatch.js) already perform this enrichment
// correctly and do not set an email field, so this duplicate wrapper has
// been removed. Only the shared avatar-proxy route remains here.
const crypto = require("crypto");
const { install } = require("./routeRegistry.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || SUPABASE_KEY || "guli-auth").trim();

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(telegramId, fileId, expires) {
  return crypto.createHmac("sha256", SIGN_KEY).update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`).digest("base64url");
}
async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || `Telegram ${method} xatosi`);
  return j.result;
}

// Browser <img> cannot attach Authorization headers, so avatar access uses a
// short-lived HMAC URL. The bot token is never exposed to the browser.
install("get", "/api/v1/profile/telegram-avatar/:telegramId/:fileId", async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    const fileId = String(req.params.fileId || "");
    const expires = Number(req.query?.expires);
    const signature = String(req.query?.signature || "");
    if (!Number.isSafeInteger(telegramId) || !fileId || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !safeEqual(signature, sign(telegramId, fileId, expires))) return res.status(403).end();
    const file = await telegramApi("getFile", { file_id: fileId });
    if (!file?.file_path) return res.status(404).end();
    const r = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
    if (!r.ok) return res.status(502).end();
    const bytes = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.set("Content-Length", String(bytes.length));
    res.set("Cache-Control", "private, max-age=3600");
    return res.send(bytes);
  } catch (e) {
    console.error("[GULI profile] avatar proxy:", e.message);
    return res.status(502).end();
  }
});
