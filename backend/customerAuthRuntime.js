// Unified customer auth & canonical identity bridge for Telegram + Web + Mobile
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const APP_URL = String(process.env.MINI_APP_URL || 'https://vite-react-seven-inky-10.vercel.app').replace(/\/$/, '');
const RECEIPT_BUCKET = 'payment-receipts';

const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function telegramUser(raw) {
  if (!BOT || !raw) return null;
  try {
    const p = new URLSearchParams(String(raw));
    const h = p.get('hash');
    const ad = Number(p.get('auth_date'));
    if (!h || !Number.isFinite(ad) || Math.abs(Math.floor(Date.now() / 1000) - ad) > 86400) return null;
    const a = [];
    p.forEach((v, k) => { if (k !== 'hash') a.push(`${k}=${v}`); });
    a.sort();
    const s = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
    const c = crypto.createHmac('sha256', s).update(a.join('\n')).digest('hex');
    if (!safeEqual(h, c)) return null;
    const u = JSON.parse(p.get('user') || 'null');
    return u?.id ? { kind: 'telegram', telegram_id: Number(u.id), user: u } : null;
  } catch {
    return null;
  }
}

async function authUser(req) {
  if (!supabase) return null;
  const h = String(req.headers.authorization || '');
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { data, error } = await supabase.auth.getUser(h.slice(7));
    if (error || !data?.user) return null;
    return { kind: 'auth', auth_user_id: data.user.id, user: data.user };
  } catch {
    return null;
  }
}

async function customer(req) {
  return telegramUser(req.headers['x-telegram-init-data'] || '') || await authUser(req);
}

function fail(res, c, m) {
  return res.status(c).json({ success: false, message: m });
}

async function ensureReceiptBucket() {
  if (!supabase) return;
  try {
    const b = await supabase.storage.getBucket(RECEIPT_BUCKET);
    if (!b.error) return;
    await supabase.storage.createBucket(RECEIPT_BUCKET, {
      public: false,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      fileSizeLimit: '10MB'
    }).catch(() => {});
  } catch {}
}

/**
 * Resolves or lazily creates a canonical customer row in public.customers
 */
async function resolveCanonicalCustomer(u, extra = {}) {
  if (!supabase || !u) return null;
  try {
    let row = null;
    if (u.kind === 'telegram') {
      const { data } = await supabase.from('customers').select('*').eq('telegram_id', u.telegram_id).maybeSingle();
      row = data;
    } else if (u.kind === 'auth') {
      const { data } = await supabase.from('customers').select('*').eq('auth_user_id', u.auth_user_id).maybeSingle();
      row = data;
    }

    const phone = String(extra.phone || (u.kind === 'auth' ? u.user.phone : '') || '').trim() || null;
    const email = String(extra.email || (u.kind === 'auth' ? u.user.email : '') || '').trim().toLowerCase() || null;

    if (!row && phone) {
      const { data } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
      if (data) row = data;
    }
    if (!row && email) {
      const { data } = await supabase.from('customers').select('*').eq('email', email).maybeSingle();
      if (data) row = data;
    }

    const tgUser = u.kind === 'telegram' ? (u.user || {}) : {};
    const auUser = u.kind === 'auth' ? (u.user || {}) : {};

    const fullName = String(
      extra.full_name ||
      row?.full_name ||
      auUser.user_metadata?.full_name ||
      auUser.user_metadata?.name ||
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
      ''
    ).trim() || null;

    const avatarUrl = String(
      extra.avatar_url ||
      row?.avatar_url ||
      auUser.user_metadata?.avatar_url ||
      tgUser.photo_url ||
      ''
    ).trim() || null;

    const authProvider = row?.auth_provider || (u.kind === 'telegram' ? 'telegram' : auUser.app_metadata?.provider || 'email');

    const payload = {
      telegram_id: u.kind === 'telegram' ? u.telegram_id : (row?.telegram_id || null),
      auth_user_id: u.kind === 'auth' ? u.auth_user_id : (row?.auth_user_id || null),
      email: email || row?.email || null,
      phone: phone || row?.phone || null,
      full_name: fullName,
      avatar_url: avatarUrl,
      auth_provider: authProvider,
      updated_at: new Date().toISOString()
    };

    if (row) {
      const { data: updated } = await supabase.from('customers').update(payload).eq('id', row.id).select().single();
      return updated || row;
    } else {
      const { data: inserted } = await supabase.from('customers').insert({ ...payload, created_at: new Date().toISOString() }).select().single();
      return inserted;
    }
  } catch (e) {
    console.error('[Canonical customer error]', e);
    return null;
  }
}

