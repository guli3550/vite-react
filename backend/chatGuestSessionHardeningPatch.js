// Browser chat guest sessions are server-issued and signed.
const express = require('express');
const crypto = require('crypto');
const { install } = require('./routeRegistry.js');

const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '');
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '');
const SIGNING_SECRET = ADMIN_SECRET || BOT_TOKEN;
const GUEST_TTL = 30 * 24 * 60 * 60 * 1000;

function createGuestSession() {
  const random = BigInt(`0x${crypto.randomBytes(7).toString('hex')}`);
  const guestId = -Number((random % 900000000000000n) + 100000000000000n);
  const expiresAt = Date.now() + GUEST_TTL;
  const payloadObject = { guestId, exp: expiresAt };
  const payload = Buffer.from(JSON.stringify(payloadObject)).toString('base64url');
  const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url');
  return { guest_id: guestId, token: `${payload}.${signature}`, expires_in: GUEST_TTL / 1000 };
}

install('get', '/api/chat/guest-session', (_req, res) => {
  if (!SIGNING_SECRET) return res.status(503).json({ success: false, message: 'Chat auth secret sozlanmagan' });
  return res.setHeader('Cache-Control', 'no-store').json({ success: true, ...createGuestSession() });
});

// Reject the legacy caller-supplied guest-ID endpoint before legacy handlers.
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
