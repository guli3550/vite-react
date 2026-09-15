const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SECRET_KEY || "";
const MINI_APP_URL = (process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/").trim();

const authClient = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const PHONE_ONLY_AUTH = true;

const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 15;

function allowed(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  const now = Date.now();
  const x = buckets.get(ip) || { start: now, count: 0 };
  if (now - x.start > WINDOW_MS) {
    x.start = now;
    x.count = 0;
  }
  x.count += 1;
  buckets.set(ip, x);
  return x.count <= MAX_ATTEMPTS;
}

function emailOf(v) {
  return String(v || "").trim().toLowerCase();
}
function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function validPassword(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 128;
}

function fail(res, code, message) {
  return res.status(code).json({ success: false, message });
}
function ok(res, data, message = "OK") {
  return res.json({ success: true, message, data });
}
function phoneOnlyBlocked(res) {
  return fail(res, 410, "Bu autentifikatsiya usuli o‘chirildi. GULI faqat Telegram orqali telefon raqami bilan kirishni qo‘llab-quvvatlaydi.");
}

const { install } = require("./routeRegistry.js");

// Legacy email authentication is intentionally disabled. Canonical auth is Telegram phone-only.
install("post", "/api/auth/password/signup", async (_req, res) => phoneOnlyBlocked(res));
install("post", "/api/auth/password/login", async (_req, res) => phoneOnlyBlocked(res));
install("post", "/api/auth/email/start", async (_req, res) => phoneOnlyBlocked(res));
install("post", "/api/auth/email/verify", async (_req, res) => phoneOnlyBlocked(res));
install("post", "/api/auth/password/reset-start", async (_req, res) => phoneOnlyBlocked(res));
install("post", "/api/auth/password/reset-verify", async (_req, res) => phoneOnlyBlocked(res));

// Keep these helpers referenced for compatibility with any code importing this module.
void express;
void MINI_APP_URL;
void authClient;
void PHONE_ONLY_AUTH;
void emailOf;
void validEmail;
void validPassword;
void allowed;
void ok;

// Customer sync is intentionally left to the authenticated canonical bridge.
install("post", "/api/customer/sync", async (req, res) => {
  if (!authClient) return fail(res, 503, "Auth xizmati sozlanmagan.");
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return fail(res, 401, "Mijoz sessiyasi talab qilinadi.");
  try {
    const { data: userData, error: userErr } = await authClient.auth.getUser(authHeader.slice(7));
    if (userErr || !userData?.user) return fail(res, 401, "Sessiya yaroqsiz yoki muddati o‘tgan.");
    const user = userData.user;
    const email = null;
    const fullName = String(req.body?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
    const phone = String(req.body?.phone || user.phone || user.user_metadata?.phone || "").trim();
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || req.body?.avatar_url || null;
    const provider = "telegram";
    const { data: customerRow, error: syncErr } = await authClient.from("customers").upsert({
      auth_user_id: user.id,
      email,
      full_name: fullName || null,
      phone: phone || null,
      avatar_url: avatarUrl,
      auth_provider: provider,
      updated_at: new Date().toISOString(),
    }, { onConflict: "auth_user_id" }).select().single();
    if (!syncErr && customerRow) return ok(res, customerRow, "Mijoz profili yangilandi.");
    return ok(res, { auth_user_id: user.id, email, full_name: fullName, phone, avatar_url: avatarUrl, provider }, "Sessiya tasdiqlandi.");
  } catch (e) {
    return fail(res, 500, e.message || "Mijoz profilini sinxronlashda xatolik.");
  }
});

module.exports = {};