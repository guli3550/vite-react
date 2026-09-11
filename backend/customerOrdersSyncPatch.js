// Secure customer order history for browser guests and Telegram customers.
// This endpoint is read-only and scopes results strictly to the authenticated customer id.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();
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
    return Number.isSafeInteger(id) && id > 0 ? { id } : null;
  } catch { return null; }
}

function guestUser(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature || !ADMIN_SECRET) return null;
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const id = Number(data.guestId);
    if (!Number.isSafeInteger(id) || id >= 0 || Number(data.exp) < Date.now()) return null;
    return { id };
  } catch { return null; }
}

function customer(req) {
  return telegramUser(req.headers['x-telegram-init-data'] || '') || guestUser(req.headers['x-guli-guest-token'] || '');
}

function mapOrder(row) {
  return {
    id: String(row.order_number || row.id || ''),
    order_number: row.order_number || undefined,
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    customer_name: row.customer_name || undefined,
    phone: row.phone || '',
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal || 0),
    delivery: Number(row.delivery || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    address: row.address || undefined,
    payment: row.payment || '',
    payment_status: row.payment_status || 'pending',
    payment_receipt_path: row.payment_receipt_path || undefined,
    status: row.status || '⏳ Buyurtma kutilmoqda',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
    statusUpdatedAt: row.updated_at || undefined,
  };
}

async function listOrders(req, res) {
  const user = customer(req);
  if (!user) return res.status(401).json({ success: false, message: 'Mijoz sessiyasi topilmadi.' });
  if (!supabase) return res.status(503).json({ success: false, message: 'Buyurtmalar xizmati sozlanmagan.' });
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,first_name,last_name,customer_name,phone,items,subtotal,delivery,discount,total,address,payment,payment_status,payment_receipt_path,status,created_at,updated_at')
      .eq('telegram_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: (data || []).map(mapOrder) });
  } catch (error) {
    console.error('[Customer orders]', error);
    return res.status(500).json({ success: false, message: 'Buyurtmalarni yuklashda xatolik.' });
  }
}

install('get', '/api/orders', listOrders);
install('get', '/api/guest/orders', listOrders);
