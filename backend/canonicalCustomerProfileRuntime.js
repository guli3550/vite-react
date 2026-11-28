// GULI canonical customer profile runtime.
// Telegram is the only customer identity provider. This module deliberately
// does not read or write email/password/Google identity data.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');
const { verifyAccessToken } = require('./guliCustomAuth.js');
const { uploadTelegramAvatarToR2 } = require('./customerAvatarR2.js');
const { isR2MediaUrl } = require('./r2StorageRuntime.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifiedTelegram(raw) {
  if (!BOT || !raw) return null;
  try {
    const p = new URLSearchParams(String(raw));
    const hash = p.get('hash');
    const authDate = Number(p.get('auth_date'));
    if (!hash || !Number.isFinite(authDate)) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const pairs = [];
    p.forEach((value, key) => { if (key !== 'hash') pairs.push(`${key}=${value}`); });
    pairs.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const expected = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    if (!safeEqual(hash, expected)) return null;
    const user = JSON.parse(p.get('user') || 'null');
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}

function jwtClaims(req) {
  const value = String(req.headers.authorization || '');
  if (!value.startsWith('Bearer ')) return null;
  try { return verifyAccessToken(value.slice(7).trim()); } catch { return null; }
}

async function canonicalUser(req) {
  if (!db) return null;
  const claims = jwtClaims(req);
  if (claims?.sub) {
    const { data, error } = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('id', String(claims.sub)).maybeSingle();
    if (!error && data) return { row: data, source: 'jwt', telegram: null };
  }

  const telegram = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
  if (telegram) {
    const { data, error } = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('telegram_id', Number(telegram.id)).maybeSingle();
    if (!error && data) return { row: data, source: 'telegram', telegram };
  }
  return null;
}

function publicProfile(row) {
  const fullName = String(row.full_name || '').trim();
  const nameParts = fullName.split(/\\s+/).filter(Boolean);
  const avatarUrl = row.telegram_photo_url || null;
  return {
    id: row.id,
    telegram_id: row.telegram_id != null ? Number(row.telegram_id) : null,
    username: row.telegram_username || null,
    telegram_username: row.telegram_username || null,
    first_name: nameParts[0] || null,
    last_name: nameParts.slice(1).join(' ') || null,
    full_name: fullName || null,
    avatar_url: avatarUrl,
    photo_url: avatarUrl,
    telegram_photo_url: avatarUrl,
    phone: row.phone_number || null,
    phone_number: row.phone_number || null,
    provider: 'telegram',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function fail(res, status, message, code) {
  return res.status(status).json({ success: false, code, message });
}

async function profile(req, res) {
  if (!db) return fail(res, 503, 'Server bazasi sozlanmagan.', 'DATABASE_NOT_CONFIGURED');
  const auth = await canonicalUser(req);
  if (!auth) return fail(res, 401, 'Telegram autentifikatsiyasi talab qilinadi.', 'TELEGRAM_AUTH_REQUIRED');
  return res.json({ success: true, data: publicProfile(auth.row) });
}

async function sync(req, res) {
  if (!db) return fail(res, 503, 'Server bazasi sozlanmagan.', 'DATABASE_NOT_CONFIGURED');

  const telegram = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
  const claims = jwtClaims(req);
  if (!telegram && !claims?.sub) {
    return fail(res, 401, 'Telegram autentifikatsiyasi talab qilinadi.', 'TELEGRAM_AUTH_REQUIRED');
  }

  let row = null;
  if (claims?.sub) {
    const result = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('id', String(claims.sub)).maybeSingle();
    if (result.error || !result.data) return fail(res, 401, 'Canonical foydalanuvchi topilmadi.', 'CANONICAL_USER_NOT_FOUND');
    row = result.data;
  }

  if (telegram) {
    const result = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('telegram_id', Number(telegram.id)).maybeSingle();
    if (result.error || !result.data) {
      return fail(res, 409, 'Telegram foydalanuvchisi canonical sessiya orqali ro‘yxatdan o‘tishi kerak.', 'CANONICAL_TELEGRAM_SESSION_REQUIRED');
    }
    if (row && String(row.id) !== String(result.data.id)) {
      return fail(res, 409, 'Telegram identifikatori va canonical sessiya mos emas.', 'IDENTITY_MISMATCH');
    }
    row = result.data;

    // These fields come only from Telegram's server-verified initData.
    // Never clear a previously stored name/avatar when Telegram omits a field.
    const fullName = [telegram.first_name, telegram.last_name].filter(Boolean).join(' ').trim();
    const update = {
      telegram_id: Number(telegram.id),
      ...(telegram.username ? { telegram_username: telegram.username } : {}),
      ...(fullName ? { full_name: fullName } : {}),
      updated_at: new Date().toISOString(),
    };
    const incomingPhoto = String(telegram.photo_url || '').trim();
    if (incomingPhoto) {
      try {
        const publicUrl = await uploadTelegramAvatarToR2({ telegramId: Number(telegram.id), photoUrl: incomingPhoto });
        if (publicUrl) update.telegram_photo_url = publicUrl;
      } catch (error) {
        console.warn('[GULI] Customer avatar R2 sync skipped:', error.message);
      }
    }
    const updated = await db.from('users').update(update).eq('id', row.id)
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at').single();
    if (updated.error || !updated.data) return fail(res, 500, 'Telegram profilini yangilashda xatolik.', 'PROFILE_SYNC_FAILED');
    row = updated.data;
  }

  return res.json({ success: true, data: publicProfile(row) });
}

async function updateProfile(req, res) {
  if (!db) return fail(res, 503, 'Server bazasi sozlanmagan.', 'DATABASE_NOT_CONFIGURED');
  const auth = await canonicalUser(req);
  if (!auth) return fail(res, 401, 'Telegram autentifikatsiyasi talab qilinadi.', 'TELEGRAM_AUTH_REQUIRED');

  // Identity fields are never accepted from the browser. Telegram remains the
  // source of truth for name/username/avatar; phone is changed only by the
  // dedicated verified Contact Share flow.
  const telegram = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
  if (telegram && Number(auth.row.telegram_id) === Number(telegram.id)) {
    const update = {
      ...(telegram.username ? { telegram_username: telegram.username } : {}),
      ...([telegram.first_name, telegram.last_name].filter(Boolean).length
        ? { full_name: [telegram.first_name, telegram.last_name].filter(Boolean).join(' ').trim() }
        : {}),
      updated_at: new Date().toISOString(),
    };
    const incomingPhoto = String(telegram.photo_url || '').trim();
    if (incomingPhoto && !isR2MediaUrl(auth.row.telegram_photo_url)) {
      try {
        const publicUrl = await uploadTelegramAvatarToR2({ telegramId: Number(telegram.id), photoUrl: incomingPhoto });
        if (publicUrl) update.telegram_photo_url = publicUrl;
      } catch (error) {
        console.warn('[GULI] Customer avatar R2 update skipped:', error.message);
      }
    }
    const updated = await db.from('users').update(update).eq('id', auth.row.id)
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at').single();
    if (updated.error || !updated.data) return fail(res, 500, 'Telegram profilini yangilashda xatolik.', 'PROFILE_UPDATE_FAILED');
    return res.json({ success: true, data: publicProfile(updated.data) });
  }

  return res.json({ success: true, data: publicProfile(auth.row) });
}

install('get', '/api/customer/profile', profile);
install('put', '/api/customer/profile', updateProfile);
install('post', '/api/customer/sync', sync);

console.log('[GULI] canonical Telegram-only customer profile runtime loaded.');
