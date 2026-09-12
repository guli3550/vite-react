// Consolidated GULI admin Telegram bot bridge.
// One order => one Telegram message (photo/collage + caption + buttons).
// Durable event keys prevent duplicate notifications across Render restarts/workers.
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || "").trim();
const CUSTOMER_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "")
  .split(",").map(v => v.trim()).filter(Boolean);
const state = globalThis.__GULI_ADMIN_BOT_STATE__ || {
  updateOffset: 0,
  ready: false,
  seenOrders: new Map(),
  seenChats: new Set(),
};
globalThis.__GULI_ADMIN_BOT_STATE__ = state;

async function telegram(method, body) {
  if (!BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}

async function customerTelegram(method, body) {
  if (!CUSTOMER_BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${CUSTOMER_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}

async function storedIds() {
  const ids = new Set(explicitIds());
  if (supabase) {
    const { data, error } = await supabase.from("telegram_admin_bot_chats")
      .select("chat_id").eq("active", true);
    if (error) console.warn("[Admin Telegram bot] chat lookup failed:", error.message);
    for (const row of data || []) ids.add(String(row.chat_id));
  }
  return [...ids];
}

async function notify(text, extra = {}) {
  if (!BOT_TOKEN || !String(text || "").trim()) return;
  const ids = await storedIds();
  await Promise.all(ids.map(async chat_id => {
    try {
      await telegram("sendMessage", { chat_id, text: String(text).slice(0, 3900), disable_web_page_preview: true, ...extra });
    } catch (e) { console.warn(`[Admin Telegram bot] notification failed for ${chat_id}:`, e.message); }
  }));
}
globalThis.__GULI_ADMIN_BOT_NOTIFY__ = notify;

function money(value) { return `${Math.round(Number(value || 0)).toLocaleString("uz-UZ")} so‘m`; }
function customerName(order) {
  return order?.customer_name || [order?.first_name, order?.last_name].filter(Boolean).join(" ") || order?.username || "Mijoz";
}
function paymentLabel(order) {
  const p = String(order?.payment || "").toLowerCase();
  if (p === "card_manual") return "💳 Karta o‘tkazmasi";
  if (p === "click") return "📲 Click";
  if (p === "payme") return "📱 Payme";
  return order?.payment || "—";
}
function paymentStatusLabel(order) {
  const p = String(order?.payment_status || "pending").toLowerCase();
  if (p === "verified") return "✅ Tasdiqlangan";
  if (p === "rejected") return "❌ Rad etilgan";
  if (p === "receipt_uploaded") return "🧾 Chek yuklangan — tekshiruv kutilmoqda";
  return "⏳ Kutilmoqda";
}
function itemLines(order) {
  return (Array.isArray(order?.items) ? order.items : []).slice(0, 12).map((item, i) => {
    const name = item?.name || item?.title || item?.product_name || "Mahsulot";
    const qty = Number(item?.quantity || item?.qty || 1);
    const price = item?.price != null ? ` — ${money(item.price)}` : "";
    return `${i + 1}. ${name} × ${qty}${price}`;
  });
}
function orderText(order, title = "🛒 YANGI ORDER") {
  const lines = itemLines(order);
  return `${title}\n\n` +
    `🛒 №: ${order?.order_number || order?.id || "—"}\n` +
    `👤 Mijoz: ${customerName(order)}\n` +
    `📞 Telefon: ${order?.phone || "—"}\n` +
    `💰 Jami: ${money(order?.total)}\n` +
    `💳 To‘lov: ${paymentLabel(order)}\n` +
    `🔎 To‘lov holati: ${paymentStatusLabel(order)}\n` +
    `📦 Status: ${order?.status || "⏳ Buyurtma kutilmoqda"}\n` +
    `📍 Manzil: ${typeof order?.address === "string" ? order.address : "Buyurtmada mavjud"}` +
    (lines.length ? `\n\n${lines.join("\n")}` : "");
}
function paymentKeyboard(order) {
  const id = String(order?.id || "");
  const payment = String(order?.payment || "").toLowerCase();
  const status = String(order?.payment_status || "pending").toLowerCase();
  if (!id || payment !== "card_manual" || !["pending", "receipt_uploaded"].includes(status)) return { inline_keyboard: [] };
  return { inline_keyboard: [[
    { text: "✅ Tasdiqlash", callback_data: `guli_pay:verified:${id}` },
    { text: "❌ Rad etish", callback_data: `guli_pay:rejected:${id}` },
  ]] };
}
function mediaUrl(item) {
  const candidates = [item?.image, item?.image_url, item?.photo, ...(Array.isArray(item?.images) ? item.images : [])];
  return candidates.map(v => String(v || "").trim()).find(v => /^https?:\/\//i.test(v)) || "";
}
function productImages(order) {
  const seen = new Set(); const out = [];
  for (const item of Array.isArray(order?.items) ? order.items : []) {
    const url = mediaUrl(item);
    if (url && !seen.has(url)) { seen.add(url); out.push(url); }
    if (out.length >= 8) break;
  }
  return out;
}
async function receiptUrl(order) {
  const path = String(order?.payment_receipt_path || "").replace(/^\/+/, "");
  if (!path || !supabase) return "";
  const { data, error } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 60 * 60);
  if (error) { console.warn("[Admin Telegram bot] receipt URL failed:", error.message); return ""; }
  return data?.signedUrl || "";
}
function isPdf(path) { return /\.pdf$/i.test(String(path || "")); }
async function fetchImage(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = String(r.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) throw new Error(`Not image: ${type || "unknown"}`);
    const b = Buffer.from(await r.arrayBuffer());
    return b.length ? b : null;
  } catch (e) { console.warn("[Admin Telegram bot] image fetch failed:", e.message); return null; }
}
async function composeOrderImage(order) {
  const urls = productImages(order);
  if (!isPdf(order?.payment_receipt_path)) {
    const receipt = await receiptUrl(order);
    if (receipt) urls.push(receipt);
  }
  const unique = [...new Set(urls)].slice(0, 9);
  if (!unique.length) return null;
  const buffers = [];
  for (const url of unique) { const b = await fetchImage(url); if (b) buffers.push(b); }
  if (!buffers.length) return null;
  const tile = 560;
  const cols = buffers.length === 1 ? 1 : 2;
  const rows = Math.ceil(buffers.length / cols);
  const composites = [];
  for (let i = 0; i < buffers.length; i++) {
    const normalized = await sharp(buffers[i]).rotate().resize(tile, tile, { fit: "cover", position: "centre" }).jpeg({ quality: 88 }).toBuffer();
    composites.push({ input: normalized, left: (i % cols) * tile, top: Math.floor(i / cols) * tile });
  }
  return sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(composites).jpeg({ quality: 88 }).toBuffer();
}
async function sendPhotoBuffer(chatId, image, caption, markup) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", String(caption).slice(0, 1024));
  form.append("reply_markup", JSON.stringify(markup));
  form.append("photo", new Blob([image], { type: "image/jpeg" }), `guli_order_${Date.now()}.jpg`);
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}
async function sendOrderMessage(chatId, order, title) {
  const image = await composeOrderImage(order);
  const caption = orderText(order, title);
  if (image) {
    // Telegram photo captions are limited to 1024 chars. The compact form keeps
    // all required order/payment/status fields in the same message.
    const compact = `${title}\n\n` +
      `🛒 №: ${order?.order_number || order?.id || "—"}\n` +
      `👤 Mijoz: ${customerName(order)}\n` +
      `📞 Telefon: ${order?.phone || "—"}\n` +
      `💰 Jami: ${money(order?.total)}\n` +
      `💳 To‘lov: ${paymentLabel(order)}\n` +
      `🔎 To‘lov holati: ${paymentStatusLabel(order)}\n` +
      `📦 Status: ${order?.status || "⏳ Buyurtma kutilmoqda"}\n` +
      `📍 Manzil: ${typeof order?.address === "string" ? order.address : "Buyurtmada mavjud"}` +
      (itemLines(order).length ? `\n\n${itemLines(order).join("\n")}` : "");
    return sendPhotoBuffer(chatId, image, (caption.length <= 1024 ? caption : compact).slice(0, 1024), paymentKeyboard(order));
  }
  return telegram("sendMessage", { chat_id: chatId, text: caption, disable_web_page_preview: true, reply_markup: paymentKeyboard(order) });
}
async function claimEvent(eventKey, eventType, orderId = null) {
  if (!supabase) return true;
  const { error } = await supabase.from("telegram_admin_bot_events").insert({ event_key: eventKey, event_type: eventType, order_id: orderId || null });
  if (!error) return true;
  if (String(error.code || "") === "23505") return false;
  console.warn("[Admin Telegram bot] event claim failed:", error.message);
  return false;
}
async function releaseEvent(eventKey) { if (supabase) await supabase.from("telegram_admin_bot_events").delete().eq("event_key", eventKey); }
function orderSignature(order) { return JSON.stringify({ status: order?.status || "", payment_status: order?.payment_status || "", payment_receipt_path: order?.payment_receipt_path || "" }); }
async function sendOrderNotification(order, title) {
  if (!order?.id) return;
  const ids = await storedIds();
  if (!ids.length) return;
  const signature = orderSignature(order);
  for (const chatId of ids) {
    const key = `order:${order.id}:${signature}:${chatId}`;
    if (!(await claimEvent(key, "order", order.id))) continue;
    try { await sendOrderMessage(chatId, order, title); }
    catch (e) { await releaseEvent(key); throw e; }
  }
}
async function sendCustomerPaymentStatus(order, decision) {
  const telegramId = Number(order?.telegram_id || 0);
  if (!telegramId || !CUSTOMER_BOT_TOKEN) return;
  const text = decision === "verified"
    ? `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${order.order_number}\nSumma: ${Math.round(Number(order.total)||0).toLocaleString("uz-UZ")} so‘m\n\nBuyurtma holati: ${order.status || "Qabul qilindi"}`
    : `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${order.order_number}\nIltimos, to‘lov chekini qayta yuboring.`;
  await customerTelegram("sendMessage", { chat_id: telegramId, text, disable_web_page_preview: true });
}
async function getOrder(orderId) {
  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data || null;
}
async function updateOriginalOrderMessage(callback, order, decision) {
  const m = callback?.message; if (!m?.message_id || !order) return;
  const title = decision === "verified" ? "💳 TO‘LOV TASDIQLANDI" : "💳 TO‘LOV RAD ETILDI";
  const text = orderText(order, title);
  const markup = { inline_keyboard: [] };
  if (Array.isArray(m.photo) && m.photo.length) {
    await telegram("editMessageCaption", { chat_id: m.chat.id, message_id: m.message_id, caption: text.slice(0, 1024), reply_markup: markup }).catch(() => {});
  } else {
    await telegram("editMessageText", { chat_id: m.chat.id, message_id: m.message_id, text, disable_web_page_preview: true, reply_markup: markup }).catch(() => {});
  }
}
async function handlePaymentCallback(callback) {
  const chatId = Number(callback?.message?.chat?.id || 0);
  const fromId = Number(callback?.from?.id || 0);
  const data = String(callback?.data || "");
  if (!chatId || !fromId || !data.startsWith("guli_pay:")) return;
  const ids = await storedIds();
  if (!ids.includes(String(chatId)) || String(chatId) !== String(fromId)) {
    await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: "⛔ Ruxsat yo‘q", show_alert: true }).catch(() => {}); return;
  }
  const [, decision, orderId] = data.split(":");
  if (!orderId || !["verified", "rejected"].includes(decision)) return;
  try {
    const current = await getOrder(orderId);
    if (!current) throw new Error("Buyurtma topilmadi");
    const currentPayment = String(current.payment_status || "pending").toLowerCase();
    if (!["pending", "receipt_uploaded"].includes(currentPayment)) {
      await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: currentPayment === decision ? "Bu qaror allaqachon saqlangan" : "To‘lov bo‘yicha qaror allaqachon qabul qilingan", show_alert: false }).catch(() => {});
      await updateOriginalOrderMessage(callback, current, currentPayment === "verified" ? "verified" : "rejected");
      return;
    }
    const { error } = await supabase.rpc("admin_payment_decision", { p_order_id: orderId, p_payment_status: decision });
    if (error) throw error;
    const order = await getOrder(orderId);
    if (!order) throw new Error("Yangilangan buyurtma topilmadi");
    const eventKey = `order:${order.id}:${orderSignature(order)}:${chatId}`;
    await claimEvent(eventKey, "order", order.id);
    state.seenOrders.set(String(order.id), orderSignature(order));
    await updateOriginalOrderMessage(callback, order, decision);
    await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: decision === "verified" ? "✅ To‘lov tasdiqlandi" : "❌ To‘lov rad etildi", show_alert: false });
    await sendCustomerPaymentStatus(order, decision).catch(e => console.warn("[Admin Telegram bot] customer payment notification failed:", e.message));
  } catch (e) {
    console.warn("[Admin Telegram bot] payment decision failed:", e.message);
    await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: `Xatolik: ${String(e.message || "qaror saqlanmadi").slice(0, 180)}`, show_alert: true }).catch(() => {});
  }
}
async function discoverAdminChats() {
  if (!BOT_TOKEN || !supabase) return;
  try {
    const updates = await telegram("getUpdates", { offset: state.updateOffset, timeout: 0, allowed_updates: ["message", "callback_query"] });
    for (const update of updates || []) {
      state.updateOffset = Math.max(state.updateOffset, Number(update.update_id || 0) + 1);
      if (update?.callback_query) { await handlePaymentCallback(update.callback_query); continue; }
      const message = update?.message; const chat = message?.chat;
      if (chat?.type !== "private" || !chat?.id) continue;
      const text = String(message?.text || "").trim();
      if (!/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) continue;
      await supabase.from("telegram_admin_bot_chats").upsert({ chat_id: Number(chat.id), username: chat.username || null, first_name: chat.first_name || null, last_name: chat.last_name || null, active: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
      await telegram("sendMessage", { chat_id: chat.id, text: `👤 GULI ADMIN MA‘LUMOTI\n\nIsm: ${[chat.first_name, chat.last_name].filter(Boolean).join(" ") || "Noma‘lum"}\nUsername: ${chat.username ? `@${chat.username}` : "mavjud emas"}\nTelegram ID: ${chat.id}\nChat ID: ${chat.id}\nHolat: ✅ Admin botga ulangan\n\n🔐 Ushbu chat GULI admin bildirishnomalarini olish uchun saqlandi.`, disable_web_page_preview: true });
    }
  } catch (e) { console.warn("[Admin Telegram bot] update polling failed:", e.message); }
}
async function bootstrapBaseline() {
  if (!supabase || state.ready) return;
  const { data: orders } = await supabase.from("orders").select("id,status,payment_status,payment_receipt_path").order("created_at", { ascending: false }).limit(200);
  for (const o of orders || []) state.seenOrders.set(String(o.id), orderSignature(o));
  const { data: chats } = await supabase.from("chat_messages").select("id").order("created_at", { ascending: false }).limit(100);
  for (const c of chats || []) state.seenChats.add(String(c.id));
  state.ready = true;
}
async function pollDatabase() {
  if (!BOT_TOKEN || !supabase) return;
  try {
    await bootstrapBaseline();
    const { data: orders, error: oe } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(80);
    if (oe) throw oe;
    for (const order of orders || []) {
      const id = String(order.id || ""); if (!id) continue;
      const signature = orderSignature(order); const previous = state.seenOrders.get(id);
      if (previous === undefined) {
        state.seenOrders.set(id, signature);
        try { await sendOrderNotification(order, "🛒 YANGI ORDER"); } catch (e) { console.warn("[Admin Telegram bot] new order failed:", e.message); }
      } else if (previous !== signature) {
        state.seenOrders.set(id, signature);
        let prev = {}; try { prev = JSON.parse(previous); } catch {}
        const paymentChanged = String(prev.payment_status || "") !== String(order.payment_status || "");
        const title = paymentChanged
          ? (String(order.payment_status || "").toLowerCase() === "verified" ? "💳 TO‘LOV TASDIQLANDI" : String(order.payment_status || "").toLowerCase() === "rejected" ? "💳 TO‘LOV RAD ETILDI" : "🧾 CHEK YUKLANDI")
          : "📦 ORDER STATUS O‘ZGARDI";
        try { await sendOrderNotification(order, title); } catch (e) { console.warn("[Admin Telegram bot] order change failed:", e.message); }
      }
    }
    const { data: chats, error: ce } = await supabase.from("chat_messages").select("*").eq("sender", "customer").order("created_at", { ascending: false }).limit(40);
    if (ce) throw ce;
    for (const chat of chats || []) {
      const id = String(chat.id || ""); if (!id || state.seenChats.has(id)) continue;
      state.seenChats.add(id); const eventKey = `chat:${id}`;
      if (!(await claimEvent(eventKey, "chat", null))) continue;
      try {
        const meta = chat.metadata || {};
        await notify(`💬 ONLINE CHAT\n\n👤 Mijoz: ${meta.first_name || "Mijoz"}${meta.last_name ? ` ${meta.last_name}` : ""}${meta.telegram_username ? ` (@${meta.telegram_username})` : meta.telegram_id ? `\n🆔 Telegram ID: ${meta.telegram_id}` : ""}${meta.phone ? `\n📞 ${meta.phone}` : ""}\n\n📝 Xabar:\n${String(chat.text || "").slice(0, 1800)}`);
      } catch (e) { await releaseEvent(eventKey); console.warn("[Admin Telegram bot] chat notification failed:", e.message); }
    }
    if (state.seenOrders.size > 400) {
      const keep = new Set((orders || []).map(o => String(o.id)));
      for (const id of state.seenOrders.keys()) if (!keep.has(id)) state.seenOrders.delete(id);
    }
    if (state.seenChats.size > 400) state.seenChats = new Set([...state.seenChats].slice(-200));
  } catch (e) { console.warn("[Admin Telegram bot] DB polling failed:", e.message); }
}
if (BOT_TOKEN && supabase) {
  console.log("[Admin Telegram bot] consolidated order/chat notification bridge enabled.");
  setTimeout(() => { void discoverAdminChats(); void pollDatabase(); }, 1500);
  setInterval(() => { void discoverAdminChats(); }, 3000);
  setInterval(() => { void pollDatabase(); }, 2500);
} else {
  console.warn("[Admin Telegram bot] TELEGRAM_ADMIN_BOT_TOKEN or Supabase is not configured; admin alerts disabled.");
}
