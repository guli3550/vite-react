// Browser chat guest sessions must be server-issued.
// The legacy endpoint accepted a caller-supplied guest ID, which could mint a
// valid token for another known guest conversation. Keep the old URL blocked
// and expose a server-generated replacement endpoint.
const express = require('express');
const crypto = require('crypto');
const { install } = require('./routeRegistry.js');

const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '');
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '');
const SIGNING_SECRET = ADMIN_SECRET || BOT_TOKEN;
const GUEST_TTL = 30 * 24 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createGuestSession() {
  const random = BigInt(`0x${crypto.randomBytes(7).toString('hex')}`);
  const guestId = -Number((random % 900000000000000n) + 100000000000000n);
  const expiresAt = Date.now() + GUEST_TTL;
  const payload = `${guestId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url');
  return { guest_id: guestId, token: `${guestId}.${expiresAt}.${signature}`, expires_in: GUEST_TTL / 1000 };
}

install('get', '/api/chat/guest-session', (_req, res) => {
  if (!SIGNING_SECRET) return res.status(503).json({ success: false, message: 'Chat auth secret sozlanmagan' });
  return res.json({ success: true, ...createGuestSession() });
});

// This middleware runs before index.js routes and makes the legacy caller-
// supplied endpoint unusable. Existing clients will receive a clear migration
// response instead of a token that can be minted for an arbitrary ID.
const originalUse = express.application.use;
let installed = false;
express.application.use = function hardenedUse(...args) {
  if (!installed) {
    installed = true;
    const guard = (req, res, next) => {
      const path = String(req.path || '');
      if (/^\/api\/chat\/guest-session\/[-]?\d+$/.test(path)) {
        return res.status(410).json({ success: false, code: 'GUEST_SESSION_MIGRATED', message: 'Brauzer chat sessiyasi yangilandi. Sahifani yangilang.' });
      }
      return next();
    };
    return originalUse.call(this, guard, ...args);
  }
  return originalUse.call(this, ...args);
};
