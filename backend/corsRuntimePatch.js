// Production CORS guard loaded before backend/index.js.
// The existing app calls cors({ origin: true }); this patch forces an allowlist
// without requiring a risky rewrite of the large legacy index.js file.
const corsPath = require.resolve("cors");
const originalCors = require(corsPath);

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/, "");
const configuredOrigins = [
  process.env.MINI_APP_URL,
  ...(String(process.env.ALLOWED_ORIGINS || "").split(",")),
].map(normalizeOrigin).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

require.cache[corsPath].exports = function productionCors(options = {}) {
  return originalCors({
    ...options,
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.has(normalized)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
  });
};

if (allowedOrigins.size === 0) {
  console.error("[CORS] No allowed origins configured; browser cross-origin requests will be blocked.");
} else {
  console.log(`[CORS] Allowlist configured for ${allowedOrigins.size} origin(s).`);
}
