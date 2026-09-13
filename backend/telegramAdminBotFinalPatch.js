// GULI ADMIN TELEGRAM BOT — single durable order message + online chat alerts.
// One order => one admin message per admin chat. Receipt/status/payment changes edit that message in place.
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const ADMIN_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || '').trim();
const CUSTOMER_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const state = globalThis.__GULI_ADMIN_BOT_FINAL_STATE__ || { started: false, offset: 0, signatures: new Map(), chats: new Set() };
globalThis.__GULI_ADMIN_BOT_FINAL_STATE__ = state;

async function tg(method, body, token = ADMIN_TOKEN) {
  if (!token) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}

async function adminIds() {
  const ids = new Set(explicitIds());
  if (db) {
    const { data } = await db.from('telegram_admin_bot_chats').select('chat_id').eq('active', true);
    for (const x of data || []) ids.add(String(x.chat_id));
  }
  return [...ids];
}

function money(v) { return `${Math.round(Number(v || 0)).toLocaleString('uz-UZ')} so‘m`; }
function customerName(o) { return o?.customer_name || [o?.first_name, o?.last_name].filter(Boolean).join(' ') || o?.username || 'Mijoz'; }
function payment(o) { const p = String(o?.payment || '').toLowerCase(); return p === 'card_manual' ? '💳 Karta o‘tkazmasi' : p === 'click' ? '📲 Click' : p === 'payme' ? '📱 Payme' : o?.payment || '—'; }
function paymentStatus(o) { const p = String(o?.payment_status || 'pending').toLowerCase(); return p === 'verified' ? '✅ Tasdiqlangan' : p === 'rejected' ? '❌ Rad etilgan' : p === 'receipt_uploaded' ? '🧾 Chek yuklangan — tekshiruv kutilmoqda' : '⏳ Kutilmoqda'; }
function productName(x) { return x?.name || x?.title || x?.product_name || x?.product?.name || 'Mahsulot'; }
function itemLines(o) { return (Array.isArray(o?.items) ? o.items : []).slice(0, 20).map((x, i) => `${i + 1}. ${productName(x)} × ${Number(x?.quantity || x?.qty || 1)}${x?.price != null ? ` — ${money(x.price)}` : ''}`); }
function caption(o, title = '🛒 YANGI ORDER') {
  const lines = itemLines(o);
  return `${title}\n\n🛒 №: ${o?.order_number || o?.id || '—'}\n👤 Mijoz: ${customerName(o)}\n📞 Telefon: ${o?.phone || '—'}\n💰 Jami: ${money(o?.total)}\n💳 To‘lov: ${payment(o)}\n🔎 To‘lov holati: ${paymentStatus(o)}\n📦 Status: ${o?.status || '⏳ Buyurtma kutilmoqda'}\n📍 Manzil: ${typeof o?.address === 'string' ? o.address : 'Buyurtmada mavjud'}${lines.length ? `\n\n${lines.join('\n')}` : ''}`.slice(0, 1024);
}
function keyboard(o) {
  const p = String(o?.payment || '').toLowerCase();
  const s = String(o?.payment_status || 'pending').toLowerCase();
  if (p !== 'card_manual' || !['pending', 'receipt_uploaded'].includes(s) || !o?.id) return { inline_keyboard: [] };
  return { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `guli_pay:verified:${o.id}` }, { text: '❌ Rad etish', callback_data: `guli_pay:rejected:${o.id}` }]] };
}
function imageUrl(item) {
  const product = item?.product || item?.product_data || item?.productDetails || {};
  const xs = [item?.image, item?.image_url, item?.photo, ...(Array.isArray(item?.images) ? item.images : []), product?.image, product?.image_url, product?.photo, ...(Array.isArray(product?.images) ? product.images : [])];
  return xs.map(v => String(v || '').trim()).find(v => /^https?:\/\//i.test(v)) || '';
}
async function receiptUrl(o) {
  const path = String(o?.payment_receipt_path || '').replace(/^\/+/, '');
  if (!path || !db || /\.pdf$/i.test(path)) return '';
  const { data } = await db.storage.from('payment-receipts').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}
async function getImage(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok || !String(r.headers.get('content-type') || '').toLowerCase().startsWith('image/')) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length ? b : null;
  } catch { return null; }
}
async function compose(o) {
  const urls = [], seen = new Set();
  for (const item of Array.isArray(o?.items) ? o.items : []) {
    const u = imageUrl(item); if (u && !seen.has(u)) { seen.add(u); urls.push(u); }
    if (urls.length >= 8) break;
  }
  const receipt = await receiptUrl(o);
  if (receipt && !seen.has(receipt)) urls.push(receipt);
  const buffers = [];
  for (const u of urls.slice(0, 9)) { const b = await getImage(u); if (b) buffers.push(b); }
  if (!buffers.length) return null;
  const size = 560, cols = buffers.length === 1 ? 1 : 2, rows = Math.ceil(buffers.length / cols), layers = [];
  for (let i = 0; i < buffers.length; i++) {
    const b = await sharp(buffers[i]).rotate().resize(size, size, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    layers.push({ input: b, left: (i % cols) * size, top: Math.floor(i / cols) * size });
  }
  return sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(layers).jpeg({ quality: 88 }).toBuffer();
}
async function sendOrder(chatId, o, title) {
  const image = await compose(o);
  const cap = caption(o, title);
  if (!image) return tg('sendMessage', { chat_id: chatId, text: cap, disable_web_page_preview: true, reply_markup: keyboard(o) });
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', cap);
  form.append('reply_markup', JSON.stringify(keyboard(o)));
  form.append('photo', new Blob([image], { type: 'image/jpeg' }), 'guli-order.jpg');
  const r = await fetch(`https://api.telegram.org/bot${ADMIN_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}
async function editOrder(chatId, messageId, o, title) {
  const image = await compose(o);
  const cap = caption(o, title);
  if (!image) return tg('editMessageText', { chat_id: chatId, message_id: messageId, text: cap, disable_web_page_preview: true, reply_markup: keyboard(o) });
  const form = new FormData();
  form.append('chat_id', String(chatId)); form.append('message_id', String(messageId));
  form.append('media', JSON.stringify({ type: 'photo', media: 'attach://order.jpg', caption: cap }));
  form.append('reply_markup', JSON.stringify(keyboard(o)));
  form.append('photo', new Blob([image], { type: 'image/jpeg' }), 'order.jpg');
  const r = await fetch(`https://api.telegram.org/bot${ADMIN_TOKEN}/editMessageMedia`, { method: 'POST', body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}
async function findMessage(orderId, chatId) {
  const { data } = await db.from('telegram_admin_bot_order_messages').select('message_id').eq('order_id', orderId).eq('chat_id', Number(chatId)).maybeSingle();
  return data?.message_id ? Number(data.message_id) : null;
}
async function saveMessage(orderId, chatId, messageId) {
  if (!messageId) return;
  await db.from('telegram_admin_bot_order_messages').upsert({ order_id: orderId, chat_id: Number(chatId), message_id: Number(messageId), updated_at: new Date().toISOString() }, { onConflict: 'order_id,chat_id' });
}
async function claim(key, type, orderId) {
  const { error } = await db.from('telegram_admin_bot_events').insert({ event_key: key, event_type: type, order_id: orderId || null });
  return !error || String(error.code) === '23505';
}
async function createMessageOnce(chatId, o, title) {
  const existing = await findMessage(o.id, chatId);
  if (existing) return existing;
  const lock = `admin-message:${o.id}:${chatId}`;
  const { error } = await db.from('telegram_admin_bot_events').insert({ event_key: lock, event_type: 'admin_order_message', order_id: o.id });
  if (error) {
    if (String(error.code) === '23505') return await findMessage(o.id, chatId);
    throw error;
  }
  try {
    const sent = await sendOrder(chatId, o, title);
    await saveMessage(o.id, chatId, sent?.message_id);
    return sent?.message_id || null;
  } catch (e) {
    await db.from('telegram_admin_bot_events').delete().eq('event_key', lock).catch(() => {});
    throw e;
  }
}
function signature(o) { return JSON.stringify({ status: o?.status || '', payment_status: o?.payment_status || '', receipt: o?.payment_receipt_path || '' }); }
function recentOrder(o) { const t = Date.parse(o?.created_at || ''); return Number.isFinite(t) && Date.now() - t < 20 * 60 * 1000; }

async function customerPaymentNotice(o, decision) {
  const id = Number(o?.telegram_id || 0); if (!id || !CUSTOMER_TOKEN) return;
  const text = decision === 'verified'
    ? `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${o.order_number}\nSumma: ${money(o.total)}\n\nBuyurtma holati: ${o.status || 'Qabul qilindi'}`
    : `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${o.order_number}\nIltimos, to‘lov chekini qayta yuboring.`;
  await tg('sendMessage', { chat_id: id, text, disable_web_page_preview: true }, CUSTOMER_TOKEN);
}

async function callback(c) {
  const chatId = Number(c?.message?.chat?.id || 0), fromId = Number(c?.from?.id || 0), data = String(c?.data || '');
  if (!chatId || !fromId || !data.startsWith('guli_pay:')) return;
  const ids = await adminIds();
  if (!ids.includes(String(chatId)) || chatId !== fromId) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: '⛔ Ruxsat yo‘q', show_alert: true }); return; }
  const [, decision, orderId] = data.split(':');
  if (!orderId || !['verified', 'rejected'].includes(decision)) return;
  try {
    const { data: current, error: ce } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (ce || !current) throw new Error('Buyurtma topilmadi');
    const ps = String(current.payment_status || 'pending').toLowerCase();
    if (!['pending', 'receipt_uploaded'].includes(ps)) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'To‘lov bo‘yicha qaror allaqachon qabul qilingan' }); return; }
    const { error } = await db.rpc('admin_payment_decision', { p_order_id: orderId, p_payment_status: decision });
    if (error) throw error;
    const { data: o, error: oe } = await db.from('orders').select('*').eq('id', orderId).single();
    if (oe) throw oe;
    await saveMessage(o.id, chatId, c.message.message_id);
    await editOrder(chatId, c.message.message_id, o, decision === 'verified' ? '💳 TO‘LOV TASDIQLANDI' : '💳 TO‘LOV RAD ETILDI');
    await tg('answerCallbackQuery', { callback_query_id: c.id, text: decision === 'verified' ? '✅ To‘lov tasdiqlandi' : '❌ To‘lov rad etildi' });
    const noticeKey = `customer-payment:${o.id}:${decision}`;
    if (await claim(noticeKey, 'customer_payment_notice', o.id)) await customerPaymentNotice(o, decision).catch(() => {});
  } catch (e) {
    await tg('answerCallbackQuery', { callback_query_id: c.id, text: `Xatolik: ${String(e.message).slice(0, 160)}`, show_alert: true }).catch(() => {});
  }
}

