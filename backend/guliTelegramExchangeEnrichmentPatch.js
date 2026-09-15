// Canonical Telegram profile enrichment for the browser auth exchange.
// This patch wraps the already-registered /api/v1/auth/exchange route so the
// browser receives the Telegram name/username/avatar in the same auth response.
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { registry } = require("./routeRegistry.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || SUPABASE_KEY || "guli-auth").trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function sign(telegramId, fileId, expires) {
  return crypto.createHmac("sha256", SIGN_KEY)
    .update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`)
    .digest("base64url");
}

function avatarUrl(telegramId, fileId) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${API_BASE}/api/v1/profile/telegram-avatar/${encodeURIComponent(telegramId)}/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(sign(telegramId, fileId, expires))}`;
}

async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || `Telegram ${method} xatosi`);
  return j.result;
}

async function getAvatar(telegramId) {
  try {
    const result = await telegramApi("getUserProfilePhotos", { user_id: Number(telegramId), offset: 0, limit: 1 });
    const sizes = Array.isArray(result?.photos?.[0]) ? result.photos[0] : [];
    const largest = sizes[sizes.length - 1];
    if (largest?.file_id) return avatarUrl(telegramId, largest.file_id);
  } catch (e) {
    console.warn("[GULI profile exchange] getUserProfilePhotos failed:", e.message);
  }
  try {
    const chat = await telegramApi("getChat", { chat_id: Number(telegramId) });
    const fileId = chat?.photo?.big_file_id || chat?.photo?.small_file_id || "";
    if (fileId) return avatarUrl(telegramId, fileId);
  } catch (e) {
    console.warn("[GULI profile exchange] getChat avatar fallback failed:", e.message);
  }
  return null;
}

async function enrich(body) {
  if (!body?.success || !body?.data?.user || !supabase) return body;
  const user = body.data.user;
  const telegramId = Number(user.telegram_id || 0);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return body;

  const { data: tg } = await supabase
    .from("telegram_users")
    .select("username,first_name,last_name,telegram_phone")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  const username = String(tg?.username || "").trim().replace(/^@+/, "") || null;
  const firstName = String(tg?.first_name || "").trim();
  const lastName = String(tg?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || String(user.full_name || "").trim() || null;
  const avatar = await getAvatar(telegramId);

  if (user.id) {
    const userPatch = {
      telegram_id: telegramId,
      telegram_username: username,
      telegram_photo_url: avatar,
      updated_at: new Date().toISOString(),
    };
    if (fullName) userPatch.full_name = fullName;
    await supabase.from("users").update(userPatch).eq("id", user.id).eq("telegram_id", telegramId);

    const profilePatch = {
      id: user.id,
      full_name: fullName,
      phone: user.phone_number || tg?.telegram_phone || null,
      updated_at: new Date().toISOString(),
    };
    if (avatar) profilePatch.avatar_url = avatar;
    await supabase.from("profiles").upsert(profilePatch, { onConflict: "id" });

    try {
      await supabase.from("user_identities").upsert({
        user_id: user.id,
        provider: "telegram",
        provider_subject: String(telegramId),
        provider_username: username,
        provider_phone: user.phone_number || tg?.telegram_phone || null,
        metadata: { username, first_name: firstName || null, last_name: lastName || null },
        updated_at: new Date().toISOString(),
      }, { onConflict: "provider,provider_subject" });
    } catch (_) {}
  }

  body.data.user = {
    id: user.id,
    phone_number: user.phone_number || tg?.telegram_phone || null,
    telegram_id: telegramId,
    full_name: fullName,
    telegram_username: username,
    telegram_photo_url: avatar,
  };
  return body;
}

function wrapRoute(path) {
  const route = registry.routes.find((r) => r.method === "post" && r.path === path);
  if (!route || !route.handlers?.length || route.__guliTelegramProfileWrapped) return false;
  const index = route.handlers.length - 1;
  const handler = route.handlers[index];
  route.handlers[index] = async function guliTelegramProfileExchange(req, res, next) {
    const originalJson = res.json.bind(res);
    let responseStarted = false;
    res.json = (body) => {
      if (responseStarted) return res;
      responseStarted = true;
      Promise.resolve(enrich(body))
        .catch((error) => {
          console.warn("[GULI profile exchange] enrichment failed:", error.message);
          return body;
        })
        .then((finalBody) => originalJson(finalBody));
      return res;
    };
    return handler(req, res, next);
  };
  route.__guliTelegramProfileWrapped = true;
  return true;
}

if (!wrapRoute("/api/v1/auth/exchange")) {
  console.warn("[GULI profile exchange] canonical auth exchange route not found at startup");
}
