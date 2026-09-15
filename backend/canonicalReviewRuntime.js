// Canonical production review runtime.
// This is the single active customer review API. It deliberately avoids
// local/demo identity data and uses public.users as the canonical reviewer source.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get('hash');
    const auth = Number(p.get('auth_date'));
    if (!hash || !Number.isFinite(auth) || Math.abs(Math.floor(Date.now() / 1000) - auth) > 86400) return null;
    const pairs = [];
    p.forEach((v, k) => { if (k !== 'hash') pairs.push(`${k}=${v}`); });
    pairs.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    if (!safeEqual(calc, hash)) return null;
    const u = JSON.parse(p.get('user') || 'null');
    return u?.id ? { id: Number(u.id), username: u.username || null, first_name: u.first_name || null, last_name: u.last_name || null } : null;
  } catch { return null; }
}

function requireTelegram(req, res, next) {
  const user = telegramUser(req.headers['x-telegram-init-data'] || '');
  if (!user) return res.status(401).json({ success: false, message: 'Telegram sessiyasi tasdiqlanmadi. Mini App ichidan qayta oching.' });
  req.telegramUser = user;
  next();
}

function admin(req) {
  try {
    if (!ADMIN_SECRET) return false;
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) return false;
    const [body, sig] = h.slice(7).split('.');
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
    if (!safeEqual(sig, expected)) return false;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.role === 'admin' && Number(p.exp) > Date.now();
  } catch { return false; }
}

function cleanName(user) {
  const full = String(user?.full_name || '').trim();
  if (full && !/^(undefined|null|user|guli mijozi)$/i.test(full)) return full;
  const parts = [user?.first_name, user?.last_name].map(v => String(v || '').trim()).filter(Boolean);
  return parts.join(' ') || null;
}

async function reviewerMap(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id,full_name,first_name,last_name,telegram_photo_url')
    .in('telegram_id', ids);
  if (error) throw error;
  for (const u of data || []) {
    map.set(Number(u.telegram_id), {
      full_name: cleanName(u),
      photo_url: u.telegram_photo_url || null,
    });
  }
  return map;
}

async function verifiedOrder(telegramId, productId, code) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number,status,items,created_at')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).find(o => String(o.status || '') === 'Yetkazildi' && (Array.isArray(o.items) ? o.items : []).some(item => {
    const p = item?.product || {};
    return String(p.id ?? item?.product_id) === String(productId) || String(p.product_code || item?.product_code || '') === String(code);
  })) || null;
}

async function getProduct(code) {
  if (!supabase) throw new Error('Supabase sozlanmagan');
  const { data, error } = await supabase.from('products').select('id,product_code,name').eq('product_code', code).maybeSingle();
  if (error) throw error;
  return data;
}

install('get', '/api/reviews', async (req, res) => {
  try {
    const code = String(req.query.product_code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    const product = await getProduct(code);
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });

    const { data, error } = await supabase
      .from('product_reviews')
      .select('id,product_id,product_code,rating,comment,photos,telegram_id,created_at,verified_purchase,status,is_pinned')
      .eq('product_id', product.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const ids = [...new Set((data || []).map(r => Number(r.telegram_id)).filter(Number.isFinite))];
    const users = await reviewerMap(ids);
    const reviews = (data || []).map(r => {
      const identity = users.get(Number(r.telegram_id)) || {};
      return {
        id: r.id,
        product_id: r.product_id,
        product_code: r.product_code || product.product_code,
        rating: Number(r.rating),
        comment: r.comment,
        photos: Array.isArray(r.photos) ? r.photos : [],
        display_name: identity.full_name || 'Anonim mijoz',
        photo_url: identity.photo_url || null,
        verified_purchase: Boolean(r.verified_purchase),
        status: 'approved',
        is_pinned: Boolean(r.is_pinned),
        created_at: r.created_at,
      };
    });

    const count = reviews.length;
    const sum = reviews.reduce((n, r) => n + Number(r.rating || 0), 0);
    const average = count ? Math.round((sum / count) * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => r.rating === star).length }));

    return res.json({ success: true, data: { reviews, distribution, total_count: count, total_average: average } });
  } catch (e) {
    console.error('Canonical reviews GET:', e);
    return res.status(500).json({ success: false, message: 'Sharhlarni yuklashda xatolik' });
  }
});

