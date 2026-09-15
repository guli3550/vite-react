// Final Telegram profile identity boundary.
// Identity is still established only by the existing auth_sessions flow:
// /start auth_<UUID> binds message.from.id, and contact.user_id must equal
// message.from.id before the phone is accepted. This patch only enriches the
// already-verified canonical GULI user with Telegram profile data.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registry } = require('./routeRegistry.js');

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const SIGN_KEY = String(process.env.AUTH_JWT_SECRET || SUPABASE_KEY || 'guli-auth').trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signAvatar(telegramId, fileId, expires) {
  return crypto.createHmac('sha256', SIGN_KEY)
    .update(`${Number(telegramId)}.${String(fileId)}.${Number(expires)}`)
    .digest('base64url');
}

function avatarUrl(telegramId, fileId) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${API_BASE}/api/v1/profile/telegram-avatar/${encodeURIComponent(telegramId)}/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(signAvatar(telegramId, fileId, expires))}`;
}

async function telegramApi(method, body) {
  if (!BOT_TOKEN) return null;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  return result?.ok ? result.result : null;
}

function displayName(firstName, lastName) {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  return [first, last].filter(Boolean).join(' ').trim() || null;
}

async function loadTelegramProfile(telegramId) {
  const out = { first_name: null, last_name: null, username: null, photo_url: null };
  if (!BOT_TOKEN || !Number.isSafeInteger(telegramId) || telegramId <= 0) return out;

  try {
    const chat = await telegramApi('getChat', { chat_id: telegramId });
    if (chat) {
      out.first_name = String(chat.first_name || '').trim() || null;
      out.last_name = String(chat.last_name || '').trim() || null;
      out.username = String(chat.username || '').trim().replace(/^@+/, '') || null;
      const fileId = chat.photo?.big_file_id || chat.photo?.small_file_id || '';
      if (fileId) out.photo_url = avatarUrl(telegramId, fileId);
    }
  } catch (error) {
    console.warn('[GULI Telegram profile] getChat failed:', error.message);
  }

  try {
    const photos = await telegramApi('getUserProfilePhotos', { user_id: telegramId, offset: 0, limit: 1 });
    const sizes = Array.isArray(photos?.photos?.[0]) ? photos.photos[0] : [];
    const largest = sizes[sizes.length - 1];
    if (largest?.file_id) out.photo_url = avatarUrl(telegramId, largest.file_id);
  } catch (error) {
    console.warn('[GULI Telegram profile] getUserProfilePhotos failed:', error.message);
  }

  if (supabase && (!out.first_name || !out.last_name || !out.username)) {
    try {
      const { data: tg } = await supabase
        .from('telegram_users')
        .select('first_name,last_name,username')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      out.first_name ||= String(tg?.first_name || '').trim() || null;
      out.last_name ||= String(tg?.last_name || '').trim() || null;
      out.username ||= String(tg?.username || '').trim().replace(/^@+/, '') || null;
    } catch (error) {
      console.warn('[GULI Telegram profile] DB fallback failed:', error.message);
    }
  }

  return out;
}

async function enrichCanonicalUser(user) {
  if (!supabase || !user?.id) return user;
  const telegramId = Number(user.telegram_id || 0);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return user;

  const profile = await loadTelegramProfile(telegramId);
  const fullName = displayName(profile.first_name, profile.last_name);
  const username = profile.username || null;
  const photoUrl = profile.photo_url || null;
  const phone = String(user.phone_number || '').trim() || null;

  const update = {
    telegram_id: telegramId,
    telegram_username: username,
    telegram_photo_url: photoUrl,
    updated_at: new Date().toISOString(),
  };
  if (fullName) update.full_name = fullName;
  await supabase.from('users').update(update).eq('id', String(user.id)).eq('telegram_id', telegramId);

  await supabase.from('profiles').upsert({
    id: String(user.id),
    ...(fullName ? { full_name: fullName } : {}),
    phone,
    ...(photoUrl ? { avatar_url: photoUrl } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  await supabase.from('user_identities').upsert({
    user_id: String(user.id),
    provider: 'telegram',
    provider_subject: String(telegramId),
    provider_username: username,
    provider_phone: phone,
    metadata: {
      username,
      first_name: profile.first_name,
      last_name: profile.last_name,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider,provider_subject' });

  return {
    ...user,
    full_name: fullName || user.full_name || null,
    telegram_username: username,
    telegram_photo_url: photoUrl,
    username,
    avatar_url: photoUrl,
  };
}

function wrapJsonHandler(route, enrich) {
  if (!route || !route.handlers?.length || route.__guliTelegramProfileBoundaryWrapped) return;
  const original = route.handlers[route.handlers.length - 1];
  route.handlers[route.handlers.length - 1] = async function telegramProfileBoundary(req, res, next) {
    const originalJson = res.json.bind(res);
    let payload = null;
    let committed = false;
    res.json = (body) => {
      payload = body;
      return res;
    };
    try {
      const result = await original(req, res, next);
      if (payload?.success && payload?.data?.user) {
        payload.data.user = await enrich(payload.data.user);
      }
      if (!committed) {
        committed = true;
        return originalJson(payload ?? { success: false, message: 'Auth javobi bo‘sh.' });
      }
      return result;
    } catch (error) {
      if (!committed) {
        committed = true;
        return originalJson({ success: false, message: 'Auth profile enrichment failed.' });
      }
      throw error;
    }
  };
  route.__guliTelegramProfileBoundaryWrapped = true;
}

function installFinalBoundary() {
  const verifyRoute = registry.routes.find(r => r.method === 'post' && r.path === '/api/v1/auth/verify-otp');
  wrapJsonHandler(verifyRoute, enrichCanonicalUser);

  const meRoute = registry.routes.find(r => r.method === 'get' && r.path === '/api/v1/auth/me');
  if (meRoute?.handlers?.length) {
    const originalMe = meRoute.handlers[meRoute.handlers.length - 1];
    if (!meRoute.__guliTelegramMeBoundaryWrapped) {
      meRoute.handlers[meRoute.handlers.length - 1] = async function telegramProfileMe(req, res, next) {
        const originalJson = res.json.bind(res);
        let payload = null;
        let committed = false;
        res.json = (body) => { payload = body; return res; };
        try {
          const result = await originalMe(req, res, next);
          if (payload?.success && payload?.data?.user) {
            payload.data.user = await enrichCanonicalUser(payload.data.user);
          }
          if (!committed) {
            committed = true;
            return originalJson(payload ?? { success: false, message: 'Profil javobi bo‘sh.' });
          }
          return result;
        } catch (error) {
          if (!committed) {
            committed = true;
            return originalJson({ success: false, message: 'Profil enrichment failed.' });
          }
          throw error;
        }
      };
      meRoute.__guliTelegramMeBoundaryWrapped = true;
    }
  }
}

installFinalBoundary();
console.log('[GULI Telegram profile] final canonical identity boundary active');
