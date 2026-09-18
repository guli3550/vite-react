// GULI admin & runtime environment normalization
// Normalizes ADMIN_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY across index.js and all patch modules.
// This runs before the other preload patches and does not change the values,
// only removes accidental surrounding whitespace/quotes from the deployment env.

function cleanEnv(val) {
  if (typeof val !== "string") return "";
  return val.trim().replace(/^['"]|['"]$/g, "");
}

const adminSecret = cleanEnv(process.env.ADMIN_SECRET);
if (adminSecret) {
  process.env.ADMIN_SECRET = adminSecret;
}

const adminUser = cleanEnv(process.env.ADMIN_USERNAME);
if (adminUser) {
  process.env.ADMIN_USERNAME = adminUser;
}

const adminPass = cleanEnv(process.env.ADMIN_PASSWORD);
if (adminPass) {
  process.env.ADMIN_PASSWORD = adminPass;
}

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
if (supabaseUrl) {
  process.env.SUPABASE_URL = supabaseUrl;
  if (!process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = supabaseUrl;
  }
}

const supabaseSecret = cleanEnv(
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY
);
if (supabaseSecret) {
  process.env.SUPABASE_SECRET_KEY = supabaseSecret;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseSecret;
  }
}

const botToken = cleanEnv(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN);
if (botToken) {
  process.env.TELEGRAM_BOT_TOKEN = botToken;
}

