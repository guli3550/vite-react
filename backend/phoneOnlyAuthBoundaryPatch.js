// Final auth boundary: GULI customer authentication is Telegram + verified phone only.
// This patch runs after all auth route modules have registered their routes and before Express mounts them.
const { registry } = require('./routeRegistry.js');

const BLOCKED = new Set([
  'post:/api/auth/signup',
  'post:/api/auth/signin',
  'post:/api/auth/password/signup',
  'post:/api/auth/password/login',
  'post:/api/auth/email/start',
  'post:/api/auth/email/verify',
  'post:/api/auth/password/reset-start',
  'post:/api/auth/password/reset-verify',
  'get:/api/auth/google',
  'get:/api/auth/google/callback',
]);

const CONFIG = 'get:/api/auth/config';
const message = 'Bu autentifikatsiya usuli o‘chirildi. GULI faqat Telegram orqali tasdiqlangan telefon raqami bilan kirishni qo‘llab-quvvatlaydi.';
const blockedHandler = (_req, res) => res.status(410).json({ success: false, message });
const configHandler = (_req, res) => res.json({
  success: true,
  data: {
    email_enabled: false,
    google_enabled: false,
    phone_only: true,
    auth_provider: 'telegram_phone'
  }
});

for (const route of registry.routes) {
  const key = `${route.method}:${route.path}`;
  if (BLOCKED.has(key)) route.handlers = [blockedHandler];
  if (key === CONFIG) route.handlers = [configHandler];
}

console.log('[GULI Auth] Phone-only boundary active: legacy email/Google auth disabled.');
