// GULI ADMIN TELEGRAM BOT - EXACT 1 MESSAGE PER ORDER
// Strictly satisfies: 1 order = exactly 1 Telegram message.
// All subsequent updates (status change, receipt upload, verification/rejection)
// edit the SAME message in-place.
const { createClient } = require('@supabase/supabase-js');

const ADMIN_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || '').trim();
const CUSTOMER_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const URL = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const db = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const state = globalThis.__GULI_ADMIN_BOT_SINGLE_MSG__ || { started: false, offset: 0, signatures: new Map(), running: false };
globalThis.__GULI_ADMIN_BOT_SINGLE_MSG__ = state;

async function tg(method, body, token = ADMIN_TOKEN) {
  if (!token) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) {
    throw new Error(j?.description || `Telegram ${r.status}`);
  }
  return j.result;
}

async function adminIds() {
  const s = new Set(explicitIds());
  if (db) {
    const { data } = await db.from('telegram_admin_bot_chats').select('chat_id').eq('active', true);
    for (const x of data || []) s.add(String(x.chat_id));
  }
  return [...s];
}

const money = v => `${Math.round(Number(v || 0)).toLocaleString('uz-UZ')} so‘m`;
const customerName = o => o?.customer_name || [o?.first_name, o?.last_name].filter(Boolean).join(' ') || o?.username || 'Mijoz';

function paymentMethodLabel(o) {
  const p = String(o?.payment || '').toLowerCase();
  if (['card_manual', 'card_manual_transfer', 'uzcard_humo', 'card'].includes(p)) return '💳 Karta (Uzcard / Humo)';
  if (p === 'click') return '📲 Click';
  if (p === 'payme') return '📱 Payme';
  return o?.payment || '—';
}

function payStatusLabel(o) {
  const p = String(o?.payment_status || 'pending').toLowerCase();
  if (p === 'verified') return '✅ To‘lov tasdiqlangan';
  if (p === 'rejected') return '❌ Chek rad etilgan';
  if (p === 'receipt_uploaded' || o?.payment_receipt_path) return '🧾 Chek yuklangan — tekshirish kutilmoqda';
  return '⏳ To‘lov/Chek kutilmoqda';
}

function formatAddress(addr) {
  if (!addr) return '—';
  if (typeof addr === 'string') return addr;
  const parts = [
    addr.region && `Viloyat: ${addr.region}`,
    addr.district && `Tuman: ${addr.district}`,
    addr.street && `Manzil: ${addr.street}`,
    addr.house && `Uy: ${addr.house}`,
    addr.apartment && `Xonadon: ${addr.apartment}`,
    addr.landmark && `Mo‘ljal: ${addr.landmark}`
  ].filter(Boolean);
  return parts.join(', ') || 'Ko‘rsatilmagan';
}

function itemLines(o) {
  const items = Array.isArray(o?.items) ? o.items : [];
  return items.slice(0, 15).map((x, i) => {
    const p = x?.product || x?.product_data || x?.productDetails || x || {};
    const name = p?.name || p?.title || x?.name || 'Mahsulot';
    const code = p?.product_code || x?.product_code || '';
    const size = x?.size ? ` [${x.size}]` : '';
    const color = x?.color ? ` (${x.color})` : '';
    const qty = Number(x?.quantity || x?.qty || 1);
    const pr = Number(p?.price || x?.price || 0);
    return `${i + 1}. ${name}${code ? ` #${code}` : ''}${size}${color} × ${qty} dona${pr ? ` — ${money(pr * qty)}` : ''}`;
  });
}

