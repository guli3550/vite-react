const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SECRET_KEY || "";
const MINI_APP_URL = (process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/").trim();

const authClient = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

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

function install(method, path, handler) {
  const original = express.application[method];
  express.application[method] = function authRoute(routePath, ...handlers) {
    if (routePath === path) return original.call(this, routePath, handler, ...handlers);
    return original.call(this, routePath, ...handlers);
  };
}

// 1. Email Sign-up (Supabase Auth)
install("post", "/api/auth/password/signup", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  const password = String(req.body?.password || "");
  const fullName = String(req.body?.full_name || "").trim();
  const phone = String(req.body?.phone || "").trim();

  if (!validEmail(email)) return fail(res, 400, "Email manzilini to‘g‘ri kiriting.");
  if (!validPassword(password)) return fail(res, 400, "Parol kamida 8 belgidan iborat bo‘lsin.");

  try {
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (error) return fail(res, 400, error.message || "Ro‘yxatdan o‘tib bo‘lmadi.");

    // Sync to customers table if user created
    if (data?.user?.id) {
      try {
        await authClient.from("customers").upsert({
          auth_user_id: data.user.id,
          email,
          full_name: fullName || email.split("@")[0],
          phone: phone || null,
          auth_provider: "email",
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id" });
      } catch (custErr) {
        console.warn("[Customer Sync] table upsert note:", custErr.message);
      }
    }

    if (data?.session) {
      return ok(res, {
        user: data.user,
        session: data.session,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }, "Muvaffaqiyatli ro‘yxatdan o‘tdingiz!");
    }

    return ok(res, {
      user: data.user,
      session: null,
      email,
      requiresCode: true,
    }, "Hisob yaratildi. Emailingizga 6 xonali tasdiqlash kodi yuborildi.");
  } catch (err) {
    console.error("[Signup Error]", err);
    return fail(res, 500, "Ro‘yxatdan o‘tishda server xatosi yuz berdi.");
  }
});

// 2. Email Password Login (Supabase Auth)
install("post", "/api/auth/password/login", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  const password = String(req.body?.password || "");

  if (!validEmail(email) || !password) return fail(res, 400, "Email va parolni to'liq kiriting.");

  try {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (/email not confirmed/i.test(error.message || "")) {
        return fail(res, 401, "Avval pochtangizga borgan tasdiqlash kodini kiriting.");
      }
      return fail(res, 401, "Email yoki parol noto‘g‘ri.");
    }

    // Sync to customers table on login
    if (data?.user?.id) {
      try {
        await authClient.from("customers").upsert({
          auth_user_id: data.user.id,
          email,
          full_name: data.user.user_metadata?.full_name || email.split("@")[0],
          phone: data.user.user_metadata?.phone || null,
          auth_provider: "email",
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id" });
      } catch (custErr) {
        console.warn("[Customer Sync] table upsert note:", custErr.message);
      }
    }

    return ok(res, {
      user: data.user,
      session: data.session,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      email,
    }, "Xush kelibsiz!");
  } catch (error) {
    console.error("[Login Error]", error);
    return fail(res, 500, "Kirishda server xatosi yuz berdi.");
  }
});

// 3. Email OTP Start (Send 6-digit OTP code to real email)
install("post", "/api/auth/email/start", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  if (!validEmail(email)) return fail(res, 400, "Email manzilini to‘g‘ri kiriting.");

  try {
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      return fail(res, 400, error.message || "Tasdiqlash kodi yuborilmadi.");
    }

    return ok(res, { email }, `Tasdiqlash kodi ${email} manziliga yuborildi.`);
  } catch (error) {
    console.error("[OTP Start Error]", error);
    return fail(res, 500, "Tasdiqlash kodini yuborishda xatolik yuz berdi.");
  }
});

