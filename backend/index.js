const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
let sharp = null;
try {
  sharp = require("sharp");
} catch (e) {
  console.warn("[Startup] Optional dependency 'sharp' could not be loaded:", e.message);
}
const { listProducts, getProduct } = require("./catalog");
const { getLimitsMap, getPromoLimit, setPromoLimit, deletePromoLimit, calculatePromoDiscount } = require("./promoLimits");

const app = express();

// Render/Cloudflare reverse-proxy boundary: trust exactly one proxy hop.
app.set("trust proxy", 1);

const ALLOWED_STATIC_ORIGINS = new Set([
  "https://guli-gateway.parizodabaxtiyorov.workers.dev",
  "https://vite-react-seven-inky-10.vercel.app",
  "https://gulii.uz",
  "https://www.gulii.uz",
  "https://guli-lingerie.pages.dev",
  "https://guli3550.github.io",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "https://web.telegram.org",
  "https://t.me",
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = String(origin).trim().replace(/\/+$/, "");
  const envOrigins = String(process.env.CORS_ORIGINS || "")
    .split(/[\s,]+/)
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (envOrigins.includes(normalized)) return true;
  if (ALLOWED_STATIC_ORIGINS.has(normalized)) return true;
  if (process.env.NODE_ENV !== "production") {
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) return true;
  }
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Telegram-Init-Data",
    "X-GULI-Client",
    "X-Guli-Guest-Token",
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "15mb" }));

function cleanEnv(val) {
  return String(val || "").trim().replace(/^['"]|['"]$/g, "");
}