function buildMessageText(o, title = '🛒 YANGI BUYURTMA') {
  const lines = itemLines(o);
  const itemsCount = (Array.isArray(o?.items) ? o.items : []).length;
  const hasReceipt = Boolean(o?.payment_receipt_path || o?.payment_status === 'receipt_uploaded');

  const parts = [
    `<b>${title}</b>`,
    '',
    `🛒 <b>№:</b> <code>${o?.order_number || o?.id || '—'}</code>`,
    `👤 <b>Mijoz:</b> ${customerName(o)}${o?.username ? ` (@${o.username.replace(/^@/, '')})` : ''}`,
    `📞 <b>Telefon:</b> ${o?.phone || '—'}`,
    `📍 <b>Manzil:</b> ${formatAddress(o?.address)}`,
    '',
    `👗 <b>Mahsulotlar (${itemsCount} ta):</b>`,
    lines.join('\n') || '• Ma’lumot ko‘rsatilmagan',
    '',
    `💰 <b>Jami summa:</b> ${money(o?.total)}`,
    `💳 <b>To‘lov usuli:</b> ${paymentMethodLabel(o)}`,
    `🔎 <b>To‘lov holati:</b> ${payStatusLabel(o)}`,
    `📦 <b>Buyurtma statusi:</b> <b>${o?.status || '⏳ Kutilmoqda'}</b>`
  ];

  if (hasReceipt) {
    parts.push(`🧾 <b>To‘lov cheki:</b> Yuklangan ✓ (Admin panelda mavjud)`);
  }

  if (o?.updated_at) {
    const d = new Date(o.updated_at);
    parts.push(`🕒 <i>Yangilandi: ${d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</i>`);
  }

  return parts.join('\n').slice(0, 4000);
}

function adminKeyboard(o) {
  const p = String(o?.payment || '').toLowerCase();
  const s = String(o?.payment_status || 'pending').toLowerCase();
  const isCard = ['card_manual', 'card_manual_transfer', 'uzcard_humo', 'card'].includes(p);
  const isPending = ['pending', 'receipt_uploaded'].includes(s);

  if (!o?.id) return { inline_keyboard: [] };

  if (isCard && isPending) {
    return {
      inline_keyboard: [
        [
          { text: '✅ To‘lovni tasdiqlash', callback_data: `guli_pay:verified:${o.id}` },
          { text: '❌ Chekni rad etish', callback_data: `guli_pay:rejected:${o.id}` }
        ]
      ]
    };
  }

  return { inline_keyboard: [] };
}

function getAllOrderImages(o) {
  const items = Array.isArray(o?.items) ? o.items : [];
  const list = [];
  for (const it of items) {
    const p = it?.product || it?.product_data || it?.productDetails || {};
    const candidates = [
      it?.image,
      it?.image_url,
      it?.photo,
      p?.image,
      p?.image_url,
      p?.photo,
      ...(Array.isArray(p?.images) ? p.images : [])
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) {
        const clean = c.trim();
        if (!list.includes(clean)) {
          list.push(clean);
          break; // 1 distinct photo per item
        }
      }
    }
  }
  return list;
}

