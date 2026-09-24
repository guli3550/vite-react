const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 220 * 1024;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const p = new URLSearchParams(String(initData));
    const hash = p.get('hash');
    const authDate = Number(p.get('auth_date'));
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const pairs = [];
    p.forEach((value, key) => { if (key !== 'hash') pairs.push(`${key}=${value}`); });
    pairs.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    if (!safeEqual(calculated, hash)) return null;
    const user = JSON.parse(p.get('user') || 'null');
    if (!user?.id) return null;
    return {
      telegram_id: Number(user.id),
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      photo_url: user.photo_url || null,
    };
  } catch { return null; }
}

async function resolveIdentity(req) {
  const tg = telegramUser(req.headers['x-telegram-init-data'] || '');
  if (tg) return tg;
  if (!supabase) return null;
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return null;
  try {
    const { data, error } = await supabase.auth.getUser(authorization.slice(7));
    if (error || !data?.user) return null;
    const authUser = data.user;
    const { data: customer } = await supabase
      .from('customers')
      .select('telegram_id,username,full_name,avatar_url,phone')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();
    if (!customer?.telegram_id) return null;
    const metadata = authUser.user_metadata || {};
    return {
      telegram_id: Number(customer.telegram_id),
      username: customer.username || metadata.username || metadata.telegram_username || null,
      first_name: metadata.first_name || String(customer.full_name || '').split(/\s+/)[0] || null,
      last_name: metadata.last_name || null,
      photo_url: customer.avatar_url || metadata.telegram_photo_url || metadata.avatar_url || metadata.picture || null,
    };
  } catch { return null; }
}

function requireCustomer(req, res, next) {
  resolveIdentity(req).then(identity => {
    if (!identity) return res.status(401).json({ success: false, message: 'Telegram autentifikatsiyasi talab qilinadi. Web brauzerda ham shu Telegram hisobingiz bilan kiring.' });
    req.customerIdentity = identity;
    next();
  }).catch(() => res.status(401).json({ success: false, message: 'Mijoz autentifikatsiyasi tasdiqlanmadi.' }));
}

function admin(req) {
  try {
    if (!ADMIN_SECRET) return false;
    const value = String(req.headers.authorization || '');
    if (!value.startsWith('Bearer ')) return false;
    const [body, signature] = value.slice(7).split('.');
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
    if (!safeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.role === 'admin' && Number(payload.exp) > Date.now();
  } catch { return false; }
}

function display(row) {
  const first = String(row?.first_name || '').trim();
  const username = String(row?.username || '').trim().replace(/^@+/, '');
  if (first) return first;
  if (username) return `@${username}`;
  return 'GULI mijozi';
}

function parsePhoto(value) {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase().replace('jpg', 'jpeg');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null;
  return { mime, buffer, ext: mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg' };
}

async function persistTelegramProfilePhoto(telegramId, photoUrl) {
  const id = Number(telegramId);
  const url = String(photoUrl || '').trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !/^https:\/\//i.test(url)) return;
  try {
    // The photo_url comes from Telegram's validated WebApp initData. Keep the
    // canonical Telegram photo URL on users so browser profile + chat can use
    // the same durable source. Never let this auxiliary sync block a review.
    await supabase.from('users')
      .update({ telegram_photo_url: url, updated_at: new Date().toISOString() })
      .eq('telegram_id', id);
    // Do not overwrite a customer's manually uploaded avatar.
    await supabase.from('customers')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('telegram_id', id)
      .is('avatar_url', null);
  } catch (error) {
    console.warn('Telegram profile photo sync skipped:', error?.message || error);
  }
}

async function ensureReviewBucket() {
  if (!supabase) throw new Error('Supabase sozlanmagan');
  const existing = await supabase.storage.getBucket('review-images');
  if (!existing.error) return;
  const created = await supabase.storage.createBucket('review-images', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: '220KB',
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) throw created.error;
}

async function verifiedOrder(telegramId, productId, productCode) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number,status,items,created_at')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).find(order => {
    if (String(order.status || '') !== 'Yetkazildi') return false;
    return (Array.isArray(order.items) ? order.items : []).some(item => {
      const product = item?.product || {};
      return String(product.id ?? item?.product_id) === String(productId)
        || String(product.product_code || item?.product_code || '') === String(productCode);
    });
  }) || null;
}

install('get', '/api/reviews', async (req, res) => {
  try {
    const code = String(req.query.product_code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    const { data: product, error: productError } = await supabase.from('products').select('id,product_code,rating,reviews').eq('product_code', code).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id,rating,comment,photos,first_name,photo_url,created_at,verified_purchase,order_number')
      .eq('product_id', product.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data || []).map(row => ({ ...row, display_name: display(row), photos: Array.isArray(row.photos) ? row.photos : [] }));
    const liveSum = rows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
    const legacyCount = Math.max(0, Number(product.reviews || 0));
    const legacyAverage = Math.max(0, Number(product.rating || 0));
    const totalCount = legacyCount + rows.length;
    const average = totalCount ? Math.round(((legacyAverage * legacyCount + liveSum) / totalCount) * 100) / 100 : 0;
    const distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: rows.filter(row => Number(row.rating) === star).length }));
    res.json({ success: true, data: { reviews: rows, distribution, live_count: rows.length, total_count: totalCount, total_average: average } });
  } catch (error) {
    console.error('Canonical reviews GET:', error);
    res.status(500).json({ success: false, message: 'Sharhlarni yuklashda xatolik' });
  }
});

