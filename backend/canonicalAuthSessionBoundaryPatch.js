// Final auth-session boundary.
// Makes browser login a single-use, atomically claimed exchange flow.
// Direct OTP verification is intentionally disabled; browser uses exchange_ticket.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registry, install } = require('./routeRegistry.js');
const { issueAccessToken, issueRefreshToken } = require('./guliCustomAuth.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const hash = (value) => crypto.createHmac('sha256', KEY || 'guli-auth').update(String(value)).digest('hex');
const normalizePhone = (value) => { let v = String(value || '').trim().replace(/[^\d+]/g, ''); if (v.startsWith('00')) v = '+' + v.slice(2); if (!v.startsWith('+')) v = '+' + v; return v; };
const validPhone = (v) => /^\+[1-9]\d{7,14}$/.test(v);
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const ok = (res, data) => res.json({ success: true, data });

async function exchange(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const id = String(req.body?.session_id || '');
  const ticket = String(req.body?.exchange_ticket || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || ticket.length < 32 || ticket.length > 128) return fail(res, 400, 'Auth exchange ma’lumotlari yetarli emas.');

  const ticketHash = hash(ticket);
  const { data: claimed, error: claimError } = await supabase.rpc('claim_auth_session', {
    p_session_id: id,
    p_ticket_hash: ticketHash,
    p_otp_hash: null,
    p_mode: 'exchange',
  });
  if (claimError || !Array.isArray(claimed) || !claimed[0]) {
    const msg = String(claimError?.message || '');
    if (/expired/i.test(msg)) return fail(res, 410, 'Auth session muddati tugagan.');
    if (/already used/i.test(msg)) return fail(res, 401, 'Auth exchange allaqachon ishlatilgan.');
    if (/ticket invalid/i.test(msg)) return fail(res, 401, 'Exchange ticket yaroqsiz.');
    if (/identity not ready/i.test(msg)) return fail(res, 425, 'Telegram tasdig‘i hali tayyor emas.');
    if (/not found/i.test(msg)) return fail(res, 404, 'Auth session topilmadi.');
    console.error('[Canonical auth exchange claim]', claimError);
    return fail(res, 503, 'Auth sessionni tasdiqlab bo‘lmadi.');
  }

  const session = claimed[0];
  const phone = normalizePhone(session.phone_number);
  const telegramId = Number(session.telegram_id);
  if (!validPhone(phone) || !Number.isSafeInteger(telegramId) || telegramId <= 0) return fail(res, 400, 'Tasdiqlangan identity ma’lumotlari noto‘g‘ri.');

  try {
    let userId = null;
    const { data: canonical } = await supabase.from('users').select('id,phone_number,telegram_id,full_name').eq('phone_number', phone).maybeSingle();
    if (canonical) {
      if (canonical.telegram_id && Number(canonical.telegram_id) !== telegramId) return fail(res, 409, 'Bu telefon boshqa Telegram account bilan bog‘langan.');
      userId = canonical.id;
    } else {
      const { data: byTg } = await supabase.from('users').select('id,phone_number,telegram_id,full_name').eq('telegram_id', telegramId).maybeSingle();
      if (byTg && byTg.phone_number !== phone) return fail(res, 409, 'Telegram account boshqa telefon bilan bog‘langan.');
      if (byTg) userId = byTg.id;
    }

    if (!userId) {
      const { data: created, error } = await supabase.auth.admin.createUser({ phone, phone_confirm: true, user_metadata: { auth_source: 'telegram', telegram_id: telegramId } });
      if (error || !created?.user) throw new Error(`GULI Auth account yaratilmadi: ${error?.message || 'unknown'}`);
      userId = created.user.id;
    } else {
      const { error } = await supabase.auth.admin.updateUserById(userId, { phone, phone_confirm: true, user_metadata: { auth_source: 'telegram', telegram_id: telegramId } });
      if (error) throw new Error(`GULI Auth account yangilanmadi: ${error.message || 'unknown'}`);
    }

    await supabase.from('users').upsert({ id: userId, phone_number: phone, telegram_id: telegramId, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    await supabase.from('profiles').upsert({ id: userId, phone, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    await supabase.from('user_identities').upsert({ user_id: userId, provider: 'telegram', provider_subject: String(telegramId), provider_phone: phone, updated_at: new Date().toISOString() }, { onConflict: 'provider,provider_subject' });
    await supabase.from('user_identities').upsert({ user_id: userId, provider: 'phone', provider_subject: phone, provider_phone: phone, updated_at: new Date().toISOString() }, { onConflict: 'provider,provider_subject' });

    const accessToken = issueAccessToken({ id: userId, phone_number: phone, telegram_id: telegramId });
    const refreshToken = await issueRefreshToken(supabase, userId);
    return ok(res, { user: { id: userId, phone_number: phone, telegram_id: telegramId }, access_token: accessToken, refresh_token: refreshToken, expires_in: 900 });
  } catch (error) {
    console.error('[Canonical auth exchange]', error);
    return fail(res, 500, 'Foydalanuvchi sessiyasini yaratishda xatolik.');
  }
}

// Remove all previous implementations of these mutation routes.
registry.routes = registry.routes.filter((r) => !(
  (r.method === 'post' && r.path === '/api/v1/auth/exchange') ||
  (r.method === 'post' && r.path === '/api/v1/auth/verify-otp')
));
install('post', '/api/v1/auth/exchange', exchange);
install('post', '/api/v1/auth/verify-otp', (_req, res) => fail(res, 410, 'Direct OTP endpoint yopilgan. Telegram tasdig‘idan keyin exchange_ticket ishlatiladi.'));
console.log('[CanonicalAuthSessionBoundary] atomic single-use auth exchange active');
