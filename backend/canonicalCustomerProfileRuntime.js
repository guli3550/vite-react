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
  const telegram = verifiedTelegram(req.headers['x-telegram-init-data'] || '');

  if (claims?.sub) {
    const { data, error } = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('id', String(claims.sub)).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (telegram && Number(data.telegram_id) !== Number(telegram.id)) return null;
    return { row: data, source: 'jwt', telegram };
  }

  if (telegram) {
    const { data, error } = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('telegram_id', Number(telegram.id)).maybeSingle();
    if (error) throw error;
    if (data) return { row: data, source: 'telegram', telegram };
    const { data: customer, error: customerError } = await db.from('customers')
      .select('id,telegram_id,full_name,avatar_url,phone,created_at,updated_at')
      .eq('telegram_id', Number(telegram.id)).maybeSingle();
    if (customerError) throw customerError;
    if (customer) return { row: { ...customer, username: telegram.username || null }, source: 'telegram-customer', telegram };
  }
  return null;
}

async function syncTelegramCustomerProfile(telegram) {
  const telegramId = Number(telegram?.id);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new Error('Telegram ID noto‘g‘ri');

  const [{ data: tgRow, error: tgReadError }, { data: existing, error: customerReadError }, { data: canonicalUser, error: userReadError }] = await Promise.all([
    db.from('telegram_users').select('profile_photos').eq('telegram_id', telegramId).maybeSingle(),
    db.from('customers').select('id,auth_user_id,telegram_id,full_name,phone,avatar_url,auth_provider,created_at,updated_at').eq('telegram_id', telegramId).maybeSingle(),
    db.from('users').select('telegram_photo_url').eq('telegram_id', telegramId).maybeSingle(),
  ]);
  if (tgReadError) throw tgReadError;
  if (customerReadError) throw customerReadError;
  if (userReadError) throw userReadError;
  const fileId = Array.isArray(tgRow?.profile_photos) ? String(tgRow.profile_photos[0] || '') : '';
  const previousAvatar = String(canonicalUser?.telegram_photo_url || existing?.avatar_url || '').trim();

  // Telegram photo_url is refreshed with initData. Re-uploading is idempotent:
  // content-hash object keys reuse the same R2 object when the photo is unchanged.
  let avatarUrl = null;
  try {
    avatarUrl = await uploadTelegramAvatarToR2({
      telegramId,
      photoUrl: telegram.photo_url || (isR2MediaUrl(previousAvatar) ? '' : previousAvatar),
      fileId,
    });
  } catch (error) {
    console.warn('[GULI] Telegram customer avatar R2 upload skipped:', error.message);
  }
  if (!avatarUrl && isR2MediaUrl(previousAvatar)) avatarUrl = previousAvatar;

  const now = new Date().toISOString();
  const fullName = [telegram.first_name, telegram.last_name].filter(Boolean).join(' ').trim() || null;
  const { error: tgUpsertError } = await db.from('telegram_users').upsert({
    telegram_id: telegramId,
    ...(telegram.username ? { username: telegram.username } : {}),
    ...(telegram.first_name ? { first_name: telegram.first_name } : {}),
    ...(telegram.last_name ? { last_name: telegram.last_name } : {}),
    updated_at: now,
  }, { onConflict: 'telegram_id' });
  if (tgUpsertError) throw tgUpsertError;

  const payload = {
    telegram_id: telegramId,
    full_name: fullName || existing?.full_name || null,
    auth_provider: 'telegram',
    updated_at: now,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };
  let customer;
  if (existing) {
    const updated = await db.from('customers').update(payload).eq('id', existing.id)
      .select('id,auth_user_id,telegram_id,full_name,phone,avatar_url,auth_provider,created_at,updated_at').single();
    if (updated.error) throw updated.error;
    customer = updated.data;
  } else {
    const inserted = await db.from('customers').insert(payload)
      .select('id,auth_user_id,telegram_id,full_name,phone,avatar_url,auth_provider,created_at,updated_at').single();
    if (inserted.error) throw inserted.error;
    customer = inserted.data;
  }
  return { customer, avatarUrl: avatarUrl || customer.avatar_url || null };
}

function publicProfile(row) {
  const fullName = String(row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ')).trim();
  const nameParts = fullName.split(/[ ]+/).filter(Boolean);
  const avatarUrl = row.telegram_photo_url || row.avatar_url || null;
  return {
    id: row.id,
    telegram_id: row.telegram_id != null ? Number(row.telegram_id) : null,
    username: row.telegram_username || row.username || null,
    telegram_username: row.telegram_username || row.username || null,
    first_name: nameParts[0] || null,
    last_name: nameParts.slice(1).join(' ') || null,
    full_name: fullName || null,
    avatar_url: avatarUrl,
    photo_url: avatarUrl,
    telegram_photo_url: avatarUrl,
    phone: row.phone_number || row.phone || null,
    phone_number: row.phone_number || row.phone || null,
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
    if (row && Number(row.telegram_id) !== Number(telegram.id)) {
      return fail(res, 409, 'Telegram identifikatori va canonical sessiya mos emas.', 'IDENTITY_MISMATCH');
    }
    // A Telegram Mini App visit is itself a verified customer registration.
    // Keep pre-phone customers in public.customers; phone-verified browser
    // authentication later links the same Telegram ID to public.users.
    const synced = await syncTelegramCustomerProfile(telegram);
    const result = await db.from('users')
      .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at')
      .eq('telegram_id', Number(telegram.id)).maybeSingle();
    if (result.error) return fail(res, 500, 'Telegram profilini tekshirishda xatolik.', 'PROFILE_LOOKUP_FAILED');
    if (result.data) {
      if (row && String(row.id) !== String(result.data.id)) {
        return fail(res, 409, 'Telegram identifikatori va canonical sessiya mos emas.', 'IDENTITY_MISMATCH');
      }
      const fullName = [telegram.first_name, telegram.last_name].filter(Boolean).join(' ').trim();
      const update = {
        ...(telegram.username ? { telegram_username: telegram.username } : {}),
        ...(fullName ? { full_name: fullName } : {}),
        ...(synced.avatarUrl ? { telegram_photo_url: synced.avatarUrl } : {}),
        updated_at: new Date().toISOString(),
      };
      const updated = await db.from('users').update(update).eq('id', result.data.id)
        .select('id,telegram_id,full_name,telegram_username,telegram_photo_url,phone_number,created_at,updated_at').single();
      if (updated.error || !updated.data) return fail(res, 500, 'Telegram profilini yangilashda xatolik.', 'PROFILE_SYNC_FAILED');
      row = updated.data;
    } else {
      row = {
        ...synced.customer,
        username: telegram.username || null,
        telegram_username: telegram.username || null,
        telegram_photo_url: synced.avatarUrl,
      };
    }
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
    if (auth.source === 'telegram-customer') {
      const synced = await syncTelegramCustomerProfile(telegram);
      return res.json({
        success: true,
        data: publicProfile({
          ...synced.customer,
          username: telegram.username || null,
          telegram_photo_url: synced.avatarUrl,
        }),
      });
    }
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
