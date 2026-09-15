// Secure customer order history for browser-authenticated users, Telegram customers, and legacy guest sessions.
// The same canonical /api/orders route serves all supported customer identities.
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
    return Number.isSafeInteger(id) && id > 0 ? { type: 'telegram', id } : null;
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
    return { type: 'guest', id };
  } catch { return null; }
}

async function browserUser(req) {
  if (!supabase) return null;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data?.user?.id ? null : { type: 'auth', id: String(data.user.id) };
}

async function customer(req) {
  return telegramUser(req.headers['x-telegram-init-data'] || '')
    || guestUser(req.headers['x-guli-guest-token'] || '')
    || await browserUser(req);
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
    return {
      ...it,
      image: img,
      name,
      product_code: code,
      price,
      product: {
        ...prod,
        name: prod.name || name,
        image: prod.image || img,
        price: prod.price != null ? prod.price : price,
        product_code: prod.product_code || code,
      }
    };
  });
}

function mapOrder(row) {
  return {
    id: String(row.order_number || row.id || ''),
    order_number: row.order_number || undefined,
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    customer_name: row.customer_name || undefined,
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
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
    statusUpdatedAt: row.updated_at || undefined,
  };
}

async function listOrders(req, res) {
  const user = await customer(req);

  // SECURITY FIX (IDOR): order lists must only ever be scoped by a
  // server-verified identity (validated Telegram initData or a valid
  // Supabase auth JWT). The previous implementation additionally accepted
  // client-supplied `phone`, `order_numbers` and `telegram_id`
  // query/header values and OR-ed them into the database filter. That let
  // anyone (even with a garbage `Authorization: Bearer x` header, which is
  // enough to pass the upstream boundary check) read another customer's
  // full order history, address and signed receipt-image URLs just by
  // supplying their phone number or a guessed order number. There is no
  // longer any unauthenticated or self-declared fallback path.
  if (!user || (user.type !== 'auth' && user.type !== 'telegram')) {
    return res.status(401).json({ success: false, message: 'Mijoz autentifikatsiyasi talab qilinadi.' });
  }

  if (!supabase) return res.status(503).json({ success: false, message: 'Buyurtmalar xizmati sozlanmagan.' });
  try {
    let query = supabase
      .from('orders')
      .select('id,order_number,first_name,last_name,customer_name,phone,items,subtotal,delivery,discount,total,address,payment,payment_status,payment_receipt_path,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    query = user.type === 'auth'
      ? query.eq('auth_user_id', user.id)
      : query.eq('telegram_id', user.id);

    const { data, error } = await query;
    if (error) throw error;

    const formatted = await Promise.all(
      (data || []).map(async (row) => {
        let receiptUrl = '';
        if (row.payment_receipt_path) {
          try {
            const { data: sData } = await supabase.storage
              .from('payment-receipts')
              .createSignedUrl(String(row.payment_receipt_path).replace(/^\/+/, ''), 86400);
            receiptUrl = sData?.signedUrl || '';
          } catch {}
        }
        return mapOrder({
          ...row,
          receipt_url: receiptUrl || undefined
        });
      })
    );

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[Customer orders]', error);
    return res.status(500).json({ success: false, message: 'Buyurtmalarni yuklashda xatolik.' });
  }
}

async function uploadReceipt(req, res) {
  if (!supabase) return res.status(503).json({ success: false, message: 'Xizmat sozlanmagan.' });
  try {
    // SECURITY FIX (IDOR): this endpoint previously had no authentication
    // or ownership check at all - anyone who knew or guessed an
    // order_number (format GULI-XXXXXX, only 6 digits) could overwrite
    // that order's payment receipt and flip its payment_status. We now
    // require a verified identity and confirm the order actually belongs
    // to that identity before accepting the upload.
    const user = await customer(req);
    if (!user || (user.type !== 'auth' && user.type !== 'telegram')) {
      return res.status(401).json({ success: false, message: 'Mijoz autentifikatsiyasi talab qilinadi.' });
    }

    const orderIdentifier = String(req.params.orderNumber || req.params.id || req.body?.order_id || '').trim();
    if (!orderIdentifier) {
      return res.status(400).json({ success: false, message: 'Buyurtma identifikatori topilmadi.' });
    }

    // Try finding order by order_number or id
    let { data: order, error: oe } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderIdentifier)
      .maybeSingle();

    if (!order) {
      const byId = await supabase.from('orders').select('*').eq('id', orderIdentifier).maybeSingle();
      order = byId.data;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });
    }

    const owns = user.type === 'auth'
      ? order.auth_user_id && String(order.auth_user_id) === String(user.id)
      : order.telegram_id != null && Number(order.telegram_id) === Number(user.id);

    if (!owns) {
      return res.status(403).json({ success: false, message: 'Bu buyurtma sizga tegishli emas.' });
    }

    let rawData = req.body?.data || req.body?.receipt_url || '';
    let mimeType = req.body?.mimeType || 'image/jpeg';

    if (typeof rawData === 'string' && rawData.startsWith('data:')) {
      const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        rawData = match[2];
      }
    }

    if (!rawData) {
      return res.status(400).json({ success: false, message: 'Chek rasmi taqdim etilmadi.' });
    }

    const buffer = Buffer.from(rawData, 'base64');
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Chek hajmi juda katta yoki fayl yaroqsiz.' });
    }

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filePath = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    // Upload to Supabase Storage bucket 'payment-receipts'
    const up = await supabase.storage.from('payment-receipts').upload(filePath, buffer, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: true,
    });

    if (up.error) {
      console.error('[Storage receipt upload error]', up.error);
      throw up.error;
    }

    // Generate signed URL valid for 24h
    let signedReceiptUrl = '';
    try {
      const { data: sData } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(filePath, 86400);
      signedReceiptUrl = sData?.signedUrl || '';
    } catch {}

    // Receipt upload must only update payment fields. Never regress the fulfillment status.
    const patchData = {
      payment_receipt_path: filePath,
      payment_status: 'receipt_uploaded',
      payment_receipt_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: ue } = await supabase
      .from('orders')
      .update(patchData)
      .eq('id', order.id)
      .select('*')
      .single();

    if (ue) throw ue;

    // Remove old receipt if different
    if (order.payment_receipt_path && order.payment_receipt_path !== filePath) {
      supabase.storage.from('payment-receipts').remove([order.payment_receipt_path]).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Chek muvaffaqiyatli saqlandi. Admin tez orada tekshiradi.',
      data: {
        ...updated,
        receipt_url: signedReceiptUrl,
      },
    });
  } catch (error) {
    console.error('[Upload receipt error]', error);
    return res.status(500).json({ success: false, message: 'Chekni yuborishda xatolik yuz berdi.' });
  }
}

install('get', '/api/orders', listOrders);
install('get', '/api/guest/orders', listOrders);
install('post', '/api/orders/:orderNumber/receipt', uploadReceipt);
install('post', '/api/orders/:id/receipt', uploadReceipt);
install('post', '/api/orders/:orderNumber/payment-receipt', uploadReceipt);
