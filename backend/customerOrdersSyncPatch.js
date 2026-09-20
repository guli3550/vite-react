// Secure customer order history and receipt ownership.
// Canonical browser identity = GULI JWT -> public.users.id.
// Telegram Mini App identity = verified Telegram initData -> telegram_id.
// No Supabase Auth, guest token, or client-supplied phone/telegram identity is accepted.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');
const { verifyAccessToken } = require('./guliCustomAuth.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function telegramUser(raw) {
  if (!raw || !BOT_TOKEN) return null;
  try {
    const p = new URLSearchParams(String(raw));
    const hash = p.get('hash') || '';
    const authDate = Number(p.get('auth_date'));
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    p.delete('hash');
    const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(check).digest('hex');
    if (!safeEqual(hash, expected)) return null;
    const user = JSON.parse(p.get('user') || '{}');
    const id = Number(user.id);
    return Number.isSafeInteger(id) && id > 0 ? { type: 'telegram', id } : null;
  } catch { return null; }
}

function browserUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try {
    const claims = verifyAccessToken(header.slice(7).trim());
    return claims?.sub ? { type: 'auth', id: String(claims.sub), telegram_id: claims.telegram_id } : null;
  } catch {
    return null;
  }
}

function customer(req) {
  return telegramUser(req.headers['x-telegram-init-data'] || '') || browserUser(req);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(it => {
    if (!it) return it;
    const prod = it.product || it.product_data || it.productDetails || {};
    const img = it.image || it.image_url || it.photo || prod.image || prod.image_url || (Array.isArray(prod.images) ? prod.images[0] : '') || (Array.isArray(it.images) ? it.images[0] : '') || '';
    const name = it.name || it.title || prod.name || prod.title || 'Mahsulot';
    const code = it.product_code || prod.product_code || '';
    const price = Number(it.price != null ? it.price : prod.price || 0);
    return { ...it, image: img, name, product_code: code, price, product: { ...prod, name: prod.name || name, image: prod.image || img, price: prod.price != null ? prod.price : price, product_code: prod.product_code || code } };
  });
}

function mapOrder(row) {
  return {
    id: String(row.order_number || row.id || ''),
    order_number: row.order_number || undefined,
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    customer_name: row.customer_name || row.first_name || undefined,
    phone: row.phone || '',
    items: normalizeItems(row.items),
    subtotal: Number(row.subtotal || 0),
    delivery: Number(row.delivery || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    address: row.address || undefined,
    payment: row.payment || '',
    payment_status: row.payment_status || 'pending',
    payment_receipt_path: row.payment_receipt_path || undefined,
    receipt_url: row.receipt_url || undefined,
    status: row.status || '⏳ Buyurtma kutilmoqda',
    createdAt: row.created_at || row.createdAt || undefined,
    updatedAt: row.updated_at || undefined,
    statusUpdatedAt: row.status_updated_at || row.updated_at || undefined,
  };
}

async function listOrders(req, res) {
  const user = customer(req);
  if (!user || !['auth', 'telegram'].includes(user.type)) {
    return res.status(401).json({ success: false, message: 'Telegram autentifikatsiyasi talab qilinadi.' });
  }
  if (!supabase) return res.status(503).json({ success: false, message: 'Buyurtmalar xizmati sozlanmagan.' });
  try {
    let query = supabase.from('orders')
      .select('id,order_number,first_name,phone,items,subtotal,delivery,discount,total,address,payment,payment_status,payment_receipt_path,status,created_at,updated_at,status_updated_at')
      .order('created_at', { ascending: false }).limit(100);
    if (user.type === 'auth') {
      let linkedTelegramId = user.telegram_id;
      if (!linkedTelegramId) {
        try {
          const { data: uData } = await supabase.from('users').select('telegram_id').eq('id', user.id).maybeSingle();
          if (uData?.telegram_id) linkedTelegramId = uData.telegram_id;
        } catch {}
      }
      if (linkedTelegramId) {
        query = query.or(`auth_user_id.eq.${user.id},telegram_id.eq.${linkedTelegramId}`);
      } else {
        query = query.eq('auth_user_id', user.id);
      }
    } else {
      query = query.eq('telegram_id', user.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    const formatted = await Promise.all((data || []).map(async row => {
      let receiptUrl = '';
      if (row.payment_receipt_path) {
        try {
          const { data: sData } = await supabase.storage.from('payment-receipts').createSignedUrl(String(row.payment_receipt_path).replace(/^\/+/, ''), 86400);
          receiptUrl = sData?.signedUrl || '';
        } catch {}
      }
      return mapOrder({ ...row, receipt_url: receiptUrl || undefined, last_name: undefined });
    }));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[Customer orders]', error);
    return res.status(500).json({ success: false, message: 'Buyurtmalarni yuklashda xatolik.' });
  }
}

install('get', '/api/orders', listOrders);
install('get', '/api/customer/orders', listOrders);
install('get', '/api/guest/orders', listOrders);