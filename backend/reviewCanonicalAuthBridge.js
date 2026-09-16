// Canonical review identity bridge.
// Browser auth is GULI JWT -> public.users.id. Mini App auth is validated Telegram initData.
// The review runtime consumes Telegram identity internally, so this bridge converts a
// verified GULI JWT into an equivalent server-internal identity without trusting client fields.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { verifyAccessToken } = require('./guliCustomAuth.js');
const { install } = require('./routeRegistry.js');

const URL = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const db = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function makeInternalTelegramInitData(user) {
  const authDate = Math.floor(Date.now() / 1000);
  const userPayload = JSON.stringify({
    id: Number(user.telegram_id),
    first_name: user.first_name || '',
    last_name: user.last_name || undefined,
    username: user.username || undefined,
    photo_url: user.photo_url || undefined,
  });
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', userPayload);
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function bridge(req, res, next) {
  if (req.headers['x-telegram-init-data']) return next();
  if (!db || !BOT_TOKEN) return next();
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return next();
  try {
    const claims = verifyAccessToken(authorization.slice(7).trim());
    if (!claims?.sub) return next();
    const { data: user, error } = await db.from('users')
      .select('id,telegram_id,username,first_name,last_name,avatar_url')
      .eq('id', String(claims.sub))
      .maybeSingle();
    if (error || !user?.telegram_id) return next();
    const internalInitData = makeInternalTelegramInitData(user);
    req.headers['x-telegram-init-data'] = internalInitData;
    return next();
  } catch {
    return next();
  }
}

// Register the same middleware for both review endpoints before the canonical review runtime.
install('get', '/api/reviews/can-review', bridge);
install('post', '/api/reviews', bridge);
