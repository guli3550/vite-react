const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry.js");

const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SECRET_KEY || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
const supabase = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const SESSION_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const hash = (value) => crypto.createHmac("sha256", KEY || "guli-auth").update(String(value)).digest("hex");
const normalizePhone = (value) => { let v = String(value || "").trim().replace(/[^\d+]/g, ""); if (v.startsWith("00")) v = "+" + v.slice(2); if (!v.startsWith("+")) v = "+" + v; return v; };
const validPhone = (v) => /^\+[1-9]\d{7,14}$/.test(v);
const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message) => res.status(code).json({ success: false, message });

async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || "Telegram API xatosi");
  return j.result;
}
async function getBotUsername() { if (BOT_USERNAME) return BOT_USERNAME; try { return String((await telegramApi("getMe", {}))?.username || ""); } catch (_) { return ""; } }

install("post", "/api/v1/auth/init-session", async (req, res) => {
  if (!supabase) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  const { error } = await supabase.from("auth_sessions").insert({ session_id: sessionId, expires_at: expiresAt });
  if (error) return fail(res, 500, "Auth sessiyasi yaratilmadi.");
  const username = await getBotUsername();
  if (!username) return fail(res, 503, "Telegram bot username sozlanmagan.");
  return ok(res, { session_id: sessionId, expires_at: expiresAt, telegram_url: `https://t.me/${username}?start=auth_${sessionId}` });
});

install("get", "/api/v1/auth/check-status/:session_id", async (req, res) => {
  if (!supabase) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const sessionId = String(req.params.session_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return fail(res, 400, "Noto'g'ri auth session.");
  const { data, error } = await supabase.from("auth_sessions").select("session_id,is_verified,exchange_ticket_used,expires_at,verified_at").eq("session_id", sessionId).maybeSingle();
  if (error || !data) return fail(res, 404, "Auth session topilmadi.");
  if (new Date(data.expires_at).getTime() < Date.now()) return ok(res, { status: "EXPIRED" });
  return ok(res, { status: data.is_verified ? "VERIFIED" : "WAITING", verified_at: data.verified_at || null });
});

install("post", "/api/v1/auth/verify-otp", async (req, res) => {
  if (!supabase) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const sessionId = String(req.body?.session_id || "");
  const otp = String(req.body?.otp || "").replace(/\s+/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^\d{6}$/.test(otp)) return fail(res, 400, "Session va 6 xonali kodni to'g'ri kiriting.");
  const { data: s, error: se } = await supabase.from("auth_sessions").select("*").eq("session_id", sessionId).maybeSingle();
  if (se || !s) return fail(res, 404, "Auth session topilmadi.");
  if (new Date(s.expires_at).getTime() < Date.now()) return fail(res, 410, "Auth session muddati tugagan.");
  if (!s.otp_hash || s.otp_used) return fail(res, 401, "Kod yaroqsiz yoki allaqachon ishlatilgan.");
  if (Number(s.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) return fail(res, 429, "Urinishlar limiti tugadi.");
  await supabase.from("auth_sessions").update({ otp_attempts: Number(s.otp_attempts || 0) + 1 }).eq("session_id", sessionId).eq("otp_used", false);
  const expected = Buffer.from(String(s.otp_hash));
  const actual = Buffer.from(hash(otp));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return fail(res, 401, "Tasdiqlash kodi noto'g'ri.");

  const phone = normalizePhone(s.phone_number);
  const telegramId = Number(s.telegram_id);
  if (!validPhone(phone) || !Number.isSafeInteger(telegramId)) return fail(res, 400, "Tasdiqlangan identity ma'lumotlari yetarli emas.");

  let userId;
  const { data: canonical } = await supabase.from("users").select("id,phone_number,telegram_id").eq("phone_number", phone).maybeSingle();
  if (canonical) {
    if (canonical.telegram_id && Number(canonical.telegram_id) !== telegramId) return fail(res, 409, "Bu telefon boshqa Telegram account bilan bog'langan.");
    userId = canonical.id;
  } else {
    const { data: byTg } = await supabase.from("users").select("id,phone_number,telegram_id").eq("telegram_id", telegramId).maybeSingle();
    if (byTg && byTg.phone_number !== phone) return fail(res, 409, "Telegram account boshqa telefon bilan bog'langan.");
    if (byTg) userId = byTg.id;
  }

  const password = crypto.randomBytes(48).toString("base64url");
  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({ phone, phone_confirm: true, password, user_metadata: { auth_source: "telegram", telegram_id: telegramId } });
    if (error || !created?.user) return fail(res, 500, "GULI Auth account yaratilmadi.");
    userId = created.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, { phone, phone_confirm: true, password });
    if (error) return fail(res, 500, "GULI Auth account yangilanmadi.");
  }

  const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({ phone, password });
  if (signErr || !signed?.session) return fail(res, 500, "Auth session chiqarilmadi.");

  await supabase.from("users").upsert({ id: userId, phone_number: phone, telegram_id: telegramId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await supabase.from("profiles").upsert({ id: userId, phone, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await supabase.from("user_identities").upsert({ user_id: userId, provider: "telegram", provider_subject: String(telegramId), provider_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "provider,provider_subject" });
  await supabase.from("user_identities").upsert({ user_id: userId, provider: "phone", provider_subject: phone, provider_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "provider,provider_subject" });
  await supabase.from("auth_sessions").update({ is_verified: true, otp_used: true, verified_at: new Date().toISOString() }).eq("session_id", sessionId).eq("otp_used", false);
  return ok(res, { user: { id: userId, phone_number: phone, telegram_id: telegramId }, access_token: signed.session.access_token, refresh_token: signed.session.refresh_token, expires_at: signed.session.expires_at });
});

install("post", "/api/v1/auth/refresh", async (req, res) => {
  if (!supabase) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const refreshToken = String(req.body?.refresh_token || "");
  if (!refreshToken) return fail(res, 400, "Refresh token talab qilinadi.");
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) return fail(res, 401, "Refresh token yaroqsiz.");
  return ok(res, { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at });
});

install("get", "/api/v1/auth/me", async (req, res) => {
  if (!supabase) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(res, 401, "Bearer token talab qilinadi.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return fail(res, 401, "Sessiya yaroqsiz.");
  const { data: user } = await supabase.from("users").select("id,phone_number,telegram_id,full_name,created_at,updated_at").eq("id", data.user.id).maybeSingle();
  return ok(res, { user: user || { id: data.user.id, phone_number: data.user.phone } });
});
