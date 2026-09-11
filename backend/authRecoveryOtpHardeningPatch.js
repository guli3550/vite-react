const { createClient } = require("@supabase/supabase-js");
const { registry } = require("./routeRegistry.js");

const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SECRET_KEY || "";
const authClient = URL && KEY
  ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

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

function fail(res, code, message) {
  return res.status(code).json({ success: false, message });
}

function ok(res, data, message = "OK") {
  return res.json({ success: true, message, data });
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

const route = registry.routes.find(
  (r) => r.method === "post" && r.path === "/api/auth/password/reset-verify"
);

if (route) {
  route.handlers = [async (req, res) => {
    if (!allowed(req)) {
      return fail(res, 429, "Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring.");
    }
    if (!authClient) {
      return fail(res, 503, "Email autentifikatsiyasi serverda sozlanmagan.");
    }

    const email = emailOf(req.body?.email);
    const token = String(req.body?.token || "").replace(/\s+/g, "");
    const password = String(req.body?.password || "");

    if (!validEmail(email) || !/^\d{6}$/.test(token)) {
      return fail(res, 400, "Email va 6 xonali tiklash kodini to‘liq kiriting.");
    }
    if (!validPassword(password)) {
      return fail(res, 400, "Yangi parol kamida 8 belgidan iborat bo‘lsin.");
    }

    try {
      // Recovery reset MUST accept only a recovery OTP.
      // Never fall back to the normal email/sign-in OTP here.
      const { data: verifyData, error: verifyError } = await authClient.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });

      if (verifyError || !verifyData?.user?.id) {
        return fail(
          res,
          401,
          verifyError?.message || "Tiklash kodi noto‘g‘ri yoki muddati tugagan."
        );
      }

      const { data: updated, error: updateError } = await authClient.auth.admin.updateUserById(
        verifyData.user.id,
        { password }
      );

      if (updateError) {
        return fail(res, 400, updateError.message || "Parolni yangilashda xatolik yuz berdi.");
      }

      return ok(
        res,
        { user: updated.user, email },
        "Parol muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin."
      );
    } catch (error) {
      console.error("[Recovery OTP Hardening Error]", error);
      return fail(res, 500, "Parolni yangilashda server xatosi yuz berdi.");
    }
  }];

  console.log("[GULI Auth] Recovery OTP route hardened: recovery-only verification enabled.");
} else {
  console.warn("[GULI Auth] Recovery OTP route was not found during patch load.");
}
