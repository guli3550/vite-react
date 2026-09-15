// Canonical customer chat boundary.
// Customer chat routes must never trust telegram_id or sender from the client.
// Identity is derived only from Telegram WebApp initData verified with the bot token.
const crypto = require('crypto');
const { registry } = require('./routeRegistry.js');

const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifiedTelegram(raw) {
  if (!BOT || !raw) return null;
  try {
    const p = new URLSearchParams(String(raw));
    const received = p.get('hash') || '';
    const authDate = Number(p.get('auth_date'));
    if (!received || !Number.isFinite(authDate)) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    p.delete('hash');
    const check = [...p.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const expected = crypto.createHmac('sha256', secret).update(check).digest('hex');
    if (!safeEqual(received, expected)) return null;
    const user = JSON.parse(p.get('user') || '{}');
    const id = Number(user?.id);
    return Number.isSafeInteger(id) && id > 0 ? { id, user } : null;
  } catch {
    return null;
  }
}

function fail(res, code, message) {
  return res.status(code).json({ success: false, message });
}

function guard(route, handler) {
  return async function canonicalCustomerChat(req, res, next) {
    const tg = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
    if (!tg) return fail(res, 401, 'Tasdiqlangan Telegram sessiyasi talab qilinadi.');

    const pathId = req.params?.telegram_id;
    if (pathId != null && String(pathId) !== String(tg.id)) {
      return fail(res, 403, 'Bu chat boshqa Telegram accountga tegishli.');
    }

    if (route === 'post') {
      if (!req.body || typeof req.body !== 'object') req.body = {};
      // Server-authoritative chat identity.
      req.body.telegram_id = tg.id;
      req.body.sender = 'customer';
    }

    return handler(req, res, next);
  };
}

for (const route of registry.routes) {
  if (route.__canonicalCustomerChatBoundary) continue;
  if (route.method === 'get' && (route.path === '/api/chat/messages/:telegram_id' || route.path === '/api/chat/stream/:telegram_id')) {
    route.handlers = route.handlers.map((h) => guard(route.path.includes('/stream/') ? 'stream' : 'get', h));
    route.__canonicalCustomerChatBoundary = true;
  }
  if (route.method === 'post' && route.path === '/api/chat/messages') {
    route.handlers = route.handlers.map((h) => guard('post', h));
    route.__canonicalCustomerChatBoundary = true;
  }
}

console.log('[CanonicalCustomerChatBoundary] customer chat identity locked to verified Telegram');
