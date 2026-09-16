// Canonical production review runtime.
// Single active customer review API; resilient schema and user identity mapping.
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
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 220 * 1024;

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
  const combined = [user?.first_name, user?.last_name].map(v => String(v || '').trim()).filter(Boolean).join(' ');
  if (combined) return combined;
  if (user?.username) return `@${user.username}`;
  return null;
}

async function reviewerMap(ids) {
  const map = new Map();
  if (!supabase || !ids.length) return map;

  // 1. Try public.users
  try {
    const { data, error } = await supabase
      .from('users')
      .select('telegram_id,full_name,first_name,last_name,telegram_photo_url')
      .in('telegram_id', ids);
    if (!error && Array.isArray(data)) {
      for (const u of data) {
        const name = cleanName(u);
        if (name) map.set(Number(u.telegram_id), { full_name: name, photo_url: u.telegram_photo_url || null });
      }
    }
  } catch (e) {
    // Ignore schema mismatch
  }

  // 2. Try telegram_users for any unresolved IDs
  const missingTgIds = ids.filter(id => !map.has(Number(id)));
  if (missingTgIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('telegram_users')
        .select('telegram_id,first_name,last_name,username')
        .in('telegram_id', missingTgIds);
      if (!error && Array.isArray(data)) {
        for (const u of data) {
          const name = cleanName(u);
          if (name) map.set(Number(u.telegram_id), { full_name: name, photo_url: null });
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 3. Try customers table for remaining
  const remainingIds = ids.filter(id => !map.has(Number(id)));
  if (remainingIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('telegram_id,full_name,avatar_url')
        .in('telegram_id', remainingIds);
      if (!error && Array.isArray(data)) {
        for (const u of data) {
          const name = cleanName(u);
          if (name) map.set(Number(u.telegram_id), { full_name: name, photo_url: u.avatar_url || null });
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  return map;
}

async function verifiedOrder(telegramId, productId, code) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_number,status,items,created_at')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return null;
    for (const order of data || []) {
      const isDelivered = /yetkazildi|delivered|completed/i.test(String(order.status || ''));
      if (!isDelivered) continue;
      const items = Array.isArray(order.items) ? order.items : [];
      const matches = items.some(item => {
        const product = item?.product || {};
        return String(product.id ?? item?.product_id) === String(productId)
          || (code && String(product.product_code ?? item?.product_code ?? '') === String(code));
      });
      if (matches) return order;
    }
  } catch {
    return null;
  }
  return null;
}

async function getProduct(codeOrId) {
  if (!supabase) return null;
  const param = String(codeOrId || '').trim();
  if (!param) return null;
  try {
    // Try by product_code
    if (/^\d{6}$/.test(param)) {
      const { data, error } = await supabase.from('products').select('*').eq('product_code', param).maybeSingle();
      if (!error && data) return data;
    }
    // Try by id
    const { data: byId, error: errId } = await supabase.from('products').select('*').eq('id', param).maybeSingle();
    if (!errId && byId) return byId;

    // Fallback: search by product_code as string
    const { data: byCode } = await supabase.from('products').select('*').eq('product_code', param).maybeSingle();
    if (byCode) return byCode;
  } catch (err) {
    console.warn('getProduct lookup exception:', err?.message);
  }
  return null;
}

function parsePhoto(value) {
  const m = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1].toLowerCase().replace('jpg', 'jpeg');
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null;
  return { mime, buffer, ext: mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg' };
}

async function ensureReviewBucket() {
  if (!supabase) return;
  try {
    const current = await supabase.storage.getBucket('review-images');
    if (!current.error) return;
    const created = await supabase.storage.createBucket('review-images', { public: true, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'], fileSizeLimit: '220KB' });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) console.warn('Bucket note:', created.error.message);
  } catch {}
}

async function storeReviewPhotos(telegramId, productId, rawPhotos) {
  const urls = [];
  if (!supabase) return urls;
  for (const raw of (Array.isArray(rawPhotos) ? rawPhotos.slice(0, MAX_PHOTOS) : [])) {
    const parsed = parsePhoto(raw);
    if (!parsed) continue;
    try {
      await ensureReviewBucket();
      const path = `${telegramId}/${productId}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${parsed.ext}`;
      const up = await supabase.storage.from('review-images').upload(path, parsed.buffer, { contentType: parsed.mime, cacheControl: '31536000', upsert: false });
      if (up.error) { console.warn('Review photo upload skipped:', up.error.message); continue; }
      const pub = supabase.storage.from('review-images').getPublicUrl(path);
      if (pub.data?.publicUrl) urls.push(pub.data.publicUrl);
    } catch (e) { console.warn('Review photo upload skipped:', e.message); }
  }
  return urls;
}

install('get', '/api/reviews', async (req, res) => {
  try {
    const param = String(req.query.product_code || req.query.product_id || req.query.id || '').trim();
    if (!param) {
      return res.json({ success: true, data: { reviews: [], distribution: [5,4,3,2,1].map(star => ({ star, count: 0 })), total_count: 0, total_average: 0 } });
    }
    const product = await getProduct(param);
    const productId = product?.id || param;
    const productCode = product?.product_code || (/^\d{6}$/.test(param) ? param : '');

    let rawReviews = [];
    if (supabase) {
      try {
        let q = supabase.from('product_reviews').select('*');
        if (product?.id && productCode) {
          q = q.or(`product_id.eq.${product.id},product_code.eq.${productCode}`);
        } else if (product?.id) {
          q = q.eq('product_id', product.id);
        } else {
          q = q.eq('product_code', param);
        }
        const { data, error } = await q.order('created_at', { ascending: false }).limit(100);
        if (!error && Array.isArray(data)) {
          rawReviews = data;
        }
      } catch (dbErr) {
        console.warn('Reviews query note:', dbErr?.message);
      }
    }

    // Filter approved if status column is present and set
    const approvedReviews = rawReviews.filter(r => !r.status || r.status === 'approved');

    const ids = [...new Set(approvedReviews.map(r => Number(r.telegram_id)).filter(id => Number.isFinite(id) && id > 0))];
    const users = await reviewerMap(ids);

    const reviews = approvedReviews.map(r => {
      const identity = users.get(Number(r.telegram_id));
      const fallbackName = r.display_name || cleanName(r) || (r.first_name ? [r.first_name, r.last_name].filter(Boolean).join(' ') : r.username ? `@${r.username}` : 'GULI mijozi');
      const displayName = identity?.full_name || fallbackName;
      const photoUrl = identity?.photo_url || r.photo_url || null;

      return {
        id: r.id,
        product_id: r.product_id || productId,
        product_code: r.product_code || productCode || param,
        rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
        comment: String(r.comment || ''),
        photos: Array.isArray(r.photos) ? r.photos : [],
        display_name: displayName,
        photo_url: photoUrl,
        verified_purchase: Boolean(r.verified_purchase),
        status: 'approved',
        is_pinned: Boolean(r.is_pinned),
        created_at: r.created_at || new Date().toISOString(),
      };
    });

    const count = reviews.length;
    const sum = reviews.reduce((n, r) => n + Number(r.rating || 0), 0);
    const average = count ? Math.round(sum / count * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length
    }));

    return res.json({
      success: true,
      data: {
        reviews,
        distribution,
        total_count: count,
        total_average: average
      }
    });
  } catch (e) {
    console.error('Canonical reviews GET error handled:', e?.message);
    return res.json({
      success: true,
      data: {
        reviews: [],
        distribution: [5, 4, 3, 2, 1].map(star => ({ star, count: 0 })),
        total_count: 0,
        total_average: 0
      }
    });
  }
});

install('get', '/api/reviews/can-review', requireTelegram, async (req, res) => {
  try {
    const code = String(req.query.product_code || req.query.product_id || '').trim();
    const product = await getProduct(code);
    const productId = product?.id || code;
    const order = await verifiedOrder(req.telegramUser.id, productId, product?.product_code || code);
    if (!order) {
      return res.json({ success: true, data: { eligible: false, reason: 'Baho berish faqat yetkazilgan buyurtmadan keyin mumkin.' } });
    }
    let existing = null;
    if (supabase) {
      const { data } = await supabase.from('product_reviews').select('id,rating,comment,photos,created_at')
        .eq('telegram_id', req.telegramUser.id).eq('order_number', order.order_number).maybeSingle();
      existing = data || null;
    }
    return res.json({ success: true, data: { eligible: true, verified_purchase: true, existing } });
  } catch (e) {
    console.error('Canonical review eligibility note:', e?.message);
    return res.json({ success: true, data: { eligible: false, reason: 'Baho berish holatini aniqlab bo‘lmadi.' } });
  }
});

install('post', '/api/reviews', requireTelegram, async (req, res) => {
  try {
    const code = String(req.body?.product_code || req.body?.product_id || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Baho 1 dan 5 gacha bo‘lishi kerak' });
    }
    if (comment.length < 3 || comment.length > 1200) {
      return res.status(400).json({ success: false, message: 'Sharh 3–1200 belgi bo‘lishi kerak' });
    }
    const product = await getProduct(code);
    const productId = product?.id || code;
    const productCode = product?.product_code || code;

    const identity = (await reviewerMap([req.telegramUser.id])).get(req.telegramUser.id);
    const displayName = identity?.full_name || [req.telegramUser.first_name, req.telegramUser.last_name].filter(Boolean).join(' ') || req.telegramUser.username || 'GULI mijozi';

    const order = await verifiedOrder(req.telegramUser.id, productId, productCode);
    const orderNumber = order?.order_number || `GULI-${Math.floor(100000 + Math.random() * 900000)}`;

    const photos = await storeReviewPhotos(req.telegramUser.id, productId, req.body?.photos);
    const row = {
      product_id: productId,
      product_code: productCode,
      telegram_id: req.telegramUser.id,
      username: req.telegramUser.username || null,
      first_name: req.telegramUser.first_name || null,
      rating,
      comment,
      photos,
      verified_purchase: Boolean(order),
      order_number: orderNumber,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (supabase) {
      const { data, error } = await supabase.from('product_reviews').insert([row]).select('*').maybeSingle();
      if (error && error.code === '23505') {
        return res.status(409).json({ success: false, message: 'Bu buyurtma uchun sharh allaqachon qoldirilgan.' });
      }
      return res.status(201).json({
        success: true,
        message: 'Sharhingiz e’lon qilindi ✓',
        data: {
          id: data?.id || Date.now(),
          product_id: productId,
          product_code: productCode,
          rating,
          comment,
          photos,
          display_name: displayName,
          photo_url: identity?.photo_url || null,
          verified_purchase: Boolean(order),
          created_at: row.created_at,
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sharhingiz e’lon qilindi ✓',
      data: {
        id: Date.now(),
        product_id: productId,
        product_code: productCode,
        rating,
        comment,
        photos,
        display_name: displayName,
        photo_url: null,
        verified_purchase: Boolean(order),
        created_at: row.created_at,
      }
    });
  } catch (e) {
    console.error('Canonical review POST error:', e?.message);
    return res.status(500).json({ success: false, message: 'Sharhni saqlashda xatolik yuz berdi' });
  }
});

install('get', '/api/admin/reviews', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    if (!supabase) return res.json({ success: true, data: [] });
    const { data, error } = await supabase.from('product_reviews').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    const ids = [...new Set((data || []).map(r => Number(r.telegram_id)).filter(id => Number.isFinite(id) && id > 0))];
    const users = await reviewerMap(ids);
    const safe = (data || []).map(r => {
      const identity = users.get(Number(r.telegram_id)) || {};
      return {
        ...r,
        display_name: identity.full_name || r.display_name || cleanName(r) || 'GULI mijozi',
        photo_url: identity.photo_url || r.photo_url || null
      };
    });
    return res.json({ success: true, data: safe });
  } catch (e) {
    console.error('Canonical admin reviews GET error:', e?.message);
    return res.status(500).json({ success: false, message: 'Sharhlarni yuklashda xatolik' });
  }
});

install('patch', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    if (!supabase) return res.status(503).json({ success: false, message: 'Baza ulanmagan' });
    const patch = {};
    if (['approved', 'hidden'].includes(String(req.body?.status))) patch.status = String(req.body.status);
    if (typeof req.body?.is_pinned === 'boolean') patch.is_pinned = req.body.is_pinned;
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: 'O‘zgarish topilmadi' });
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('product_reviews').update(patch).eq('id', req.params.id).select('*').maybeSingle();
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (e) {
    console.error('Canonical admin review PATCH error:', e?.message);
    return res.status(500).json({ success: false, message: 'Sharhni o‘zgartirishda xatolik' });
  }
});

install('delete', '/api/admin/reviews/:id', async (req, res) => {
  if (!admin(req)) return res.status(401).json({ success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
  try {
    if (!supabase) return res.status(503).json({ success: false, message: 'Baza ulanmagan' });
    const { error } = await supabase.from('product_reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error('Canonical admin review DELETE error:', e?.message);
    return res.status(500).json({ success: false, message: 'Sharhni o‘chirishda xatolik' });
  }
});

console.log('[GULI Reviews] canonical resilient real-data review runtime active');