async function authConfig(_req, res) {
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return res.json({
    success: true,
    data: {
      supabase_url: URL_,
      supabase_anon_key: anonKey,
      google_enabled: String(process.env.SUPABASE_GOOGLE_ENABLED || 'true') === 'true',
      email_enabled: true,
      app_url: APP_URL
    }
  });
}

async function signUp(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();

  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return fail(res, 400, 'Email noto‘g‘ri yoki parol kamida 6 ta belgidan iborat bo‘lishi kerak.');
  }

  try {
    // 1. Try to create user with email_confirm: true via Supabase Admin API
    let createdUser = null;
    try {
      const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, phone }
      });
      if (!adminErr && adminData?.user) {
        createdUser = adminData.user;
      }
    } catch (_adminEx) {}

    // 2. If admin creation succeeded or already exists, obtain session token
    let r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    let data = await r.json().catch(() => null);

    // 3. Fallback to standard signup endpoint if token not obtained yet
    if (!r.ok && !createdUser) {
      const rSignup = await fetch(`${URL_}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: { full_name: name, phone } })
      });
      data = await rSignup.json().catch(() => null);
      if (!rSignup.ok) {
        return fail(res, 400, data?.msg || data?.error_description || 'Ro‘yxatdan o‘tishda xatolik.');
      }
    }

    const authUserId = data?.user?.id || createdUser?.id;
    if (authUserId) {
      await resolveCanonicalCustomer(
        { kind: 'auth', auth_user_id: authUserId, user: data?.user || createdUser },
        { email, full_name: name, phone }
      ).catch(() => {});
    }

    if (data?.access_token) {
      return res.status(201).json({
        success: true,
        message: 'Hisob muvaffaqiyatli yaratildi va tizimga kirildi.',
        data: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          user: data.user || createdUser
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Hisob muvaffaqiyatli yaratildi. Endi kirishingiz mumkin.',
      data: { user: data?.user || createdUser || null }
    });
  } catch (e) {
    return fail(res, 500, e.message || 'Ro‘yxatdan o‘tishda xatolik');
  }
}

async function signIn(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return fail(res, 400, 'Email va parolni kiriting.');

  try {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) return fail(res, 401, data?.msg || data?.error_description || 'Email yoki parol noto‘g‘ri.');

    if (data?.user?.id) {
      await resolveCanonicalCustomer({ kind: 'auth', auth_user_id: data.user.id, user: data.user }, { email }).catch(() => {});
    }

    return res.json({
      success: true,
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        user: data.user
      }
    });
  } catch (e) {
    return fail(res, 500, e.message || 'Kirishda xatolik');
  }
}

async function refresh(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  try {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: String(req.body?.refresh_token || '') })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) return fail(res, 401, data?.msg || 'Sessiya tugagan.');
    return res.json({
      success: true,
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        user: data.user
      }
    });
  } catch (e) {
    return fail(res, 500, e.message || 'Sessiyani yangilashda xatolik');
  }
}

async function google(req, res) {
  if (String(process.env.SUPABASE_GOOGLE_ENABLED || 'false') !== 'true') {
    return fail(res, 503, 'Google autentifikatsiya hali yoqilmagan.');
  }
  return res.redirect(`${URL_}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${APP_URL}/api/auth/google/callback`)}`);
}