async function getOrderReceiptUrl(o) {
  if (o?.receipt_url && /^https?:\/\//i.test(o.receipt_url)) return o.receipt_url.trim();
  if (o?.receipt && /^https?:\/\//i.test(o.receipt)) return o.receipt.trim();
  if (o?.payment_receipt_path && db) {
    try {
      const cleanPath = String(o.payment_receipt_path).replace(/^\/+/, '');
      const { data, error } = await db.storage.from('payment-receipts').createSignedUrl(cleanPath, 86400 * 7);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch (e) {
      console.warn('[Admin bot] Signed receipt error:', e.message);
    }
  }
  return null;
}

function getFirstProductImage(o) {
  const all = getAllOrderImages(o);
  return all.length > 0 ? all[0] : '';
}

async function findAdminMessage(orderId, chatId) {
  if (!db) return null;
  const { data } = await db
    .from('telegram_admin_bot_order_messages')
    .select('message_id')
    .eq('order_id', String(orderId))
    .eq('chat_id', Number(chatId))
    .maybeSingle();
  return data?.message_id ? Number(data.message_id) : null;
}

async function saveAdminMessage(orderId, chatId, messageId) {
  if (!db || !messageId) return;
  await db.from('telegram_admin_bot_order_messages').upsert(
    {
      order_id: String(orderId),
      chat_id: Number(chatId),
      message_id: Number(messageId),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'order_id,chat_id' }
  );
}

// In-place edit for the SINGLE message (works for photo caption or text)
async function editSingleMessage(chatId, messageId, o, title) {
  const text = buildMessageText(o, title);
  const kb = adminKeyboard(o);

  // Try editing caption first (if it was sent as photo)
  try {
    return await tg('editMessageCaption', {
      chat_id: chatId,
      message_id: messageId,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: kb
    });
  } catch (e1) {
    if (/message is not modified/i.test(e1.message)) return null;
    // Fallback to editing text (if it was sent as message)
    try {
      return await tg('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: kb
      });
    } catch (e2) {
      if (/message is not modified/i.test(e2.message)) return null;
      console.warn(`[Admin bot] Edit failed for order ${o.order_number}:`, e2.message);
      return null;
    }
  }
}

// Send the INITIAL message with all product images and payment receipt
async function sendInitialMessage(chatId, o, title) {
  const text = buildMessageText(o, title);
  const kb = adminKeyboard(o);
  const productImages = getAllOrderImages(o);
  const receiptUrl = await getOrderReceiptUrl(o);

  // Combine media: products + payment receipt
  const mediaUrls = [...productImages];
  if (receiptUrl && !mediaUrls.includes(receiptUrl)) {
    mediaUrls.push(receiptUrl);
  }

  let sent = null;

  if (mediaUrls.length > 1) {
    // Send full album of all product images and payment receipt
    try {
      const mediaGroup = mediaUrls.slice(0, 10).map((url, idx) => {
        const isReceipt = url === receiptUrl;
        const caption = isReceipt
          ? `🧾 <b>TO‘LOV CHEKI — Buyurtma № ${o.order_number || o.id}</b>`
          : idx === 0
          ? `🛍️ <b>Buyurtma № ${o.order_number || o.id}</b> (${productImages.length} ta mahsulot)`
          : undefined;
        return {
          type: 'photo',
          media: url,
          caption,
          parse_mode: 'HTML'
        };
      });

      await tg('sendMediaGroup', {
        chat_id: chatId,
        media: mediaGroup
      });
    } catch (albumErr) {
      console.warn('[Admin bot] sendMediaGroup error, sending individual photo:', albumErr.message);
    }

    // Interactive card with action buttons (Tasdiqlash / Rad etish)
    try {
      sent = await tg('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: kb
      });
    } catch (msgErr) {
      console.warn('[Admin bot] sendMessage error:', msgErr.message);
    }
  } else if (mediaUrls.length === 1) {
    try {
      sent = await tg('sendPhoto', {
        chat_id: chatId,
        photo: mediaUrls[0],
        caption: text,
        parse_mode: 'HTML',
        reply_markup: kb
      });
    } catch (_e) {
      sent = null;
    }
  }

  if (!sent) {
    sent = await tg('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: kb
    });
  }

  const mid = sent?.message_id ? Number(sent.message_id) : null;
  if (mid) {
    await saveAdminMessage(o.id, chatId, mid);
  }
  return mid;
}

