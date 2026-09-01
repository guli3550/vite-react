const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "index.js");
const identityPatchPath = path.join(__dirname, "customerIdentityPatch.js");
const reviewPatchPath = path.join(__dirname, "reviewPatchV2.js");
const manualPaymentPatchPath = path.join(__dirname, "manualCardPaymentPatch.js");
const telegramBotPatchPath = path.join(__dirname, "telegramBotPatch.js");
const telegramAdminConfigPatchPath = path.join(__dirname, "telegramAdminConfigPatch.js");
const broadcastDirectRoutePatchPath = path.join(__dirname, "broadcastDirectRoutePatch.js");
const customerAuthPatchPath = path.join(__dirname, "customerAuthPatch.js");
const paymentConfirmationRuntimePath = path.join(__dirname, "paymentConfirmationRuntime.js");
const reviewRuntimePath = path.join(__dirname, "reviewRuntime.js");
const receiptWindowRuntimePath = path.join(__dirname, "receiptWindowRuntime.js");
const paymentTelegramNotificationPatchPath = path.join(__dirname, "paymentTelegramNotificationPatch.js");
let source = fs.readFileSync(indexPath, "utf8");
const patch = fs.readFileSync(identityPatchPath, "utf8") + "\n" + fs.readFileSync(reviewPatchPath, "utf8");
const manualPaymentPatch = fs.readFileSync(manualPaymentPatchPath, "utf8");
const telegramBotPatch = fs.readFileSync(telegramBotPatchPath, "utf8");
const telegramAdminConfigPatch = fs.readFileSync(telegramAdminConfigPatchPath, "utf8");
const broadcastDirectRoutePatch = fs.readFileSync(broadcastDirectRoutePatchPath, "utf8");
const customerAuthPatch = fs.readFileSync(customerAuthPatchPath, "utf8");
const paymentConfirmationRuntime = fs.readFileSync(paymentConfirmationRuntimePath, "utf8");
const reviewRuntime = fs.readFileSync(reviewRuntimePath, "utf8");
const receiptWindowRuntime = fs.readFileSync(receiptWindowRuntimePath, "utf8");
const paymentTelegramNotificationPatch = fs.readFileSync(paymentTelegramNotificationPatchPath, "utf8");

// Production security hardening for the generated Express server.
const securityBlock = `
const GULI_RATE_BUCKETS = new Map();
function guliClientIp(req) {
  return String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}
function guliRateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = name + ":" + guliClientIp(req);
    const old = GULI_RATE_BUCKETS.get(key);
    if (!old || old.resetAt <= now) GULI_RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    else if (old.count >= limit) return res.status(429).json({ success: false, message: "Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring." });
    else old.count += 1;
    if (GULI_RATE_BUCKETS.size > 5000) {
      for (const [k, v] of GULI_RATE_BUCKETS) if (v.resetAt <= now) GULI_RATE_BUCKETS.delete(k);
    }
    next();
  };
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  next();
});
app.use("/api/admin/login", guliRateLimit("admin-login", 10, 15 * 60 * 1000));
app.use("/api/guest-session", guliRateLimit("guest-session", 20, 60 * 1000));
app.use("/api/promo/validate", guliRateLimit("promo", 30, 60 * 1000));
app.use("/api/telegram/webhook", guliRateLimit("telegram-webhook", 120, 60 * 1000));
`;

// The allowlist is declared once, before the generated source registers CORS.
const corsPrelude = `
const GULI_CORS_ORIGINS = String(process.env.CORS_ORIGINS || [process.env.VERCEL_APP_URL, process.env.MINI_APP_URL, "https://vite-react-seven-inky-10.vercel.app", "https://vite-react-guli3550.vercel.app"].filter(Boolean).join(",")).split(",").map((v) => String(v).trim().replace(/\\/$/, "")).filter(Boolean);
const GULI_CORS_SET = new Set(GULI_CORS_ORIGINS);
`;
source = source.replace(
  'app.use(cors({ origin: true }));',
  corsPrelude + 'app.use(cors({ origin(origin, callback) { if (!origin || GULI_CORS_SET.size === 0 || GULI_CORS_SET.has(String(origin).replace(/\\/$/, ""))) return callback(null, true); return callback(null, false); }, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data", "X-Guli-Guest-Token", "X-Telegram-Bot-Api-Secret-Token"] }));'
);
source = source.replace(
  'app.use(express.json({ limit: "4mb" }));',
  'app.use(express.json({ limit: "10mb" }));' + securityBlock
);
source = source.replace(
  'await telegramApi("setWebhook", { url: webhookUrl });',
  'await telegramApi("setWebhook", { url: webhookUrl, ...(process.env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: String(process.env.TELEGRAM_WEBHOOK_SECRET).slice(0, 256) } : {}) });'
);
source = source.replace(
  'app.post("/api/telegram/webhook", async (req, res) => {',
  'app.post("/api/telegram/webhook", (req, res, next) => { const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim(); if (expected && req.headers["x-telegram-bot-api-secret-token"] !== expected) return res.sendStatus(401); if (!expected && process.env.NODE_ENV === "production") console.warn("SECURITY WARNING: TELEGRAM_WEBHOOK_SECRET is not configured"); next(); }, async (req, res) => {'
);

const marker = '\nconst PORT=process.env.PORT||10000;';
if (!source.includes(marker)) throw new Error("customerServer: backend/index.js marker not found");
source = source.replace(marker, `\n${patch}\n${manualPaymentPatch}\n${telegramBotPatch}\n${telegramAdminConfigPatch}\n${broadcastDirectRoutePatch}\n${customerAuthPatch}\n${paymentConfirmationRuntime}\n${reviewRuntime}\n${receiptWindowRuntime}\n${paymentTelegramNotificationPatch}\n${marker}`);

const runner = new Function("require", "module", "exports", "__filename", "__dirname", source);
runner(require, module, module.exports, indexPath, __filename, __dirname);
