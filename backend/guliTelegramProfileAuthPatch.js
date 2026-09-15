// Canonical Telegram profile enrichment for browser authentication.
// Adds Telegram username/name/avatar to the same canonical GULI user returned by auth exchange.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || SUPABASE_KEY || "guli-auth").trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(telegramId, fileId, expires) {
  return crypto.createHmac("sha256", SIGN_KEY).update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`).digest("base64url");
}
function avatarUrl(telegramId, fileId) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${API_BASE}/api/v1/profile/telegram-avatar/${encodeURIComponent(telegramId)}/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(sign(telegramId, fileId, expires))}`;
}
async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || `Telegram ${method} xatosi`);
  return j.result;
}
async function getCurrentAvatar(telegramId) {
  try {
    const result = await telegramApi("getUserProfilePhotos", { user_id: Number(telegramId), offset: 0, limit: 1 });
    const sizes = Array.isArray(result?.photos?.[0]) ? result.photos[0] : [];
    const largest = sizes[sizes.length - 1];
    if (largest?.file_id) return { file_id: largest.file_id, url: avatarUrl(telegramId, largest.file_id) };
  } catch (e) {
    console.warn("[GULI profile] getUserProfilePhotos failed:", e.message);
  }
  try {
    const chat = await telegramApi("getChat", { chat_id: Number(telegramId) });
    const fileId = chat?.photo?.big_file_id || chat?.photo?.small_file_id || "";
    if (fileId) return { file_id: fileId, url: avatarUrl(telegramId, fileId) };
  } catch (e) {
    console.warn("[GULI profile] getChat avatar fallback failed:", e.message);
  }
  return null;
}

// Browser <img> cannot attach Authorization headers, so avatar access uses a
// short-lived HMAC URL. The bot token is never exposed to the browser.
express.application.get.call(express.application, "/api/v1/profile/telegram-avatar/:telegramId/:fileId", async (req, res) => {
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

// The final auth handler is wrapped at route-registration time. Its JSON response
// is held until Telegram profile data is resolved, then emitted exactly once.
const originalPost = express.application.post;
express.application.post = function guliProfilePost(routePath, ...handlers) {
  if (routePath === "/api/v1/auth/verify-otp" && handlers.length) {
    const index = handlers.length - 1;
    const handler = handlers[index];
    handlers[index] = async function enrichedVerify(req, res, next) {
      let payload = null;
      let committed = false;
      const originalJson = res.json.bind(res);
      res.json = (body) => { payload = body; return res; };
      try {
        await handler(req, res, next);
        if (payload?.success && payload?.data?.user && supabase) {
          const telegramId = Number(payload.data.user.telegram_id || 0);
          if (Number.isSafeInteger(telegramId)) {
            const { data: tg } = await supabase.from("telegram_users").select("username,first_name,last_name,telegram_phone,profile_photos").eq("telegram_id", telegramId).maybeSingle();
            const username = String(tg?.username || "").trim() || null;
            const firstName = String(tg?.first_name || "").trim();
            const lastName = String(tg?.last_name || "").trim();
            const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
            const photo = await getCurrentAvatar(telegramId);
            const avatar = photo?.url || null;
            if (payload.data.user.id) {
              await supabase.from("users").update({ ...(fullName ? { full_name: fullName } : {}), updated_at: new Date().toISOString() }).eq("id", payload.data.user.id);
              await supabase.from("profiles").upsert({ id: payload.data.user.id, full_name: fullName || null, phone: payload.data.user.phone_number || null, avatar_url: avatar, updated_at: new Date().toISOString() }, { onConflict: "id" });
              await supabase.from("user_identities").upsert({ user_id: payload.data.user.id, provider: "telegram", provider_subject: String(telegramId), provider_username: username, provider_phone: payload.data.user.phone_number || null, metadata: { username, first_name: firstName || null, last_name: lastName || null }, updated_at: new Date().toISOString() }, { onConflict: "provider,provider_subject" });
            }
            payload.data.user.full_name = fullName || payload.data.user.full_name || null;
            payload.data.user.username = username;
            payload.data.user.avatar_url = avatar;
            payload.data.user.email = username ? `@${username}` : null;
          }
        }
        if (!committed) { committed = true; return originalJson(payload || { success: false, message: "Auth javobi bo‘sh." }); }
      } catch (e) {
        console.warn("[GULI profile] auth enrichment failed:", e.message);
        if (!committed) { committed = true; return originalJson(payload || { success: false, message: "Auth javobi tayyorlanmadi." }); }
      }
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};
