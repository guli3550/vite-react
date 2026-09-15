// Final auth init boundary.
// Creates browser auth sessions through the DB-owned, rate-limited RPC.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registry, install } = require('./routeRegistry.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const SESSION_MS = 5 * 60 * 1000;
const hash = (value) => crypto.createHmac('sha256', KEY || 'guli-auth').update(String(value)).digest('hex');
const fail = (res, code, message) => res.status(code).json({ success: false, message });

async function botUsername() {
  if (BOT_USERNAME) return BOT_USERNAME;
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return '';
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: 'POST' });
    const j = await r.json();
    return String(j?.result?.username || '');
  } catch { return ''; }
}

async function initSession(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const username = await botUsername();
  if (!username) return fail(res, 503, 'Telegram bot username sozlanmagan.');

  const sessionId = crypto.randomUUID();
  const exchangeTicket = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  const requestKey = String(req.ip || req.socket?.remoteAddress || 'unknown').trim().slice(0, 200);

  const { data, error } = await supabase.rpc('create_auth_session', {
    p_session_id: sessionId,
    p_ticket_hash: hash(exchangeTicket),
    p_expires_at: expiresAt,
    p_request_key: requestKey,
  });
  if (error) {
    if (/rate limit exceeded/i.test(String(error.message || ''))) return fail(res, 429, 'Juda ko‘p login sessiyasi yaratildi. Bir daqiqadan keyin qayta urinib ko‘ring.');
    console.error('[Canonical auth init]', error);
    return fail(res, 503, 'Auth sessiyasi yaratilmadi.');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail(res, 503, 'Auth sessiyasi yaratilmadi.');
  return res.json({ success: true, data: {
    session_id: sessionId,
    exchange_ticket: exchangeTicket,
    expires_at: expiresAt,
    telegram_url: `https://t.me/${username}?start=auth_${sessionId}`
  }});
}

registry.routes = registry.routes.filter((r) => !(r.method === 'post' && r.path === '/api/v1/auth/init-session'));
install('post', '/api/v1/auth/init-session', initSession);
console.log('[CanonicalAuthInitBoundary] DB-backed auth-session creation rate limit active');
