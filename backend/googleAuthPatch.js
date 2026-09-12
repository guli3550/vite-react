const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry.js");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const DEFAULT_APP_URL = "https://vite-react-guli3550.vercel.app";
const APP_URL = String(
  process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || DEFAULT_APP_URL,
).trim().replace(/\/$/, "");

const authClient = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function safeRedirect(value) {
  const candidate = String(value || APP_URL).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return APP_URL;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return APP_URL;
  }
}

install("get", "/api/auth/google", async (req, res) => {
  if (!authClient) {
    return res.status(503).json({ success: false, message: "Google autentifikatsiyasi serverda sozlanmagan." });
  }

  try {
    const redirectTo = safeRedirect(req.query?.redirect_to || APP_URL);
    const { data, error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.error("[Google OAuth]", error?.message || "OAuth URL yaratilmadi");
      return res.status(400).json({
        success: false,
        message: error?.message || "Google orqali kirish sozlanmagan.",
      });
    }

    return res.redirect(302, data.url);
  } catch (error) {
    console.error("[Google OAuth Error]", error);
    return res.status(500).json({ success: false, message: "Google orqali kirishda server xatosi." });
  }
});

console.log("[GULI Auth] Google OAuth route registered via Supabase Auth.");
