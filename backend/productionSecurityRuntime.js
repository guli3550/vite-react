// GULI production security runtime.
// Loaded before backend/index.js so the live Render entrypoint gets the same
// security controls as the generated customerServer path.
const express = require('express');

const MAX_JSON_LIMIT = '10mb';
const TELEGRAM_INITDATA_MAX_AGE_SECONDS = 60 * 60;
const buckets = new Map();
const securedApps = new WeakSet();
const originalUse = express.application.use;
const originalFetch = global.fetch;

function corsOrigins() {
  return new Set(
    String(process.env.CORS_ORIGINS || [process.env.VERCEL_APP_URL, process.env.MINI_APP_URL].filter(Boolean).join(','))
      .split(',')
      .map((v) => String(v).trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimit(req, key, limit, windowMs) {
  const now = Date.now();
  const bucketKey = `${key}:${clientIp(req)}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function cleanBuckets(now = Date.now()) {
  if (buckets.size <= 5000) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

function freshTelegramInitData(initData) {
  if (!initData) return true;
  try {
    const authDate = Number(new URLSearchParams(String(initData)).get('auth_date'));
    if (!Number.isFinite(authDate)) return false;
    return Math.abs(Math.floor(Date.now() / 1000) - authDate) <= TELEGRAM_INITDATA_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}

function securityMiddleware(req, res, next) {
  const origin = String(req.headers.origin || '').trim().replace(/\/$/, '');
  const origins = corsOrigins();
  if (origin && origins.size && !origins.has(origin)) {
    return res.status(403).json({ success: false, message: 'Origin ruxsat etilmagan' });
  }

  const initData = String(req.headers['x-telegram-init-data'] || '');
  if (initData && !freshTelegramInitData(initData)) {
    return res.status(401).json({ success: false, message: 'Telegram sessiyasi eskirgan. Mini Appni qayta oching.' });
  }

  if (req.path === '/api/telegram/webhook') {
    const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (!expected && String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      return res.status(503).json({ success: false, message: 'Telegram webhook secret sozlanmagan' });
    }
    if (expected && req.headers['x-telegram-bot-api-secret-token'] !== expected) return res.sendStatus(401);
  }

  const path = String(req.path || '');
  const limits = path === '/api/admin/login'
    ? ['admin-login', 10, 15 * 60 * 1000]
    : path === '/api/guest-session'
      ? ['guest-session', 20, 60 * 1000]
      : path === '/api/promo/validate'
        ? ['promo', 30, 60 * 1000]
        : path === '/api/telegram/webhook'
          ? ['telegram-webhook', 120, 60 * 1000]
          : null;
  if (limits) {
    if (!rateLimit(req, ...limits)) return res.status(429).json({ success: false, message: 'Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring.' });
    cleanBuckets();
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
}

function isJsonParser(fn) {
  if (typeof fn !== 'function') return false;
  return fn.name === 'jsonParser' || /function\s+jsonParser\s*\(/.test(Function.prototype.toString.call(fn));
}

express.application.use = function productionSecurityUse(...args) {
  if (!securedApps.has(this)) {
    securedApps.add(this);
    originalUse.call(this, securityMiddleware);
  }
  const nextArgs = args.map((arg) => (isJsonParser(arg) ? express.json({ limit: MAX_JSON_LIMIT }) : arg));
  return originalUse.apply(this, nextArgs);
};

// Ensure every Telegram setWebhook call carries the secret_token, including
// legacy calls that still originate from backend/index.js.
if (typeof originalFetch === 'function') {
  global.fetch = async function productionSecurityFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (/^https:\/\/api\.telegram\.org\/bot[^/]+\/setWebhook(?:\?|$)/i.test(url)) {
      const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
      if (secret) {
        let body = init.body;
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : null;
          if (parsed && typeof parsed === 'object') {
            parsed.secret_token = secret.slice(0, 256);
            body = JSON.stringify(parsed);
            init = { ...init, body };
          }
        } catch {}
      }
    }
    return originalFetch(input, init);
  };
}

console.log('[Production security] CORS allowlist, 10mb JSON, Telegram freshness, webhook secret and rate limits armed');
