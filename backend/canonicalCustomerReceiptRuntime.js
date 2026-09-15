// Canonical customer receipt mutation boundary.
// Loaded last so legacy receipt handlers cannot answer before the canonical auth path.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { verifyAccessToken } = require('./guliCustomAuth.js');
const { install, registry } = require('./routeRegistry.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const BUCKET = 'payment-receipts';
const MAX_BYTES = 6 * 1024 * 1024;
const RECEIPT_ROUTES = [
  '/api/orders/:orderNumber/receipt',
  '/api/orders/:id/receipt',
  '/api/orders/:orderNumber/payment-receipt',
  '/api/customer/orders/:orderNumber/receipt',
];

// Remove legacy registry entries so the canonical handler is the only receipt mutation.
registry.routes = registry.routes.filter((route) => !RECEIPT_ROUTES.includes(route.path));

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function telegramUser(raw) {
  if (!BOT_TOKEN || !raw) return null;
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
    return Number.isSafeInteger(id) && id > 0 ? { kind: 'telegram', telegramId: id } : null;
  } catch { return null; }
}

async function customer(req) {
  const header = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(header)) {
    try {
      const claims = verifyAccessToken(header.replace(/^Bearer\s+/i, '').trim());
      if (claims?.sub && supabase) {
        const { data: user } = await supabase.from('users').select('id,telegram_id').eq('id', String(claims.sub)).maybeSingle();
        if (user) return { kind: 'guli', userId: String(user.id), telegramId: user.telegram_id != null ? Number(user.telegram_id) : null };
      }
    } catch {}
  }
  return telegramUser(req.headers['x-telegram-init-data'] || '');
}

function decodeReceipt(raw, mimeType) {
  const data = String(raw || '');
  if (!data || data.length > 8500000 || data.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('Chek fayli noto‘g‘ri kodlangan');
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('Chek hajmi 6 MB dan oshmasligi kerak');
  const h = buffer.subarray(0, 12);
  const valid =
    (mimeType === 'image/jpeg' && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) ||
    (mimeType === 'image/png' && h.toString('hex', 0, 8) === '89504e470d0a1a0a') ||
    (mimeType === 'image/webp' && h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') ||
    (mimeType === 'application/pdf' && h.toString('ascii', 0, 5) === '%PDF-');
  if (!valid) throw new Error('Chek fayli e’lon qilingan formatga mos emas');
  return buffer;
}

function ext(mime) { return mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'; }
function fail(res, code, message) { return res.status(code).json({ success: false, message }); }

async function uploadReceipt(req, res) {
  const user = await customer(req);
  if (!user) return fail(res, 401, 'Mijoz autentifikatsiyasi talab qilinadi.');
  if (!supabase) return fail(res, 503, 'To‘lov xizmati sozlanmagan.');

  const identifier = String(req.params.orderNumber || req.params.id || '').trim();
  if (!identifier) return fail(res, 400, 'Buyurtma identifikatori topilmadi.');

  try {
    let query = supabase.from('orders').select('id,order_number,total,auth_user_id,telegram_id,payment,payment_status,payment_receipt_path');
    query = user.kind === 'guli'
      ? query.eq('order_number', identifier).eq('auth_user_id', user.userId)
      : query.eq('order_number', identifier).eq('telegram_id', user.telegramId);
    let { data: order, error } = await query.maybeSingle();
    if (error) throw error;
    if (!order && req.params.id) {
      let idQuery = supabase.from('orders').select('id,order_number,total,auth_user_id,telegram_id,payment,payment_status,payment_receipt_path').eq('id', identifier);
      idQuery = user.kind === 'guli' ? idQuery.eq('auth_user_id', user.userId) : idQuery.eq('telegram_id', user.telegramId);
      const result = await idQuery.maybeSingle();
      if (result.error) throw result.error;
      order = result.data;
    }
    if (!order) return fail(res, 404, 'Buyurtma topilmadi.');
    if (String(order.payment || '') !== 'card_manual') return fail(res, 400, 'Bu buyurtma karta orqali to‘lov uchun yaratilmagan.');
    if (String(order.payment_status || 'pending') === 'verified') return fail(res, 409, 'To‘lov allaqachon tasdiqlangan. Tasdiqlangan buyurtmaga yangi chek yuborib bo‘lmaydi.');

    let { data, mimeType } = req.body || {};
    mimeType = String(mimeType || '');
    if (typeof data === 'string' && data.startsWith('data:')) {
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mimeType = match[1]; data = match[2]; }
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) return fail(res, 400, 'Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin.');
    const buffer = decodeReceipt(data, mimeType);
    const path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext(mimeType)}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, cacheControl: '31536000', upsert: false });
    if (uploadError) throw uploadError;

    let update = supabase.from('orders').update({
      payment_receipt_path: path,
      payment_status: 'receipt_uploaded',
      payment_receipt_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', order.id).in('payment_status', ['pending', 'receipt_uploaded', 'rejected']);
    update = user.kind === 'guli' ? update.eq('auth_user_id', user.userId) : update.eq('telegram_id', user.telegramId);
    const { data: updated, error: updateError } = await update.select('id,order_number,total,payment_status,payment_receipt_path').maybeSingle();
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      throw updateError;
    }
    if (!updated) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      return fail(res, 409, 'Buyurtma holati o‘zgargan. Tasdiqlangan buyurtmaga chek yuklab bo‘lmaydi.');
    }
    if (order.payment_receipt_path && order.payment_receipt_path !== path) await supabase.storage.from(BUCKET).remove([order.payment_receipt_path]).catch(() => {});

    let receiptUrl = '';
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 900);
    if (!signed.error) receiptUrl = String(signed.data?.signedUrl || '');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, message: 'Chek muvaffaqiyatli yuborildi. Admin tekshiradi.', data: { ...updated, receipt_url: receiptUrl } });
  } catch (error) {
    console.error('[Canonical receipt upload]', error);
    const bad = /Chek fayli|Chek hajmi/i.test(error.message || '');
    return fail(res, bad ? 400 : 500, bad ? error.message : 'Chekni yuborishda xatolik.');
  }
}

for (const route of RECEIPT_ROUTES) install('post', route, uploadReceipt);
console.log('[GULI Payment] Canonical customer receipt mutation boundary active.');