async function updates() {
  const xs = await tg('getUpdates', { offset: state.offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  for (const u of xs || []) {
    state.offset = Math.max(state.offset, Number(u.update_id || 0) + 1);
    if (u.callback_query) { await callback(u.callback_query); continue; }
    const m = u.message, chat = m?.chat;
    if (chat?.type !== 'private' || !chat?.id || !/^\/start(?:@\w+)?(?:\s|$)/i.test(String(m.text || '').trim())) continue;
    await db.from('telegram_admin_bot_chats').upsert({ chat_id: Number(chat.id), username: chat.username || null, first_name: chat.first_name || null, last_name: chat.last_name || null, active: true, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });
    await tg('sendMessage', { chat_id: chat.id, text: `👤 GULI ADMIN MA‘LUMOTI\n\nIsm: ${[chat.first_name, chat.last_name].filter(Boolean).join(' ') || 'Noma‘lum'}\nUsername: ${chat.username ? `@${chat.username}` : 'mavjud emas'}\nTelegram ID: ${chat.id}\nChat ID: ${chat.id}\nHolat: ✅ Admin botga ulangan` });
  }
}

async function orders() {
  const ids = await adminIds(); if (!ids.length) return;
  const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  for (const o of data || []) {
    const id = String(o.id), sig = signature(o), prev = state.signatures.get(id);
    state.signatures.set(id, sig);
    for (const chatId of ids) {
      const mid = await findMessage(o.id, chatId);
      if (!mid) {
        if (recentOrder(o)) await createMessageOnce(chatId, o, String(o.payment_status || '').toLowerCase() === 'receipt_uploaded' ? '🧾 CHEK YUKLANDI' : '🛒 YANGI ORDER');
        continue;
      }
      if (prev !== undefined && prev !== sig) {
        const title = String(o.payment_status || '').toLowerCase() === 'verified' ? '💳 TO‘LOV TASDIQLANDI' : String(o.payment_status || '').toLowerCase() === 'rejected' ? '💳 TO‘LOV RAD ETILDI' : String(o.payment_status || '').toLowerCase() === 'receipt_uploaded' ? '🧾 CHEK YUKLANDI' : '📦 ORDER STATUS O‘ZGARDI';
        try { await editOrder(chatId, mid, o, title); } catch (e) { if (!/message is not modified/i.test(String(e.message))) console.warn('[Admin bot edit]', e.message); }
      }
    }
  }
}

async function chats() {
  const ids = await adminIds(); if (!ids.length) return;
  const { data, error } = await db.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return;
  for (const m of (data || []).reverse()) {
    if (String(m.sender || '').toLowerCase() === 'admin') continue;
    for (const chatId of ids) {
      const key = `chat:${m.id}:${chatId}`;
      if (!(await claim(key, 'online_chat', null))) continue;
      const meta = m.metadata || {};
      const who = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || meta.telegram_username || (m.telegram_id ? `Telegram ${m.telegram_id}` : 'Mijoz');
      const text = `💬 ONLINE CHAT\n\n👤 Mijoz: ${who}\n🆔 Telegram: ${m.telegram_id || '—'}\n\n${String(m.text || '📎 Media xabar')}`.slice(0, 4096);
      await tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true }).catch(() => {});
    }
  }
}

async function loop() { await updates().catch(() => {}); await orders().catch(e => console.warn('[Admin bot orders]', e.message)); await chats().catch(() => {}); }
if (ADMIN_TOKEN && db && !state.started) {
  state.started = true;
  setTimeout(() => void loop(), 1200);
  setInterval(() => void loop(), 3000);
  console.log('[GULI Admin bot] FINAL single-message order + online-chat bridge enabled.');
}
