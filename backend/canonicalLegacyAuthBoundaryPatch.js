// Canonical customer auth boundary.
// GULI customer authentication is Telegram + verified phone only.
// This runtime guard is intentionally fail-closed and removes legacy auth
// registrations from the route registry rather than relying only on handler replacement.
const { registry, install } = require('./routeRegistry.js');

const LEGACY = new Set([
  'post:/api/auth/signup',
  'post:/api/auth/signin',
  'post:/api/auth/password/signup',
  'post:/api/auth/password/login',
  'post:/api/auth/email/start',
  'post:/api/auth/email/verify',
  'post:/api/auth/password/reset-start',
  'post:/api/auth/password/reset-verify',
  'post:/api/auth/refresh',
  'get:/api/auth/google',
  'get:/api/auth/google/callback'
]);

const message = 'Bu autentifikatsiya usuli o‘chirildi. GULI faqat Telegram orqali tasdiqlangan telefon raqami bilan kirishni qo‘llab-quvvatlaydi.';
const blocked = (_req, res) => res.status(410).json({ success: false, message });

registry.routes = registry.routes.filter((r) => !LEGACY.has(`${r.method}:${r.path}`));

for (const path of [
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/auth/password/signup',
  '/api/auth/password/login',
  '/api/auth/email/start',
  '/api/auth/email/verify',
  '/api/auth/password/reset-start',
  '/api/auth/password/reset-verify',
  '/api/auth/refresh'
]) install('post', path, blocked);

for (const path of ['/api/auth/google', '/api/auth/google/callback']) install('get', path, blocked);

install('get', '/api/auth/config', (_req, res) => res.json({
  success: true,
  data: {
    email_enabled: false,
    google_enabled: false,
    password_enabled: false,
    phone_only: true,
    auth_provider: 'telegram_phone'
  }
}));

console.log('[GULI Auth] legacy email/password/Google routes fail-closed');
