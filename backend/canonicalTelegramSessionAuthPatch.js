// GULI H1+H2: canonical Telegram browser session -> GULI JWT exchange.
//
// Flow (matches src/components/CustomerAuthModal.tsx exactly):
//   1. Browser: POST /api/v1/auth/init-session {}
//        -> creates a short-lived, single-use auth_sessions row
//        -> returns { session_id, exchange_ticket, telegram_url }
//   2. Browser opens telegram_url (t.me deep link, "auth_<session_id>").
//   3. Telegram: user taps Start, then shares their Telegram contact.
//      telegramRuntimePatch.js's webhook handler (already in the npm start
//      preload chain, loaded before this file) verifies contact.user_id ===
//      message.from.id and marks the matching auth_sessions row verified.
//   4. Browser polls GET /api/v1/auth/check-status/:session_id.
//   5. Once status is READY, browser: POST /api/v1/auth/exchange
//        { session_id, exchange_ticket }
//        -> resolves/creates canonical public.users
//        -> issues a GULI JWT via guliCustomAuth.issueAccessToken()
//        -> consumes the session (single-use)
//
// Identity is NEVER accepted from the client body. telegram_id and
// phone_number only ever enter auth_sessions through the Telegram-HMAC
// verified webhook flow in telegramRuntimePatch.js. A client posting
// {"telegram_id":"victim"} / {"phone":"victim"} / {"user_id":"victim"} to
// init-session or exchange has no effect: those fields are simply not read.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');
const { issueAccessToken, issueRefreshToken } = require('./guliCustomAuth.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SECRET = String(process.env.AUTH_JWT_SECRET || process.env.SUPABASE_SECRET_KEY || '').trim();

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const SESSION_TTL_MS = 5 * 60 * 1000; // matches CustomerAuthModal's 300000ms poll timeout
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertSecret() {
  if (SECRET.length < 32) throw new Error('AUTH_JWT_SECRET (or SUPABASE_SECRET_KEY) must be configured with at least 32 characters');
}
function hashTicket(ticket) {
  assertSecret();
  return crypto.createHmac('sha256', SECRET).update(String(ticket || '')).digest('hex');
}
function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

let cachedBotUsername = null;
async function getBotUsername() {
  if (cachedBotUsername) return cachedBotUsername;
  if (process.env.TELEGRAM_BOT_USERNAME) {
    cachedBotUsername = String(process.env.TELEGRAM_BOT_USERNAME).replace(/^@/, '').trim();
    return cachedBotUsername;
  }
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan');
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const j = await r.json();
  if (!j.ok || !j.result?.username) throw new Error(j.description || 'Telegram getMe xatosi');
  cachedBotUsername = j.result.username;
  return cachedBotUsername;
}

function fail(res, status, message, code) {
  return res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/init-session
// Body is intentionally ignored beyond being valid JSON: no client-supplied
// identity is ever read here.
// ---------------------------------------------------------------------------
async function initSession(req, res) {
  if (!supabase) return fail(res, 503, 'Autentifikatsiya xizmati sozlanmagan.');
  try {
    const exchangeTicket = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const { data: session, error } = await supabase
      .from('auth_sessions')
      .insert({
        exchange_ticket_hash: hashTicket(exchangeTicket),
        expires_at: expiresAt,
        is_verified: false,
        otp_used: false,
        exchange_ticket_used: false,
      })
      .select('session_id')
      .single();
    if (error) throw error;

    const botUsername = await getBotUsername();
    const telegramUrl = `https://t.me/${botUsername}?start=auth_${session.session_id}`;

    return res.json({
      success: true,
      data: {
        session_id: session.session_id,
        exchange_ticket: exchangeTicket,
        telegram_url: telegramUrl,
        expires_in: Math.floor(SESSION_TTL_MS / 1000),
      },
    });
  } catch (error) {
    console.error('[auth/init-session]', error.message);
    return fail(res, 500, 'Login sessiyasini yaratishda xatolik.');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/check-status/:session_id
// Returns only a coarse status enum. Never leaks telegram_id/phone/ticket.
// ---------------------------------------------------------------------------
async function checkStatus(req, res) {
  if (!supabase) return fail(res, 503, 'Autentifikatsiya xizmati sozlanmagan.');
  try {
    const sessionId = String(req.params.session_id || '').trim();
    if (!UUID_RE.test(sessionId)) return fail(res, 400, 'Sessiya identifikatori noto‘g‘ri.');

    const { data: session, error } = await supabase
      .from('auth_sessions')
      .select('is_verified, exchange_ticket_used, expires_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!session) return fail(res, 404, 'Sessiya topilmadi.');

    let status = 'PENDING';
    if (session.exchange_ticket_used) status = 'VERIFIED';
    else if (new Date(session.expires_at).getTime() < Date.now()) status = 'EXPIRED';
    else if (session.is_verified) status = 'READY';

    return res.json({ success: true, data: { status } });
  } catch (error) {
    console.error('[auth/check-status]', error.message);
    return fail(res, 500, 'Sessiya holatini tekshirishda xatolik.');
  }
}

// Resolve (or safely create) the canonical public.users row for a verified
// Telegram identity. Never merges across a mismatched existing identity.
async function resolveCanonicalUser({ telegramId, phoneNumber }) {
  const { data: byTelegram, error: byTelegramErr } = await supabase
    .from('users')
    .select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (byTelegramErr) throw byTelegramErr;

  const { data: tgProfile } = await supabase
    .from('telegram_users')
    .select('username, first_name, last_name')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  const fullName = [tgProfile?.first_name, tgProfile?.last_name].filter(Boolean).join(' ').trim() || null;
  const telegramUsername = tgProfile?.username || null;

  if (byTelegram) {
    const patch = {};
    if (phoneNumber && byTelegram.phone_number !== phoneNumber) patch.phone_number = phoneNumber;
    if (fullName && byTelegram.full_name !== fullName) patch.full_name = fullName;
    if (telegramUsername && byTelegram.telegram_username !== telegramUsername) patch.telegram_username = telegramUsername;
    if (Object.keys(patch).length === 0) return byTelegram;
    patch.updated_at = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update(patch)
      .eq('id', byTelegram.id)
      .select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at')
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  const { data: byPhone, error: byPhoneErr } = await supabase
    .from('users')
    .select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at')
    .eq('phone_number', phoneNumber)
    .maybeSingle();
  if (byPhoneErr) throw byPhoneErr;
  if (byPhone && byPhone.telegram_id != null && Number(byPhone.telegram_id) !== Number(telegramId)) {
    // Same phone number already canonically owned by a different verified
    // Telegram identity. Do not auto-merge accounts.
    const conflict = new Error('PHONE_OWNED_BY_ANOTHER_TELEGRAM_ACCOUNT');
    conflict.code = 'GULI_ACCOUNT_CONFLICT';
    throw conflict;
  }
  if (byPhone) {
    const { data: linked, error: linkErr } = await supabase
      .from('users')
      .update({ telegram_id: telegramId, full_name: fullName || byPhone.full_name, telegram_username: telegramUsername || byPhone.telegram_username, updated_at: new Date().toISOString() })
      .eq('id', byPhone.id)
      .eq('telegram_id', null)
      .select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at')
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (linked) return linked;
    // Lost a race with a concurrent request; re-read canonical row.
    const { data: reread, error: rereadErr } = await supabase.from('users').select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at').eq('phone_number', phoneNumber).maybeSingle();
    if (rereadErr) throw rereadErr;
    if (reread) return reread;
  }

  // No existing canonical user. public.users.id has a FK to auth.users(id),
  // so create the backing auth.users row first (no password, no email -
  // this does not open an email/password login path; canonicalAuthOnlyGuard
  // blocks those routes outright).
  const { data: created, error: createAuthErr } = await supabase.auth.admin.createUser({
    phone: phoneNumber,
    phone_confirm: true,
    user_metadata: { source: 'telegram', telegram_id: telegramId },
  });
  if (createAuthErr) throw createAuthErr;
  const newId = created?.user?.id;
  if (!newId) throw new Error('auth.users yaratilmadi');

  const { data: insertedUser, error: insertErr } = await supabase
    .from('users')
    .insert({
      id: newId,
      phone_number: phoneNumber,
      telegram_id: telegramId,
      full_name: fullName,
      telegram_username: telegramUsername,
    })
    .select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at')
    .single();
  if (insertErr) {
    if (insertErr.code === '23505') {
      // Concurrent request already inserted this identity; read it back.
      const { data: raced } = await supabase.from('users').select('id, phone_number, telegram_id, full_name, telegram_username, telegram_photo_url, created_at').eq('telegram_id', telegramId).maybeSingle();
      if (raced) return raced;
    }
    throw insertErr;
  }
  return insertedUser;
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/exchange
// Body: { session_id, exchange_ticket }. Only these opaque, server-issued
// values are read - no telegram_id/phone/user_id from the client is trusted.
// ---------------------------------------------------------------------------
async function exchange(req, res) {
  if (!supabase) return fail(res, 503, 'Autentifikatsiya xizmati sozlanmagan.');
  try {
    const sessionId = String(req.body?.session_id || '').trim();
    const exchangeTicket = String(req.body?.exchange_ticket || '');
    if (!UUID_RE.test(sessionId) || !exchangeTicket) return fail(res, 400, 'Sessiya ma’lumotlari to‘liq emas.');

    const { data: session, error } = await supabase
      .from('auth_sessions')
      .select('session_id, telegram_id, phone_number, is_verified, exchange_ticket_hash, exchange_ticket_used, expires_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!session) return fail(res, 404, 'Sessiya topilmadi.');
    if (new Date(session.expires_at).getTime() < Date.now()) return fail(res, 410, 'Sessiya muddati tugagan.');
    if (session.exchange_ticket_used) return fail(res, 409, 'Sessiya allaqachon ishlatilgan.');
    if (!session.is_verified || !session.telegram_id || !session.phone_number) return fail(res, 409, 'Sessiya hali Telegram orqali tasdiqlanmagan.');
    if (!session.exchange_ticket_hash || !safeEqualHex(hashTicket(exchangeTicket), session.exchange_ticket_hash)) {
      return fail(res, 401, 'Exchange ticket yaroqsiz.');
    }

    // Atomically consume the session: only the request that flips
    // exchange_ticket_used may proceed to issue tokens (single-use, replay
    // protected).
    const { data: consumed, error: consumeErr } = await supabase
      .from('auth_sessions')
      .update({ exchange_ticket_used: true })
      .eq('session_id', sessionId)
      .eq('exchange_ticket_used', false)
      .select('session_id')
      .maybeSingle();
    if (consumeErr) throw consumeErr;
    if (!consumed) return fail(res, 409, 'Sessiya allaqachon ishlatilgan.');

    const user = await resolveCanonicalUser({ telegramId: Number(session.telegram_id), phoneNumber: session.phone_number });
    const accessToken = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(supabase, user.id);

    return res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          phone_number: user.phone_number,
          full_name: user.full_name,
          telegram_id: user.telegram_id,
          telegram_username: user.telegram_username,
          telegram_photo_url: user.telegram_photo_url,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    if (error?.code === 'GULI_ACCOUNT_CONFLICT') {
      console.error('[auth/exchange] account conflict:', error.message);
      return fail(res, 409, 'Bu telefon raqami boshqa Telegram hisobiga bog‘langan. Qo‘llab-quvvatlash xizmatiga murojaat qiling.');
    }
    console.error('[auth/exchange]', error.message);
    return fail(res, 500, 'Tizimga kirishda xatolik.');
  }
}

install('post', '/api/v1/auth/init-session', initSession);
install('get', '/api/v1/auth/check-status/:session_id', checkStatus);
install('post', '/api/v1/auth/exchange', exchange);

module.exports = {};