install('get', '/api/reviews/can-review', requireTelegram, async (req, res) => {
  try {
    const code = String(req.query.product_code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    const product = await getProduct(code);
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    const order = await verifiedOrder(req.telegramUser.id, product.id, code);
    if (!order) return res.json({ success: true, data: { eligible: false, reason: 'Baho berish faqat yetkazilgan buyurtmadan keyin mumkin.' } });
    const { data: existing, error } = await supabase.from('product_reviews')
      .select('id,rating,comment,photos,created_at')
      .eq('product_id', product.id).eq('telegram_id', req.telegramUser.id).eq('order_number', order.order_number).maybeSingle();
    if (error) throw error;
    return res.json({ success: true, data: { eligible: true, verified_purchase: true, existing: existing || null } });
  } catch (e) {
    console.error('Canonical review eligibility:', e);
    return res.status(500).json({ success: false, message: 'Baho berish imkonini tekshirishda xatolik' });
  }
});

install('post', '/api/reviews', requireTelegram, async (req, res) => {
  try {
    const code = String(req.body?.product_code || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Baho 1 dan 5 gacha bo‘lishi kerak' });
    if (comment.length < 3 || comment.length > 1200) return res.status(400).json({ success: false, message: 'Sharh 3–1200 belgi bo‘lishi kerak' });
    const product = await getProduct(code);
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    const order = await verifiedOrder(req.telegramUser.id, product.id, code);
    if (!order) return res.status(403).json({ success: false, message: 'Faqat yetkazilgan buyurtma uchun sharh qoldirish mumkin.' });

    const { data: duplicate, error: duplicateError } = await supabase.from('product_reviews').select('id')
      .eq('product_id', product.id).eq('telegram_id', req.telegramUser.id).eq('order_number', order.order_number).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return res.status(409).json({ success: false, message: 'Bu buyurtma uchun sharh allaqachon qoldirilgan.' });

    const row = {
      product_id: product.id,
      product_code: code,
      telegram_id: req.telegramUser.id,
      username: req.telegramUser.username || null,
      first_name: req.telegramUser.first_name || null,
      rating,
      comment,
      photos: Array.isArray(req.body?.photos) ? req.body.photos.slice(0, 3) : [],
      verified_purchase: true,
      order_number: order.order_number,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('product_reviews')
      .insert([row])
      .select('id,product_id,product_code,rating,comment,photos,telegram_id,created_at,verified_purchase,status,is_pinned')
      .single();
    if (error) throw error;

    const identity = (await reviewerMap([req.telegramUser.id])).get(req.telegramUser.id) || {};
    return res.status(201).json({ success: true, message: 'Sharhingiz e’lon qilindi ✓', data: {
      id: data.id,
      product_id: data.product_id,
      product_code: data.product_code,
      rating: data.rating,
      comment: data.comment,
      photos: Array.isArray(data.photos) ? data.photos : [],
      display_name: identity.full_name || 'Anonim mijoz',
      photo_url: identity.photo_url || null,
      verified_purchase: true,
      created_at: data.created_at,
    } });
  } catch (e) {
    console.error('Canonical review POST:', e);
    return res.status(500).json({ success: false, message: 'Sharhni saqlashda xatolik' });
  }
});

install('get', '/api/admin/reviews', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const { data, error } = await supabase.from('product_reviews')
      .select('id,product_id,product_code,rating,comment,photos,telegram_id,created_at,verified_purchase,status,is_pinned,order_number')
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    const ids = [...new Set((data || []).map(r => Number(r.telegram_id)).filter(Number.isFinite))];
    const users = await reviewerMap(ids);
    const safe = (data || []).map(r => {
      const identity = users.get(Number(r.telegram_id)) || {};
      return { ...r, display_name: identity.full_name || 'Anonim mijoz', photo_url: identity.photo_url || null };
    });
    return res.json({ success: true, data: safe });
  } catch (e) {
    console.error('Canonical admin reviews GET:', e);
    return res.status(500).json({ success: false, message: 'Sharhlarni yuklashda xatolik' });
  }
});

install('patch', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const patch = {};
    if (['approved', 'hidden'].includes(String(req.body?.status))) patch.status = String(req.body.status);
    if (typeof req.body?.is_pinned === 'boolean') patch.is_pinned = req.body.is_pinned;
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: 'O‘zgarish topilmadi' });
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('product_reviews').update(patch).eq('id', req.params.id)
      .select('id,product_id,product_code,rating,comment,photos,telegram_id,created_at,verified_purchase,status,is_pinned,order_number').single();
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (e) {
    console.error('Canonical admin review PATCH:', e);
    return res.status(500).json({ success: false, message: 'Sharhni o‘zgartirishda xatolik' });
  }
});

install('delete', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const { error } = await supabase.from('product_reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error('Canonical admin review DELETE:', e);
    return res.status(500).json({ success: false, message: 'Sharhni o‘chirishda xatolik' });
  }
});

console.log('[GULI Reviews] canonical real-data review runtime active');
