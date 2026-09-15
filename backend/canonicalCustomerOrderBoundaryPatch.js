// Canonical customer order security boundary.
// Loaded after customerAuthRuntime.js so the legacy POST /api/customer/orders
// handler cannot fall back to a direct orders INSERT when the secure RPC fails.
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
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const data = [];
    p.forEach((v, k) => { if (k !== 'hash') data.push(`${k}=${v}`); });
    data.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const expected = crypto.createHmac('sha256', secret).update(data.join('\n')).digest('hex');
    if (!safeEqual(hash, expected)) return null;
    const user = JSON.parse(p.get('user') || 'null');
    return user?.id ? { telegramId: Number(user.id), user } : null;
  } catch {
    return null;
  }
}

async function verifiedIdentity(req) {
  if (!supabase) return null;
  const tg = verifiedTelegram(req.headers['x-telegram-init-data'] || '');
  if (tg) return { telegramId: tg.telegramId, authUserId: null, user: tg.user };

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !data?.user?.id) return null;
    const { data: customer } = await supabase
      .from('customers')
      .select('telegram_id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();
    const telegramId = Number(customer?.telegram_id || 0);
    return {
      telegramId: Number.isSafeInteger(telegramId) && telegramId > 0 ? telegramId : null,
      authUserId: data.user.id,
      user: data.user
    };
  } catch {
    return null;
  }
}

async function canonicalCreateOrder(req, res) {
  const identity = await verifiedIdentity(req);
  if (!identity) return fail(res, 401, 'Telegram yoki tasdiqlangan mijoz sessiyasi talab qilinadi.');
  if (!identity.telegramId) {
    return fail(res, 403, 'Buyurtma uchun tasdiqlangan Telegram telefon identifikatori talab qilinadi.');
  }

  const input = { ...(req.body || {}) };
  delete input.created_at;
  // Never allow the client to choose the canonical phone identity.
  delete input.phone;
  delete input.telegram_phone;
  input.telegram_id = identity.telegramId;
  input.auth_user_id = identity.authUserId || null;

  if (!Array.isArray(input.items) || input.items.length < 1) {
    return fail(res, 400, 'Buyurtma mahsulotlari topilmadi.');
  }

  try {
    const { data, error } = await supabase.rpc('create_secure_order', {
      p_order: input,
      p_telegram_id: identity.telegramId
    });
    if (error) {
      console.error('[Canonical order RPC rejected]', error);
      return fail(res, 400, error.message || 'Buyurtmani xavfsiz saqlash rad etildi.');
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) return fail(res, 503, 'Buyurtma yaratish xizmati javob bermadi.');

    // No fallback INSERT and no client-controlled ownership mutation.
    return res.status(201).json({
      success: true,
      message: 'Buyurtma muvaffaqiyatli saqlandi',
      data: order
    });
  } catch (error) {
    console.error('[Canonical order error]', error);
    return fail(res, 503, 'Buyurtma xizmati vaqtincha mavjud emas.');
  }
}

// Remove earlier registrations for this endpoint. The canonical handler below
// becomes the only registry entry that can be mounted for this route.
registry.routes = registry.routes.filter((r) => !(r.method === 'post' && r.path === '/api/customer/orders'));
install('post', '/api/customer/orders', canonicalCreateOrder);

console.log('[CanonicalOrderBoundary] secure RPC-only customer order route installed');