// 4. Email OTP Verify (Verify genuine code)
install("post", "/api/auth/email/verify", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  const token = String(req.body?.token || "").replace(/\s+/g, "");

  if (!validEmail(email) || !/^[0-9]{6}$/.test(token)) {
    return fail(res, 400, "Pochtaga yuborilgan 6 xonali tasdiqlash kodini to‘g‘ri kiriting.");
  }

  try {
    let verifyRes = await authClient.auth.verifyOtp({ email, token, type: "email" });
    if (verifyRes.error) {
      verifyRes = await authClient.auth.verifyOtp({ email, token, type: "signup" });
    }

    if (verifyRes.error || !verifyRes.data?.session) {
      return fail(res, 401, verifyRes.error?.message || "Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan.");
    }

    const { user, session } = verifyRes.data;

    // Sync to customers table
    if (user?.id) {
      try {
        await authClient.from("customers").upsert({
          auth_user_id: user.id,
          email,
          full_name: user.user_metadata?.full_name || email.split("@")[0],
          phone: user.user_metadata?.phone || null,
          auth_provider: "email",
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id" });
      } catch (custErr) {
        console.warn("[Customer Sync] table upsert note:", custErr.message);
      }
    }

    return ok(res, {
      user,
      session,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      email,
    }, "Email muvaffaqiyatli tasdiqlandi!");
  } catch (error) {
    console.error("[OTP Verify Error]", error);
    return fail(res, 500, "Tasdiqlash kodini tekshirishda server xatosi.");
  }
});

// 5. Password Reset Start (Send recovery code)
install("post", "/api/auth/password/reset-start", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  if (!validEmail(email)) return fail(res, 400, "Email manzilini to‘g‘ri kiriting.");

  try {
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: MINI_APP_URL,
    });

    if (error) return fail(res, 400, error.message || "Parolni tiklash so‘rovi qabul qilinmadi.");

    return ok(res, { email }, `Parolni tiklash kodi ${email} manziliga yuborildi.`);
  } catch (error) {
    console.error("[Reset Start Error]", error);
    return fail(res, 500, "Parolni tiklashda server xatosi.");
  }
});

// 6. Password Reset Verify (Genuine recovery OTP verification + update password)
install("post", "/api/auth/password/reset-verify", async (req, res) => {
  if (!allowed(req)) return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
  if (!authClient) return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");

  const email = emailOf(req.body?.email);
  const token = String(req.body?.token || "").replace(/\s+/g, "");
  const password = String(req.body?.password || "");

  if (!validEmail(email) || !token) return fail(res, 400, "Email va tasdiqlash kodini to'liq kiriting.");
  if (!validPassword(password)) return fail(res, 400, "Yangi parol kamida 8 belgidan iborat bo‘lsin.");

  try {
    // Strictly verify recovery OTP with Supabase Auth
    let verifyResult = await authClient.auth.verifyOtp({ email, token, type: "recovery" });
    if (verifyResult.error) {
      verifyResult = await authClient.auth.verifyOtp({ email, token, type: "email" });
    }

    if (verifyResult.error || !verifyResult.data?.user) {
      return fail(res, 401, verifyResult.error?.message || "Tasdiqlash kodi noto‘g‘ri yoki muddati tugagan.");
    }

    const userId = verifyResult.data.user.id;
    const { data: updated, error: updateErr } = await authClient.auth.admin.updateUserById(userId, { password });

    if (updateErr) {
      return fail(res, 400, updateErr.message || "Parolni yangilashda xatolik yuz berdi.");
    }

    return ok(res, {
      user: updated.user,
      email,
    }, "Parol muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.");
  } catch (error) {
    console.error("[Reset Verify Error]", error);
    return fail(res, 500, error.message || "Parolni yangilashda server xatosi.");
  }
});

// 7. Customer Sync Endpoint (Upsert into customers table upon any auth)
install("post", "/api/customer/sync", async (req, res) => {
  if (!authClient) return fail(res, 503, "Auth xizmati sozlanmagan.");

  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return fail(res, 401, "Mijoz sessiyasi talab qilinadi.");
  }

  const token = authHeader.slice(7);
  try {
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return fail(res, 401, "Sessiya yaroqsiz yoki muddati o‘tgan.");
    }

    const user = userData.user;
    const email = user.email || req.body?.email || "";
    const fullName = String(req.body?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0] || "").trim();
    const phone = String(req.body?.phone || user.phone || user.user_metadata?.phone || "").trim();
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || req.body?.avatar_url || null;
    const provider = user.app_metadata?.provider || (user.identities && user.identities[0]?.provider) || req.body?.auth_provider || "email";

    try {
      const { data: customerRow, error: syncErr } = await authClient
        .from("customers")
        .upsert({
          auth_user_id: user.id,
          email: email || null,
          full_name: fullName || null,
          phone: phone || null,
          avatar_url: avatarUrl,
          auth_provider: provider,
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id" })
        .select()
        .single();

      if (!syncErr && customerRow) {
        return ok(res, customerRow, "Mijoz profili yangilandi.");
      }
    } catch (tableErr) {
      console.warn("[Customer Table Notice]:", tableErr.message);
    }

    return ok(res, {
      auth_user_id: user.id,
      email,
      full_name: fullName,
      phone,
      avatar_url: avatarUrl,
      provider,
    }, "Sessiya tasdiqlandi.");
  } catch (e) {
    return fail(res, 500, e.message || "Mijoz profilini sinxronlashda xatolik.");
  }
});

module.exports = {};
