// GULI P0: Telegram-only canonical authentication guard.
// This guard disables legacy email/password and Google authentication routes
// without deleting legacy schema/data. The canonical login is Telegram ->
// verified phone/contact -> public.users -> GULI JWT/session.
const express = require('express');

const BLOCKED = new Set([
  'POST /api/auth/signup',
  'POST /api/auth/signin',
  'POST /api/auth/password/login',
  'POST /api/auth/password/signup',
  'GET /api/auth/google',
  'GET /api/auth/google/callback'
]);

if (!globalThis.__GULI_CANONICAL_AUTH_ONLY_GUARD__) {
  globalThis.__GULI_CANONICAL_AUTH_ONLY_GUARD__ = true;

  const wrap = (method) => {
    const original = express.application[method];
    if (typeof original !== 'function') return;
    express.application[method] = function canonicalAuthOnly(routePath, ...handlers) {
      const key = `${String(method).toUpperCase()} ${routePath}`;
      if (!BLOCKED.has(key)) return original.call(this, routePath, ...handlers);
      return original.call(this, routePath, (_req, res) => res.status(410).json({
        success: false,
        code: 'TELEGRAM_ONLY_AUTH',
        message: 'GULI autentifikatsiyasi faqat Telegram orqali amalga oshiriladi.'
      }));
    };
  };

  ['get', 'post'].forEach(wrap);
  console.log('[GULI Auth] Telegram-only canonical authentication guard active.');
}

module.exports = { BLOCKED };