async function googleCallback(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const code = String(req.query?.code || '');
  if (!code) return res.redirect(`${APP_URL}/#auth_error=google_callback_missing_code`);
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      return res.redirect(`${APP_URL}/#auth_error=${encodeURIComponent(error?.message || 'Google autentifikatsiya muvaffaqiyatsiz')}`);
    }
    if (data.session.user?.id) {
      await resolveCanonicalCustomer({ kind: 'auth', auth_user_id: data.session.user.id, user: data.session.user }).catch(() => {});
    }
    return res.redirect(
      `${APP_URL}/#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token || '')}&expires_in=${Number(data.session.expires_in || 3600)}`
    );
  } catch (e) {
    return res.redirect(`${APP_URL}/#auth_error=${encodeURIComponent(e.message || 'Google autentifikatsiya xatosi')}`);
  }
}

/**
 * Unified customer profile endpoint.
 * Returns the canonical profile row across Telegram, Web, and Mobile.
 */
async function profile(req, res) {
  const u = await customer(req);
  if (!u) return fail(res, 401, 'Mijoz autentifikatsiyasi talab qilinadi.');
  try {
    const canonical = await resolveCanonicalCustomer(u);
    if (canonical) {
      return res.json({
        success: true,
        data: {
          id: canonical.id,
          auth_user_id: canonical.auth_user_id,
          telegram_id: canonical.telegram_id,
          email: canonical.email,
          phone: canonical.phone,
          full_name: canonical.full_name,
          avatar_url: canonical.avatar_url,
          provider: canonical.auth_provider || (u.kind === 'telegram' ? 'telegram' : 'email'),
          created_at: canonical.created_at
        }
      });
    }

    if (u.kind === 'telegram') {
      return res.json({
        success: true,
        data: {
          id: `telegram:${u.telegram_id}`,
          telegram_id: u.telegram_id,
          provider: 'telegram',
          email: null,
          full_name: [u.user.first_name, u.user.last_name].filter(Boolean).join(' '),
          username: u.user.username || null,
          avatar_url: u.user.photo_url || null
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: u.auth_user_id,
        auth_user_id: u.auth_user_id,
        provider: u.user.app_metadata?.provider || 'email',
        email: u.user.email || null,
        full_name: u.user.user_metadata?.full_name || u.user.user_metadata?.name || '',
        phone: u.user.phone || null,
        avatar_url: u.user.user_metadata?.avatar_url || null
      }
    });
  } catch (e) {
    return fail(res, 500, 'Profilni yuklashda xatolik.');
  }
}

/**
 * Sync endpoint to unify Telegram ID, Auth User ID, Phone, Email, and Avatar
 */
async function syncCustomer(req, res) {
  const u = await customer(req);
  if (!u) return fail(res, 401, 'Mijoz autentifikatsiyasi talab qilinadi.');
  try {
    const canonical = await resolveCanonicalCustomer(u, req.body || {});
    return res.json({ success: true, data: canonical });
  } catch (e) {
    console.error('[Customer sync error]', e);
    return fail(res, 500, 'Profilni sinxronlashtirishda xatolik.');
  }
}

/**
 * Updates profile data in both Supabase Auth metadata and the canonical customers table.
 */
async function updateProfile(req, res) {
  if (!supabase) return fail(res, 503, 'Auth xizmati sozlanmagan.');
  const u = await customer(req);
  if (!u) return fail(res, 401, 'Mijoz sessiyasi talab qilinadi.');

  try {
    const fullName = String(req.body?.full_name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const avatarUrl = String(req.body?.avatar_url || '').trim();

    if (u.kind === 'auth') {
      const meta = { ...u.user.user_metadata };
      if (fullName) meta.full_name = fullName;
      if (phone) meta.phone = phone;
      if (avatarUrl) meta.avatar_url = avatarUrl;
      await supabase.auth.admin.updateUserById(u.auth_user_id, { user_metadata: meta }).catch(() => {});
    }

    const updatedCanonical = await resolveCanonicalCustomer(u, {
      full_name: fullName || undefined,
      phone: phone || undefined,
      avatar_url: avatarUrl || undefined
    });

    return res.json({ success: true, data: updatedCanonical });
  } catch (e) {
    console.error('[Profile update error]', e);
    return fail(res, 500, e.message || 'Profilni saqlashda xatolik');
  }
}

/**
 * Creates an order, linking both telegram_id and auth_user_id if known.
 * If receipt_url or base64 receipt is provided, immediately uploads to Supabase storage.
 */
async function createOrder(req, res) {
  const u = await customer(req);
  if (!u) return fail(res, 401, 'Buyurtma berish uchun Telegram yoki Google/Email orqali kiring.');
  const body = { ...(req.body || {}), status: '⏳ Buyurtma kutilmoqda' };
  delete body.created_at;
  if (!supabase) return fail(res, 503, 'Buyurtma xizmati sozlanmagan.');

  try {
    const { calculateOrder } = require('./orderSecurityPatch.js');
    const calculated = await calculateOrder(body);
    body.items = calculated.normalizedItems;
    body.subtotal = calculated.subtotal;
    body.delivery = calculated.delivery;
    body.discount = calculated.discount;
    body.cashback_used = calculated.cashback_used;
    body.total = calculated.total;
    body.promo_code = calculated.promo?.code || null;

    const canonical = await resolveCanonicalCustomer(u);
    const telegramId = u.kind === 'telegram' ? u.telegram_id : (canonical?.telegram_id || null);
    const authUserId = u.kind === 'auth' ? u.auth_user_id : (canonical?.auth_user_id || null);

    let order = null;
    try {
      const { data, error } = await supabase.rpc('create_secure_order', {
        p_order: body,
        p_telegram_id: telegramId ? Number(telegramId) : null
      });
      if (!error && data) order = Array.isArray(data) ? data[0] : data;
    } catch (_e) {}

    if (!order) {
      const orderNum = body.order_number || `GULI-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
      const safeInsert = {
        order_number: orderNum,
        telegram_id: telegramId ? Number(telegramId) : null,
        auth_user_id: authUserId || null,
        username: body.username || null,
        first_name: body.first_name || body.customer_name || 'Mijoz',
        phone: String(body.phone || '').trim() || '—',
        items: Array.isArray(body.items) ? body.items : [],
        subtotal: Number(body.subtotal || body.total || 0),
        delivery: Number(body.delivery || 0),
        discount: Number(body.discount || 0),
        total: Number(body.total || 0),
        address: body.address || null,
        payment: body.payment || 'card',
        status: body.status || "⏳ To'lovni tasdiqlash kutilmoqda",
        payment_status: body.payment_status || 'pending',
        promo_code: body.promo_code || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data: inserted, error: insErr } = await supabase.from('orders').insert(safeInsert).select().single();
      if (insErr) {
        console.error('Order fallback insert error:', insErr);
        throw insErr;
      }
      order = inserted;
    } else if (order?.id && authUserId && !order.auth_user_id) {
      await supabase.from('orders').update({
        auth_user_id: authUserId,
        updated_at: new Date().toISOString()
      }).eq('id', order.id).catch(() => {});
    }

    // Process receipt if attached directly in checkout payload
    const receiptRaw = body.receipt_url || body.receipt || body.data;
    if (receiptRaw && typeof receiptRaw === 'string' && order?.id) {
      try {
        await ensureReceiptBucket();
        let mime = 'image/jpeg';
        let b64 = receiptRaw;
        if (receiptRaw.startsWith('data:')) {
          const match = receiptRaw.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mime = match[1];
            b64 = match[2];
          }
        }
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 0 && buf.length <= 10 * 1024 * 1024) {
          const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
          const path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
          const { error: upErr } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, buf, { contentType: mime, upsert: false });
          if (!upErr) {
            const { data: updatedOrder } = await supabase.from('orders').update({
              payment_receipt_path: path,
              payment_status: 'receipt_uploaded',
              payment_receipt_uploaded_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', order.id).select().single();
            if (updatedOrder) order = updatedOrder;
          }
        }
      } catch (receiptErr) {
        console.warn('[Checkout receipt upload non-fatal error]', receiptErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Buyurtma muvaffaqiyatli saqlandi',
      data: order
    });
  } catch (e) {
    console.error('[Unified checkout error]', e);
    return fail(res, 400, e.message || 'Buyurtmani saqlashda xatolik');
  }
}

/**
 * Lists orders belonging to the customer, querying by telegram_id and/or auth_user_id.
 */
async function listOrders(req, res) {
  const u = await customer(req);
  const orderNumsQuery = String(req.query.order_numbers || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const phoneQuery = String(req.query.phone || req.headers['x-customer-phone'] || '').replace(/\D/g, '');
  const tgQuery = String(req.query.telegram_id || req.headers['x-telegram-id'] || '').trim();

  try {
    const canonical = u ? await resolveCanonicalCustomer(u) : null;
    const tgId = u?.kind === 'telegram' ? u.telegram_id : (canonical?.telegram_id || (tgQuery && /^\d+$/.test(tgQuery) ? Number(tgQuery) : null));
    const authId = u?.kind === 'auth' ? u.auth_user_id : (canonical?.auth_user_id || null);
    const phone = canonical?.phone || u?.user?.phone || null;

    let q = supabase
      .from('orders')
      .select('id,order_number,first_name,last_name,customer_name,phone,items,subtotal,delivery,discount,total,address,payment,payment_status,payment_receipt_path,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const orConditions = [];
    if (tgId) orConditions.push(`telegram_id.eq.${tgId}`);
    if (authId) orConditions.push(`auth_user_id.eq.${authId}`);
    if (phone && String(phone).replace(/\D/g, '').length >= 7) {
      const cleanP = String(phone).replace(/\D/g, '').slice(-7);
      orConditions.push(`phone.ilike.%${cleanP}%`);
    }
    if (phoneQuery && phoneQuery.length >= 7) {
      const last7 = phoneQuery.slice(-7);
      const last9 = phoneQuery.slice(-9);
      orConditions.push(`phone.ilike.%${last7}%`);
      if (last9 !== last7) {
        orConditions.push(`phone.ilike.%${last9}%`);
      }
    }
    if (orderNumsQuery.length) {
      for (const num of orderNumsQuery.slice(0, 30)) {
        orConditions.push(`order_number.eq.${num}`);
      }
    }

    if (orConditions.length > 0) {
      q = q.or(orConditions.join(','));
    } else {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await q;
    if (error) throw error;

    const formatted = await Promise.all(
      (data || []).map(async (row) => {
        let receiptUrl = '';
        if (row.payment_receipt_path) {
          try {
            const { data: sData } = await supabase.storage
              .from(RECEIPT_BUCKET)
              .createSignedUrl(String(row.payment_receipt_path).replace(/^\/+/, ''), 86400);
            receiptUrl = sData?.signedUrl || '';
          } catch {}
        }
        return {
          ...row,
          receipt_url: receiptUrl || undefined
        };
      })
    );

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: formatted });
  } catch (e) {
    console.error('[List orders error]', e);
    return fail(res, 500, 'Buyurtmalarni yuklashda xatolik.');
  }
}

/**
 * Handles receipt upload from both Telegram Mini App and Web Browser.
 * Supports card orders, accepts order number or ID, handles base64 data URLs.
 */
async function uploadReceipt(req, res) {
  const u = await customer(req);
  if (!u) return fail(res, 401, 'Mijoz autentifikatsiyasi talab qilinadi.');
  try {
    const number = String(req.params.orderNumber || '').trim();
    let q = supabase
      .from('orders')
      .select('id,order_number,total,telegram_id,auth_user_id,payment,payment_status,payment_receipt_path');

    if (/^\d+$/.test(number)) {
      q = q.or(`id.eq.${number},order_number.eq.${number}`);
    } else {
      q = q.eq('order_number', number);
    }

    const { data: order, error } = await q.maybeSingle();
    if (error) throw error;
    if (!order) return fail(res, 404, 'Buyurtma topilmadi');

    // Check ownership
    const canonical = await resolveCanonicalCustomer(u);
    const tgId = u.kind === 'telegram' ? u.telegram_id : (canonical?.telegram_id || null);
    const authId = u.kind === 'auth' ? u.auth_user_id : (canonical?.auth_user_id || null);

    const owns = (tgId && String(order.telegram_id) === String(tgId)) ||
                 (authId && String(order.auth_user_id) === String(authId));
    if (!owns) {
      return fail(res, 403, 'Ushbu buyurtmaga kirish huquqi mavjud emas.');
    }

    // Card payment validation (generous check for card, card_manual, Karta (Uzcard / Humo), etc.)
    const isCard = ['card_manual', 'card', 'Karta (Uzcard / Humo)'].includes(String(order.payment || '')) ||
                   /karta|card/i.test(String(order.payment || ''));
    if (!isCard) {
      return fail(res, 400, 'Bu buyurtma karta to‘lovi uchun yaratilmagan');
    }

    let raw = String(req.body?.data || req.body?.receipt_url || req.body?.receipt || '');
    let mime = String(req.body?.mimeType || '');

    if (raw.startsWith('data:')) {
      const match = raw.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mime = mime || match[1];
        raw = match[2];
      }
    }

    if (!raw) return fail(res, 400, 'Chek topilmadi');
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length || buf.length > 10 * 1024 * 1024) {
      return fail(res, 400, 'Chek hajmi 10 MB dan oshmasligi kerak');
    }

    const h = buf.subarray(0, 12);
    const ok = (mime === 'image/jpeg' && h[0] === 255 && h[1] === 216 && h[2] === 255) ||
               (mime === 'image/png' && h.toString('hex', 0, 8) === '89504e470d0a1a0a') ||
               (mime === 'image/webp' && h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') ||
               (mime === 'application/pdf' && h.toString('ascii', 0, 5) === '%PDF-') ||
               (h[0] === 255 && h[1] === 216 && h[2] === 255) || // JPEG magic bytes fallback
               (h.toString('hex', 0, 8) === '89504e470d0a1a0a'); // PNG magic bytes fallback

    if (!ok && mime) return fail(res, 400, 'Chek formati noto‘g‘ri');

    await ensureReceiptBucket();
    const cleanExt = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${cleanExt}`;

    const { error: up } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, buf, { contentType: mime || 'image/jpeg', upsert: false });
    if (up) throw up;

    const { data: updated, error: ue } = await supabase.from('orders').update({
      payment_receipt_path: path,
      payment_status: 'receipt_uploaded',
      payment_receipt_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', order.id).select('id,order_number,total,payment_status,payment_receipt_path').single();

    if (ue) {
      await supabase.storage.from(RECEIPT_BUCKET).remove([path]).catch(() => {});
      throw ue;
    }

    return res.json({
      success: true,
      message: 'Chek muvaffaqiyatli saqlandi. Admin tekshiradi.',
      data: updated
    });
  } catch (e) {
    console.error('[Unified receipt upload error]', e);
    return fail(res, 500, 'Chekni yuborishda xatolik');
  }
}

// Register authentication routes
install('get', '/api/auth/config', authConfig);
install('post', '/api/auth/signup', signUp);
install('post', '/api/auth/signin', signIn);
install('post', '/api/auth/password/login', signIn);
install('post', '/api/auth/password/signup', signUp);
install('post', '/api/auth/refresh', refresh);
install('get', '/api/auth/google', google);
install('get', '/api/auth/google/callback', googleCallback);

// Register unified customer profile & sync routes
install('get', '/api/customer/profile', profile);
install('put', '/api/customer/profile', updateProfile);
install('post', '/api/customer/sync', syncCustomer);

// Register unified order & receipt routes
install('post', '/api/customer/orders', createOrder);
install('get', '/api/customer/orders', listOrders);
install('post', '/api/customer/orders/:orderNumber/receipt', uploadReceipt);
install('post', '/api/orders/:orderNumber/receipt', uploadReceipt);

console.log('[GULI Identity & Payment] Unified customer bridge and payment runtime loaded.');
