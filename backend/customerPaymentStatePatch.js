// Customer-only payment state and private receipt preview.
// Canonical browser identity = GULI JWT -> public.users.id.
// Telegram Mini App identity = verified Telegram initData -> telegram_id.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { verifyAccessToken } = require('./guliCustomAuth.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const RECEIPT_BUCKET = 'payment-receipts';
const TELEGRAM_INITDATA_TTL = 24 * 60 * 60;

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verifyTelegramInitData(raw) {
  if (!raw || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(String(raw));
    const received = params.get('hash') || '';
    const authDate = Number(params.get('auth_date'));
    if (!received || !Number.isFinite(authDate)) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > TELEGRAM_INITDATA_TTL) return null;
    params.delete('hash');
    const dataCheck = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (!safeEqual(received, expected)) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return Number.isSafeInteger(Number(user.id)) ? { id: Number(user.id) } : null;
  } catch {
    return null;
  }
}

async function requireCustomer(req, res, next) {
  const auth = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(auth)) {
    try {
      const claims = verifyAccessToken(auth.replace(/^Bearer\s+/i, '').trim());
      if (claims?.sub) {
        if (!supabase) return res.status(503).json({ success: false, message: 'To‘lov xizmati sozlanmagan.' });
        const { data: user, error } = await supabase
          .from('users')
          .select('id,phone_number,telegram_id')
          .eq('id', String(claims.sub))
          .maybeSingle();
        if (!error && user) {
          req.customerPaymentUser = { kind: 'guli', id: String(user.id), telegramId: user.telegram_id != null ? Number(user.telegram_id) : null };
          return next();
        }
      }
    } catch {}
  }

  const telegram = verifyTelegramInitData(req.headers['x-telegram-init-data'] || '');
  if (telegram) {
    req.customerPaymentUser = { kind: 'telegram', id: telegram.id };
    return next();
  }

  return res.status(401).json({ success: false, message: 'Mijoz sessiyasi topilmadi.' });
}

const { install } = require('./routeRegistry.js');
install('get', '/api/orders/:orderNumber/payment-state', requireCustomer, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ success: false, message: 'To‘lov xizmati sozlanmagan.' });
    const orderNumber = String(req.params.orderNumber || '').trim();
    if (!orderNumber) return res.status(400).json({ success: false, message: 'Buyurtma raqami kerak.' });

    let query = supabase
      .from('orders')
      .select('id,order_number,total,subtotal,delivery,discount,phone,payment,payment_status,payment_receipt_path,payment_receipt_uploaded_at,payment_verified_at,telegram_id,address,items,updated_at')
      .eq('order_number', orderNumber);

    if (req.customerPaymentUser.kind === 'guli') {
      query = query.eq('auth_user_id', String(req.customerPaymentUser.id));
    } else {
      query = query.eq('telegram_id', Number(req.customerPaymentUser.id));
    }

    const { data: order, error } = await query.maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });

    let receiptUrl = '';
    if (order.payment_receipt_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(String(order.payment_receipt_path).replace(/^\/+/, ''), 900);
      if (!signedError) receiptUrl = String(signed?.signedUrl || '');
    }

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      data: {
        ...order,
        receipt_path: order.payment_receipt_path || '',
        receipt_url: receiptUrl,
        receipt_available: Boolean(order.payment_receipt_path),
      },
    });
  } catch (error) {
    console.error('[Customer payment state]', error);
    return res.status(500).json({ success: false, message: 'To‘lov ma’lumotlarini olishda xatolik.' });
  }
});
