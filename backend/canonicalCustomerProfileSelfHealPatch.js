// Canonical browser profile self-heal boundary.
// Browser auth uses a GULI-signed JWT, not a Supabase Auth JWT. This endpoint
// resolves that verified subject to the canonical Telegram customer profile.
const { createClient } = require('@supabase/supabase-js');
const { registry, install } = require('./routeRegistry.js');
const { verifyAccessToken } = require('./guliCustomAuth.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || KEY || 'guli-auth').trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const crypto = require('crypto');
const sign = (telegramId, fileId, expires) => crypto.createHmac('sha256', SIGN_KEY).update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`).digest('base64url');
const avatarUrl = (telegramId, fileId) => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${API_BASE}/api/v1/profile/telegram-avatar/${encodeURIComponent(telegramId)}/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(sign(telegramId, fileId, expires))}`;
};

async function telegramProfile(telegramId) {
  const out = { username: null, first_name: null, last_name: null, avatar_url: null };
  if (!BOT_TOKEN || !telegramId) return out;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: Number(telegramId) }) });
    const j = await r.json();
    const c = j.ok ? j.result : null;
    if (c) {
      out.username = String(c.username || '').trim() || null;
      out.first_name = String(c.first_name || '').trim() || null;
      out.last_name = String(c.last_name || '').trim() || null;
      const fileId = c.photo?.big_file_id || c.photo?.small_file_id || '';
      if (fileId) out.avatar_url = avatarUrl(telegramId, fileId);
    }
  } catch {}
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: Number(telegramId), offset: 0, limit: 1 }) });
    const j = await r.json();
    const sizes = Array.isArray(j?.result?.photos?.[0]) ? j.result.photos[0] : [];
    const largest = sizes[sizes.length - 1];
    if (largest?.file_id) out.avatar_url = avatarUrl(telegramId, largest.file_id);
  } catch {}
  return out;
}

async function me(req, res) {
  if (!supabase) return res.status(503).json({ success: false, message: 'Auth xizmati sozlanmagan.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims || claims.role !== 'customer') return res.status(401).json({ success: false, message: 'Mijoz sessiyasi yaroqsiz yoki muddati tugagan.' });
  const userId = String(claims.sub);
  const telegramId = Number(claims.telegram_id || 0);
  if (!telegramId || !Number.isSafeInteger(telegramId)) return res.status(403).json({ success: false, message: 'Telegram identity mavjud emas.' });

  const [{ data: user }, { data: customer }, { data: tg }] = await Promise.all([
    supabase.from('users').select('id,phone_number,telegram_id,full_name').eq('id', userId).maybeSingle(),
    supabase.from('customers').select('id,phone,full_name,avatar_url').eq('auth_user_id', userId).maybeSingle(),
    supabase.from('telegram_users').select('username,first_name,last_name,telegram_phone').eq('telegram_id', telegramId).maybeSingle(),
  ]);
  if (!user && !customer) return res.status(404).json({ success: false, message: 'Mijoz profili topilmadi.' });
  const p = await telegramProfile(telegramId);
  const fullName = [p.first_name || tg?.first_name, p.last_name || tg?.last_name].filter(Boolean).join(' ').trim() || user?.full_name || customer?.full_name || null;
  const username = p.username || tg?.username || null;
  const phone = String(user?.phone_number || tg?.telegram_phone || customer?.phone || claims.phone || '').trim() || null;
  const avatar = p.avatar_url || customer?.avatar_url || null;

  if (user) await supabase.from('users').update({ full_name: fullName, telegram_id: telegramId, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (userId) await supabase.from('profiles').upsert({ id: userId, full_name: fullName, phone, ...(avatar ? { avatar_url: avatar } : {}), updated_at: new Date().toISOString() }, { onConflict: 'id' });
  await supabase.from('user_identities').upsert({ user_id: userId, provider: 'telegram', provider_subject: String(telegramId), provider_username: username, provider_phone: phone, metadata: { username, first_name: p.first_name || tg?.first_name || null, last_name: p.last_name || tg?.last_name || null }, updated_at: new Date().toISOString() }, { onConflict: 'provider,provider_subject' });

  return res.json({ success: true, data: { user: { id: userId, phone_number: phone, telegram_id: telegramId, full_name: fullName, username, avatar_url: avatar, email: username ? `@${username}` : null, provider: 'telegram' } } });
}

registry.routes = registry.routes.filter((r) => !(r.method === 'get' && r.path === '/api/v1/auth/me'));
install('get', '/api/v1/auth/me', me);
console.log('[GULI profile self-heal] canonical /api/v1/auth/me active');
