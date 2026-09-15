// Canonical phone identity boundary for customer profile/sync.
// Loaded after legacy customerAuthRuntime so client-supplied phone/email can never
// become the canonical customer identity.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registry, install } = require('./routeRegistry.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function verifiedTelegram(raw) {
  if (!BOT || !raw) return null;
  try {
    const p = new URLSearchParams(String(raw));
    const hash = p.get('hash');
    const authDate = Number(p.get('auth_date'));
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const data = [];
    p.forEach((v, k) => { if (k !== 'hash') data.push(`${k}=${v}`); });
    data.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const expected = crypto.createHmac('sha256', secret).update(data.join('\n')).digest('hex');
    const a = Buffer.from(hash); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const user = JSON.parse(p.get('user') || 'null');
    return user?.id ? { telegramId: Number(user.id), user } : null;
  } catch { return null; }
}

async function identity(req) {
  const tg = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
  if (tg) return { kind: 'telegram', telegramId: tg.telegramId, user: tg.user };
  const auth = String(req.headers.authorization || '');
  if (!supabase || !auth.startsWith('Bearer ')) return null;
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data?.user?.id) return null;
  return { kind: 'auth', authUserId: data.user.id, user: data.user };
}

async function canonicalPhone(id) {
  if (!supabase || !id) return null;
  if (id.kind === 'telegram') {
    const { data } = await supabase.from('telegram_users').select('telegram_phone').eq('telegram_id', id.telegramId).maybeSingle();
    return String(data?.telegram_phone || '').trim() || null;
  }
  const { data: customer } = await supabase.from('customers').select('phone,telegram_id').eq('auth_user_id', id.authUserId).maybeSingle();
  if (customer?.phone) return String(customer.phone).trim();
  if (customer?.telegram_id) {
    const { data } = await supabase.from('telegram_users').select('telegram_phone').eq('telegram_id', customer.telegram_id).maybeSingle();
    return String(data?.telegram_phone || '').trim() || null;
  }
  return String(id.user?.phone || '').trim() || null;
}

function rejectClientIdentity(req, res) {
  if (req.body && (Object.prototype.hasOwnProperty.call(req.body, 'phone') || Object.prototype.hasOwnProperty.call(req.body, 'email') || Object.prototype.hasOwnProperty.call(req.body, 'telegram_phone'))) {
    return fail(res, 400, 'Telefon/emailni mijoz o‘zi yubora olmaydi. Faqat tasdiqlangan Telegram Contact Share identifikatori qabul qilinadi.');
  }
  return null;
}

async function syncCustomer(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const bad = rejectClientIdentity(req, res); if (bad) return bad;
  const id = await identity(req);
  if (!id) return fail(res, 401, 'Mijoz autentifikatsiyasi talab qilinadi.');
  const phone = await canonicalPhone(id);
  if (!phone) return fail(res, 403, 'Tasdiqlangan Telegram telefon raqami mavjud emas. Bot orqali Contact Share yuboring.');

  const name = String(req.body?.full_name || id.user?.user_metadata?.full_name || [id.user?.first_name, id.user?.last_name].filter(Boolean).join(' ') || '').trim() || null;
  const avatar = String(req.body?.avatar_url || id.user?.user_metadata?.avatar_url || id.user?.photo_url || '').trim() || null;
  const lookup = id.kind === 'telegram' ? { telegram_id: id.telegramId } : { auth_user_id: id.authUserId };
  let q = supabase.from('customers').select('*');
  q = id.kind === 'telegram' ? q.eq('telegram_id', id.telegramId) : q.eq('auth_user_id', id.authUserId);
  const { data: existing } = await q.maybeSingle();
  const payload = { ...lookup, phone, full_name: name || existing?.full_name || null, avatar_url: avatar || existing?.avatar_url || null, auth_provider: 'telegram_phone', updated_at: new Date().toISOString() };
  const { data, error } = existing
    ? await supabase.from('customers').update(payload).eq('id', existing.id).select().single()
    : await supabase.from('customers').insert({ ...payload, created_at: new Date().toISOString() }).select().single();
  if (error) return fail(res, 500, 'Canonical mijoz profilini saqlashda xatolik.');
  return res.json({ success: true, data: { id: data.id, telegram_id: data.telegram_id, auth_user_id: data.auth_user_id, phone: data.phone, full_name: data.full_name, avatar_url: data.avatar_url, provider: 'telegram_phone', created_at: data.created_at } });
}

async function updateProfile(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const bad = rejectClientIdentity(req, res); if (bad) return bad;
  const id = await identity(req);
  if (!id) return fail(res, 401, 'Mijoz sessiyasi talab qilinadi.');
  const phone = await canonicalPhone(id);
  if (!phone) return fail(res, 403, 'Telefon raqami hali Telegram Contact Share orqali tasdiqlanmagan.');
  const fullName = String(req.body?.full_name || '').trim();
  const avatarUrl = String(req.body?.avatar_url || '').trim();
  let q = supabase.from('customers').select('id,telegram_id,auth_user_id,phone,full_name,avatar_url,created_at');
  q = id.kind === 'telegram' ? q.eq('telegram_id', id.telegramId) : q.eq('auth_user_id', id.authUserId);
  const { data: row } = await q.maybeSingle();
  if (!row) return fail(res, 404, 'Mijoz profili topilmadi. Avval telefonni tasdiqlang.');
  const patch = { phone, updated_at: new Date().toISOString() };
  if (fullName) patch.full_name = fullName;
  if (avatarUrl) patch.avatar_url = avatarUrl;
  const { data, error } = await supabase.from('customers').update(patch).eq('id', row.id).select().single();
  if (error) return fail(res, 500, 'Profilni saqlashda xatolik.');
  return res.json({ success: true, data: { id: data.id, telegram_id: data.telegram_id, auth_user_id: data.auth_user_id, phone: data.phone, full_name: data.full_name, avatar_url: data.avatar_url, provider: 'telegram_phone', created_at: data.created_at } });
}

registry.routes = registry.routes.filter((r) => !(
  (r.method === 'post' && r.path === '/api/customer/sync') ||
  (r.method === 'put' && r.path === '/api/customer/profile')
));
install('post', '/api/customer/sync', syncCustomer);
install('put', '/api/customer/profile', updateProfile);
console.log('[CanonicalPhoneIdentityBoundary] verified-phone-only customer identity installed');