// Customer bot: update the customer's SINGLE message in-place
async function updateCustomerOrderMessageInPlace(order) {
  if (!CUSTOMER_TOKEN || !order || !order.telegram_id || !order.telegram_status_message_id) return;
  const chatId = Number(order.telegram_id);
  const messageId = Number(order.telegram_status_message_id);
  if (!chatId || !messageId) return;

  const items = Array.isArray(order?.items) ? order.items : [];
  const lines = items.slice(0, 15).map((x, i) => {
    const p = x?.product || x?.product_data || x || {};
    const name = p?.name || p?.title || x?.name || 'Mahsulot';
    const code = p?.product_code || x?.product_code || '';
    const size = x?.size ? ` [${x.size}]` : '';
    const color = x?.color ? ` (${x.color})` : '';
    const qty = Number(x?.quantity || x?.qty || 1);
    return `• ${name}${code ? ` #${code}` : ''}${size}${color} × ${qty} dona`;
  });

  const payStatus =
    order.payment_status === 'verified'
      ? '✅ To‘lov tasdiqlandi ✓'
      : order.payment_status === 'rejected'
      ? '❌ Chek rad etildi — iltimos qayta yuboring'
      : order.payment_receipt_path
      ? '🧾 Chek qabul qilindi — tekshirilmoqda'
      : '⏳ To‘lov kutilmoqda';

  const text = [
    `🛍 <b>GULI Lingerie — BUYURTMA</b>`,
    `№ <b>${order.order_number || order.id}</b>`,
    '',
    `<b>Sotib olingan mahsulotlar:</b>`,
    lines.join('\n') || '• Mahsulot ma’lumotlari mavjud emas',
    '',
    `💰 <b>Jami summa:</b> ${money(order.total)}`,
    `📌 <b>Buyurtma holati:</b> ${String(order.status || 'Qabul qilindi')}`,
    `💳 <b>To‘lov:</b> ${payStatus}`,
    '',
    `<i>Status o‘zgarganda ushbu xabar avtomatik yangilanadi.</i>`
  ].join('\n');

  try {
    await tg('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }, CUSTOMER_TOKEN);
  } catch (e) {
    if (!/message is not modified/i.test(e.message)) {
      console.warn('[Customer bot] edit in place error:', e.message);
    }
  }
}

function orderSig(o) {
  return JSON.stringify({
    status: o?.status || '',
    payment_status: o?.payment_status || '',
    receipt: o?.payment_receipt_path || '',
    updated: o?.updated_at || ''
  });
}

function isOrderRecent(o) {
  const t = Date.parse(o?.created_at || '');
  return Number.isFinite(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

async function handleCallback(c) {
  const chatId = Number(c?.message?.chat?.id || 0);
  const fromId = Number(c?.from?.id || 0);
  const data = String(c?.data || '');
  if (!chatId || chatId !== fromId || !data.startsWith('guli_pay:')) return;

  const ids = await adminIds();
  if (!ids.includes(String(chatId))) {
    await tg('answerCallbackQuery', { callback_query_id: c.id, text: '⛔ Ruxsat yo‘q', show_alert: true }).catch(() => {});
    return;
  }

  const [, decision, orderId] = data.split(':');
  if (!orderId || !['verified', 'rejected'].includes(decision)) return;

  try {
    const { data: o0, error: e0 } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (e0 || !o0) throw new Error('Buyurtma topilmadi');

    const ps = String(o0.payment_status || 'pending').toLowerCase();
    if (!['pending', 'receipt_uploaded'].includes(ps)) {
      await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'To‘lov bo‘yicha qaror allaqachon qabul qilingan' });
      return;
    }

    const { error: e1 } = await db.rpc('admin_payment_decision', { p_order_id: orderId, p_payment_status: decision });
    if (e1) throw e1;

    const { data: o, error: e2 } = await db.from('orders').select('*').eq('id', orderId).single();
    if (e2) throw e2;

    // Update the SINGLE admin message in-place
    await saveAdminMessage(o.id, chatId, c.message.message_id);
    await editSingleMessage(
      chatId,
      c.message.message_id,
      o,
      decision === 'verified' ? '💳 TO‘LOV TASDIQLANDI' : '💳 TO‘LOV RAD ETILDI'
    );

    await tg('answerCallbackQuery', {
      callback_query_id: c.id,
      text: decision === 'verified' ? '✅ To‘lov tasdiqlandi' : '❌ To‘lov rad etildi'
    });

    // Update customer message IN-PLACE (no new messages sent to customer!)
    await updateCustomerOrderMessageInPlace(o);
  } catch (e) {
    await tg('answerCallbackQuery', {
      callback_query_id: c.id,
      text: `Xatolik: ${String(e.message || '').slice(0, 160)}`,
      show_alert: true
    }).catch(() => {});
  }
}

async function pollUpdates() {
  const xs = await tg('getUpdates', { offset: state.offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  for (const u of xs || []) {
    state.offset = Math.max(state.offset, Number(u.update_id || 0) + 1);
    if (u.callback_query) {
      await handleCallback(u.callback_query);
      continue;
    }
    const m = u.message;
    const ch = m?.chat;
    if (ch?.type !== 'private' || !ch?.id || !/^\/start(?:@\w+)?(?:\s|$)/i.test(String(m.text || '').trim())) continue;

    await db.from('telegram_admin_bot_chats').upsert(
      {
        chat_id: Number(ch.id),
        username: ch.username || null,
        first_name: ch.first_name || null,
        last_name: ch.last_name || null,
        active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'chat_id' }
    );

    await tg('sendMessage', {
      chat_id: ch.id,
      text: `👤 <b>GULI ADMIN MA‘LUMOTI</b>\n\nTelegram ID: <code>${ch.id}</code>\nChat ID: <code>${ch.id}</code>\nHolat: ✅ Admin botga muvaffaqiyatli ulandi\n\n<i>Yangi buyurtmalar va to‘lovlar shu yerga yagona xabar sifatida keladi.</i>`,
      parse_mode: 'HTML'
    });
  }
}

async function syncOrders() {
  const ids = await adminIds();
  if (!ids.length || !db) return;

  const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false }).limit(60);
  if (error) throw error;

  for (const o of data || []) {
    const id = String(o.id);
    const s = orderSig(o);
    const prev = state.signatures.get(id);
    state.signatures.set(id, s);

    for (const chatId of ids) {
      const mid = await findAdminMessage(o.id, chatId);

      if (!mid) {
        // Send exactly 1 initial message
        if (isOrderRecent(o)) {
          const title =
            String(o.payment_status || '').toLowerCase() === 'receipt_uploaded'
              ? '🧾 YANGI CHEK / BUYURTMA'
              : '🛒 YANGI BUYURTMA';
          await sendInitialMessage(chatId, o, title);
        }
        continue;
      }

      // If already sent, and state changed -> EDIT THE EXISTING MESSAGE IN-PLACE!
      if (prev !== undefined && prev !== s) {
        const ps = String(o.payment_status || '').toLowerCase();
        const title =
          ps === 'verified'
            ? '💳 TO‘LOV TASDIQLANDI'
            : ps === 'rejected'
            ? '💳 TO‘LOV RAD ETILDI'
            : ps === 'receipt_uploaded'
            ? '🧾 CHEK YANGILANDI'
            : '📦 BUYURTMA STATUSI YANGILANDI';

        await editSingleMessage(chatId, mid, o, title);

        if (ps === 'receipt_uploaded' || o.payment_receipt_path) {
          const receiptKey = `${chatId}:${o.id}:${o.payment_receipt_path || o.receipt_url}`;
          if (!state.sentReceipts) state.sentReceipts = new Set();
          if (!state.sentReceipts.has(receiptKey)) {
            state.sentReceipts.add(receiptKey);
            const receiptPhoto = await getOrderReceiptUrl(o);
            if (receiptPhoto) {
              await tg('sendPhoto', {
                chat_id: chatId,
                photo: receiptPhoto,
                caption: `🧾 <b>YANGI TO‘LOV CHEKI YUKLANDI!</b>\nBuyurtma: <b>№ ${o.order_number || o.id}</b>\nMijoz: <b>${o.first_name || 'Mijoz'}</b> (${o.phone || ''})\nSumma: <b>${money(o.total)}</b>`,
                parse_mode: 'HTML',
                reply_markup: adminKeyboard(o)
              }).catch(() => {});
            }
          }
        }

        // Also update customer message in place if order changed
        await updateCustomerOrderMessageInPlace(o);
      }
    }
  }
}

async function loop() {
  if (state.running) return;
  state.running = true;
  try {
    await pollUpdates().catch(() => {});
    await syncOrders().catch(e => console.warn('[Admin bot single-msg sync]', e.message));
  } finally {
    state.running = false;
  }
}

if (ADMIN_TOKEN && db && !state.started) {
  state.started = true;
  setTimeout(() => void loop(), 1200);
  setInterval(() => void loop(), 3000);
  console.log('[GULI Admin bot] 1-message-per-order engine running.');
}