install('get', '/api/reviews/can-review', requireCustomer, async (req, res) => {
  try {
    const code = String(req.query.product_code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    const { data: product, error } = await supabase.from('products').select('id,product_code,name').eq('product_code', code).maybeSingle();
    if (error) throw error;
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    const order = await verifiedOrder(req.customerIdentity.telegram_id, product.id, code);
    if (!order) return res.json({ success: true, data: { eligible: false, reason: 'Baho berish faqat yetkazilgan buyurtmadan keyin mumkin.' } });
    const { data: existing, error: existingError } = await supabase.from('product_reviews').select('id,rating,comment,photos,created_at').eq('product_id', product.id).eq('telegram_id', req.customerIdentity.telegram_id).eq('order_number', order.order_number).maybeSingle();
    if (existingError) throw existingError;
    res.json({ success: true, data: { eligible: true, verified_purchase: true, order_number: order.order_number, existing: existing || null } });
  } catch (error) {
    console.error('Canonical review eligibility:', error);
    res.status(500).json({ success: false, message: 'Baho berish imkonini tekshirishda xatolik' });
  }
});

install('post', '/api/reviews', requireCustomer, async (req, res) => {
  try {
    const code = String(req.body?.product_code || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Mahsulot kodi noto‘g‘ri' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Baho 1 dan 5 gacha bo‘lishi kerak' });
    if (comment.length < 3 || comment.length > 1200) return res.status(400).json({ success: false, message: 'Sharh 3–1200 belgi bo‘lishi kerak' });
    const { data: product, error: productError } = await supabase.from('products').select('id,product_code,name').eq('product_code', code).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    const order = await verifiedOrder(req.customerIdentity.telegram_id, product.id, code);
    if (!order) return res.status(403).json({ success: false, message: 'Faqat yetkazilgan buyurtma uchun sharh qoldirish mumkin.' });
    const { data: duplicate, error: duplicateError } = await supabase.from('product_reviews').select('id').eq('product_id', product.id).eq('telegram_id', req.customerIdentity.telegram_id).eq('order_number', order.order_number).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return res.status(409).json({ success: false, message: 'Bu buyurtma uchun sharh allaqachon qoldirilgan.' });

    const photoUrls = [];
    for (const raw of (Array.isArray(req.body?.photos) ? req.body.photos.slice(0, MAX_PHOTOS) : [])) {
      const parsed = parsePhoto(raw);
      if (!parsed) continue;
      try {
        await ensureReviewBucket();
        const path = `${req.customerIdentity.telegram_id}/${product.id}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${parsed.ext}`;
        const uploaded = await supabase.storage.from('review-images').upload(path, parsed.buffer, { contentType: parsed.mime, cacheControl: '31536000', upsert: false });
        if (!uploaded.error) {
          const publicUrl = supabase.storage.from('review-images').getPublicUrl(path)?.data?.publicUrl;
          if (publicUrl) photoUrls.push(publicUrl);
        }
      } catch (photoError) {
        console.warn('Review photo upload skipped:', photoError?.message || photoError);
      }
    }

    const row = {
      product_id: product.id,
      product_code: code,
      telegram_id: req.customerIdentity.telegram_id,
      username: req.customerIdentity.username || null,
      first_name: req.customerIdentity.first_name || null,
      photo_url: req.customerIdentity.photo_url || null,
      rating,
      comment,
      photos: photoUrls,
      verified_purchase: true,
      order_number: order.order_number,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('product_reviews').insert([row]).select('id,rating,comment,photos,first_name,photo_url,created_at,verified_purchase,order_number').single();
    if (error) throw error;
    await persistTelegramProfilePhoto(req.customerIdentity.telegram_id, req.customerIdentity.photo_url);
    res.status(201).json({ success: true, message: 'Sharhingiz e’lon qilindi ✓', data: { ...data, display_name: display(data) } });
  } catch (error) {
    console.error('Canonical review POST:', error);
    res.status(500).json({ success: false, message: 'Sharhni saqlashda xatolik' });
  }
});

install('get', '/api/admin/reviews', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const { data, error } = await supabase.from('product_reviews').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { res.status(500).json({ success: false, message: 'Sharhlarni yuklashda xatolik' }); }
});

install('patch', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const status = ['approved', 'hidden'].includes(String(req.body?.status)) ? String(req.body.status) : null;
    if (!status) return res.status(400).json({ success: false, message: 'Sharh holati noto‘g‘ri' });
    const { data, error } = await supabase.from('product_reviews').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: 'Sharh holatini o‘zgartirishda xatolik' }); }
});

install('delete', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    const { error } = await supabase.from('product_reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: 'Sharhni o‘chirishda xatolik' }); }
});
