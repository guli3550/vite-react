// Final Telegram profile enrichment boundary.
// Loaded late so the canonical browser auth exchange response is normalized
// to the single phone + Telegram identity contract.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registry } = require('./routeRegistry.js');

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || SUPABASE_KEY || 'guli-auth').trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const sign = (telegramId, fileId, expires) => crypto.createHmac('sha256', SIGN_KEY).update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`).digest('base64url');
const avatarUrl = (telegramId, fileId) => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${API_BASE}/api/v1/profile/telegram-avatar/${encodeURIComponent(telegramId)}/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(sign(telegramId, fileId, expires))}`;
};

async function tg(method, body) {
  if (!BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  return j.ok ? j.result : null;
}

async function profile(telegramId) {
  const out = { username: null, first_name: null, last_name: null, avatar_url: null };
  if (!telegramId) return out;
  try {
    const chat = await tg('getChat', { chat_id: Number(telegramId) });
    if (chat) {
      out.username = String(chat.username || '').trim().replace(/^@+/, '') || null;
      out.first_name = String(chat.first_name || '').trim() || null;
      out.last_name = String(chat.last_name || '').trim() || null;
      const photoId = chat.photo?.big_file_id || chat.photo?.small_file_id || '';
      if (photoId) out.avatar_url = avatarUrl(telegramId, photoId);
    }
  } catch (e) { console.warn('[GULI final profile] getChat failed:', e.message); }

  try {
    const photos = await tg('getUserProfilePhotos', { user_id: Number(telegramId), offset: 0, limit: 1 });
    const sizes = Array.isArray(photos?.photos?.[0]) ? photos.photos[0] : [];
    const largest = sizes[sizes.length - 1];
    if (largest?.file_id) out.avatar_url = avatarUrl(telegramId, largest.file_id);
  } catch (e) { console.warn('[GULI final profile] getUserProfilePhotos failed:', e.message); }

  if (supabase && (!out.username || !out.first_name || !out.last_name)) {
    try {
      const { data: row } = await supabase.from('telegram_users').select('username,first_name,last_name,telegram_phone').eq('telegram_id', telegramId).maybeSingle();
      if (row) {
        out.username ||= String(row.username || '').trim().replace(/^@+/, '') || null;
        out.first_name ||= String(row.first_name || '').trim() || null;
        out.last_name ||= String(row.last_name || '').trim() || null;
      }
    } catch (e) { console.warn('[GULI final profile] DB fallback failed:', e.message); }
  }
  return out;
}

async function enrich(body) {
  if (!body?.success || !body?.data?.user) return body;
  const user = body.data.user;
  const telegramId = Number(user.telegram_id || 0);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return body;

  const p = await profile(telegramId);
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || String(user.full_name || '').trim() || null;
  const phone = user.phone_number || null;

  if (supabase && user.id) {
    try {
      await supabase.from('users').update({
        ...(fullName ? { full_name: fullName } : {}),
        telegram_id: telegramId,
        telegram_username: p.username,
        telegram_photo_url: p.avatar_url,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).eq('telegram_id', telegramId);
      await supabase.from('profiles').upsert({ id: user.id, ...(fullName ? { full_name: fullName } : {}), phone, ...(p.avatar_url ? { avatar_url: p.avatar_url } : {}), updated_at: new Date().toISOString() }, { onConflict: 'id' });
      await supabase.from('user_identities').upsert({ user_id: user.id, provider: 'telegram', provider_subject: String(telegramId), provider_username: p.username, provider_phone: phone, metadata: { username: p.username, first_name: p.first_name, last_name: p.last_name }, updated_at: new Date().toISOString() }, { onConflict: 'provider,provider_subject' });
    } catch (e) { console.warn('[GULI final profile] persistence failed:', e.message); }
  }

  body.data.user = {
    id: user.id,
    phone_number: phone,
    telegram_id: telegramId,
    full_name: fullName,
    telegram_username: p.username,
    telegram_photo_url: p.avatar_url,
  };
  console.log(`[GULI final profile] enriched telegram=${telegramId} username=${p.username || '-'} name=${fullName || '-'} avatar=${p.avatar_url ? 'yes' : 'no'}`);
  return body;
}

function installFinal() {
  const route = registry.routes.find(r => r.method === 'post' && r.path === '/api/v1/auth/exchange');
  if (!route || !route.handlers?.length) {
    console.warn('[GULI final profile] exchange route not found');
    return;
  }
  if (route.__guliFinalProfileWrapped) return;
  const original = route.handlers[route.handlers.length - 1];
  route.handlers[route.handlers.length - 1] = async function finalProfileExchange(req, res, next) {
    const originalJson = res.json.bind(res);
    let handled = false;
    res.json = (body) => {
      if (handled) return res;
      handled = true;
      Promise.resolve(enrich(body)).catch(e => console.warn('[GULI final profile] enrichment failed:', e.message)).then(finalBody => originalJson(finalBody));
      return res;
    };
    return original(req, res, next);
  };
  route.__guliFinalProfileWrapped = true;
  console.log('[GULI final profile] exchange enrichment boundary active');
}

installFinal();
