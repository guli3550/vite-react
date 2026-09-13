// GULI admin Telegram bot: receipt-first order notification.
// There is intentionally NO "YANGI ORDER" admin notification.
// The first admin notification for a card order is the receipt-upload event.
// That notification contains product image(s) + receipt image and the payment buttons.
// The same message is edited after admin verification/rejection.
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const ADMIN_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || "").trim();
const CUSTOMER_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const state = globalThis.__GULI_ADMIN_BOT_SINGLE_STATE__ || { offset: 0, ready: false, orders: new Map(), chats: new Set() };
globalThis.__GULI_ADMIN_BOT_SINGLE_STATE__ = state;

async function tg(method, body, token = ADMIN_TOKEN) {
  if (!token) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}
async function adminIds() {
  const ids = new Set(explicitIds());
  if (db) {
    const { data } = await db.from("telegram_admin_bot_chats").select("chat_id").eq("active", true);
    for (const row of data || []) ids.add(String(row.chat_id));
  }
  return [...ids];
}
function money(v) { return `${Math.round(Number(v || 0)).toLocaleString("uz-UZ")} so‘m`; }
function name(o) { return o?.customer_name || [o?.first_name, o?.last_name].filter(Boolean).join(" ") || o?.username || "Mijoz"; }
function pay(o) { const p = String(o?.payment || "").toLowerCase(); return p === "card_manual" ? "💳 Karta o‘tkazmasi" : p === "click" ? "📲 Click" : p === "payme" ? "📱 Payme" : o?.payment || "—"; }
function payStatus(o) { const p = String(o?.payment_status || "pending").toLowerCase(); return p === "verified" ? "✅ Tasdiqlangan" : p === "rejected" ? "❌ Rad etilgan" : p === "receipt_uploaded" ? "🧾 Chek yuklangan — tekshiruv kutilmoqda" : "⏳ Kutilmoqda"; }
function items(o) { return (Array.isArray(o?.items) ? o.items : []).slice(0, 12).map((x, i) => `${i + 1}. ${x?.name || x?.title || x?.product_name || "Mahsulot"} × ${Number(x?.quantity || x?.qty || 1)}${x?.price != null ? ` — ${money(x.price)}` : ""}`); }
function text(o, title = "🧾 CHEK YUKLANDI") {
  const lines = items(o);
  return `${title}\n\n🛒 №: ${o?.order_number || o?.id || "—"}\n👤 Mijoz: ${name(o)}\n📞 Telefon: ${o?.phone || "—"}\n💰 Jami: ${money(o?.total)}\n💳 To‘lov: ${pay(o)}\n🔎 To‘lov holati: ${payStatus(o)}\n📦 Status: ${o?.status || "⏳ Buyurtma kutilmoqda"}\n📍 Manzil: ${typeof o?.address === "string" ? o.address : "Buyurtmada mavjud"}${lines.length ? `\n\n${lines.join("\n")}` : ""}`;
}
function keyboard(o) {
  const status = String(o?.payment_status || "pending").toLowerCase();
  if (String(o?.payment || "").toLowerCase() !== "card_manual" || !["pending", "receipt_uploaded"].includes(status) || !o?.id) return { inline_keyboard: [] };
  return { inline_keyboard: [[{ text: "✅ Tasdiqlash", callback_data: `guli_pay:verified:${o.id}` }, { text: "❌ Rad etish", callback_data: `guli_pay:rejected:${o.id}` }]] };
}
function imageUrl(item) {
  const xs = [item?.image, item?.image_url, item?.photo, ...(Array.isArray(item?.images) ? item.images : [])];
  return xs.map(v => String(v || "").trim()).find(v => /^https?:\/\//i.test(v)) || "";
}
async function receiptUrl(o) {
  const path = String(o?.payment_receipt_path || "").replace(/^\/+/, "");
  if (!path || !db || /\.pdf$/i.test(path)) return "";
  const { data } = await db.storage.from("payment-receipts").createSignedUrl(path, 3600);
  return data?.signedUrl || "";
}
async function getImage(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok || !String(r.headers.get("content-type") || "").toLowerCase().startsWith("image/")) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length ? b : null;
  } catch { return null; }
}
async function orderImage(o) {
  const urls = [];
  const seen = new Set();
  for (const item of Array.isArray(o?.items) ? o.items : []) {
    const u = imageUrl(item);
    if (u && !seen.has(u)) { seen.add(u); urls.push(u); }
    if (urls.length >= 8) break;
  }
  const receipt = await receiptUrl(o);
  if (receipt && !seen.has(receipt)) urls.push(receipt);
  const buffers = [];
  for (const u of urls.slice(0, 9)) { const b = await getImage(u); if (b) buffers.push(b); }
  if (!buffers.length) return null;
  const size = 560, cols = buffers.length === 1 ? 1 : 2, rows = Math.ceil(buffers.length / cols), layers = [];
  for (let i = 0; i < buffers.length; i++) {
    const b = await sharp(buffers[i]).rotate().resize(size, size, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
    layers.push({ input: b, left: (i % cols) * size, top: Math.floor(i / cols) * size });
  }
  return sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(layers).jpeg({ quality: 88 }).toBuffer();
}
async function sendPhoto(chatId, image, caption, markup) {
  const form = new FormData();
  form.append("chat_id", String(chatId)); form.append("caption", caption.slice(0, 1024)); form.append("reply_markup", JSON.stringify(markup));
  form.append("photo", new Blob([image], { type: "image/jpeg" }), `guli_${Date.now()}.jpg`);
  const r = await fetch(`https://api.telegram.org/bot${ADMIN_TOKEN}/sendPhoto`, { method: "POST", body: form });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}
async function sendOrder(chatId, o, title = "🧾 CHEK YUKLANDI") {
  const caption = text(o, title); const image = await orderImage(o);
  if (image) return sendPhoto(chatId, image, caption.slice(0, 1024), keyboard(o));
  return tg("sendMessage", { chat_id: chatId, text: caption, disable_web_page_preview: true, reply_markup: keyboard(o) });
}
function signature(o) { return JSON.stringify({ status: o?.status || "", payment_status: o?.payment_status || "", receipt: o?.payment_receipt_path || "" }); }
async function claim(key, type, orderId = null) {
  const { error } = await db.from("telegram_admin_bot_events").insert({ event_key: key, event_type: type, order_id: orderId });
  if (!error) return true; if (String(error.code) === "23505") return false; console.warn("[Admin bot] event claim:", error.message); return false;
}
async function release(key) { await db.from("telegram_admin_bot_events").delete().eq("event_key", key); }
async function saveMessage(orderId, chatId, messageId) {
  if (!messageId) return;
  await db.from("telegram_admin_bot_order_messages").upsert({ order_id: orderId, chat_id: Number(chatId), message_id: Number(messageId), updated_at: new Date().toISOString() }, { onConflict: "order_id,chat_id" });
}
async function findMessage(orderId, chatId) {
  const { data } = await db.from("telegram_admin_bot_order_messages").select("message_id").eq("order_id", orderId).eq("chat_id", Number(chatId)).maybeSingle();
  return data?.message_id ? Number(data.message_id) : null;
}
async function editPhoto(chatId, messageId, o, title) {
  const image = await orderImage(o); const caption = text(o, title);
  if (!image) return tg("editMessageText", { chat_id: chatId, message_id: messageId, text: caption, disable_web_page_preview: true, reply_markup: keyboard(o) });
  const form = new FormData();
  form.append("chat_id", String(chatId)); form.append("message_id", String(messageId));
  form.append("media", JSON.stringify({ type: "photo", media: "attach://order.jpg", caption: caption.slice(0, 1024) }));
  form.append("reply_markup", JSON.stringify(keyboard(o)));
  form.append("photo", new Blob([image], { type: "image/jpeg" }), "order.jpg");
  const r = await fetch(`https://api.telegram.org/bot${ADMIN_TOKEN}/editMessageMedia`, { method: "POST", body: form });
  const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`); return j.result;
}
async function getOrder(id) { const { data, error } = await db.from("orders").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data; }
async function customerPaymentNotice(o, decision) {
  const id = Number(o?.telegram_id || 0); if (!id || !CUSTOMER_TOKEN) return;
  const msg = decision === "verified"
    ? `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${o.order_number}\nSumma: ${Math.round(Number(o.total)||0).toLocaleString("uz-UZ")} so‘m\n\nBuyurtma holati: ${o.status || "Qabul qilindi"}`
    : `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${o.order_number}\nIltimos, to‘lov chekini qayta yuboring.`;
  await tg("sendMessage", { chat_id: id, text: msg, disable_web_page_preview: true }, CUSTOMER_TOKEN);
}
async function callback(c) {
  const chatId = Number(c?.message?.chat?.id || 0), fromId = Number(c?.from?.id || 0), data = String(c?.data || "");
  if (!chatId || !fromId || !data.startsWith("guli_pay:")) return;
  const ids = await adminIds();
  if (!ids.includes(String(chatId)) || chatId !== fromId) { await tg("answerCallbackQuery", { callback_query_id: c.id, text: "⛔ Ruxsat yo‘q", show_alert: true }); return; }
  const [, decision, orderId] = data.split(":"); if (!orderId || !["verified", "rejected"].includes(decision)) return;
  try {
    const current = await getOrder(orderId); if (!current) throw new Error("Buyurtma topilmadi");
    const ps = String(current.payment_status || "pending").toLowerCase();
    if (!["pending", "receipt_uploaded"].includes(ps)) {
      await tg("answerCallbackQuery", { callback_query_id: c.id, text: "To‘lov bo‘yicha qaror allaqachon qabul qilingan", show_alert: false }); return;
    }
    const { error } = await db.rpc("admin_payment_decision", { p_order_id: orderId, p_payment_status: decision }); if (error) throw error;
    const o = await getOrder(orderId);
    await claim(`order:${o.id}:${signature(o)}:${chatId}`, "order", o.id);
    state.orders.set(String(o.id), signature(o));
    await saveMessage(o.id, chatId, c?.message?.message_id);
    await editPhoto(chatId, c.message.message_id, o, decision === "verified" ? "💳 TO‘LOV TASDIQLANDI" : "💳 TO‘LOV RAD ETILDI");
    await tg("answerCallbackQuery", { callback_query_id: c.id, text: decision === "verified" ? "✅ To‘lov tasdiqlandi" : "❌ To‘lov rad etildi", show_alert: false });
    await customerPaymentNotice(o, decision).catch(e => console.warn("[Admin bot] customer notice:", e.message));
  } catch (e) { console.warn("[Admin bot] payment callback:", e.message); await tg("answerCallbackQuery", { callback_query_id: c.id, text: `Xatolik: ${String(e.message).slice(0, 180)}`, show_alert: true }).catch(() => {}); }
}
async function updates() {
  const xs = await tg("getUpdates", { offset: state.offset, timeout: 0, allowed_updates: ["message", "callback_query"] });
  for (const u of xs || []) {
    state.offset = Math.max(state.offset, Number(u.update_id || 0) + 1);
    if (u.callback_query) { await callback(u.callback_query); continue; }
    const m = u.message, chat = m?.chat; if (chat?.type !== "private" || !chat?.id) continue;
    if (!/^\/start(?:@\w+)?(?:\s|$)/i.test(String(m.text || "").trim())) continue;
    await db.from("telegram_admin_bot_chats").upsert({ chat_id: Number(chat.id), username: chat.username || null, first_name: chat.first_name || null, last_name: chat.last_name || null, active: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
    await tg("sendMessage", { chat_id: chat.id, text: `👤 GULI ADMIN MA‘LUMOTI\n\nIsm: ${[chat.first_name, chat.last_name].filter(Boolean).join(" ") || "Noma‘lum"}\nUsername: ${chat.username ? `@${chat.username}` : "mavjud emas"}\nTelegram ID: ${chat.id}\nChat ID: ${chat.id}\nHolat: ✅ Admin botga ulangan\n\n🔐 Ushbu chat GULI admin bildirishnomalarini olish uchun saqlandi.` });
  }
}
async function baseline() {
  if (state.ready) return;
  const { data: os } = await db.from("orders").select("id,status,payment_status,payment_receipt_path").order("created_at", { ascending: false }).limit(200);
  for (const o of os || []) state.orders.set(String(o.id), signature(o));
  const { data: cs } = await db.from("chat_messages").select("id").order("created_at", { ascending: false }).limit(100);
  for (const c of cs || []) state.chats.add(String(c.id));
  state.ready = true;
}
async function poll() {
  await baseline();
  const { data: os, error } = await db.from("orders").select("*").order("created_at", { ascending: false }).limit(80); if (error) throw error;
  const ids = await adminIds(); if (!ids.length) return;
  for (const o of os || []) {
    const id = String(o.id), sig = signature(o), prev = state.orders.get(id);
    // IMPORTANT: order creation is intentionally silent for admins.
    // Only a receipt upload creates the admin notification.
    if (prev === undefined) { state.orders.set(id, sig); continue; }
    if (prev !== sig) {
      state.orders.set(id, sig);
      let p = {}; try { p = JSON.parse(prev); } catch {}
      const paymentChanged = p.payment_status !== o.payment_status;
      const receiptUploaded = String(o.payment_status || "").toLowerCase() === "receipt_uploaded" && String(o.payment_receipt_path || "").trim();
      const title = receiptUploaded ? "🧾 CHEK YUKLANDI" : paymentChanged ? (o.payment_status === "verified" ? "💳 TO‘LOV TASDIQLANDI" : o.payment_status === "rejected" ? "💳 TO‘LOV RAD ETILDI" : "🧾 CHEK YUKLANDI") : "📦 ORDER STATUS O‘ZGARDI";
      for (const chatId of ids) {
        const key = `order:${id}:${sig}:${chatId}`; if (!(await claim(key, "order", o.id))) continue;
        try {
          // Receipt upload has no previous admin message, so create the receipt-first message.
          // Later verification/rejection edits this exact message.
          const mid = await findMessage(id, chatId);
          if (mid) await editPhoto(chatId, mid, o, title);
          else if (receiptUploaded || paymentChanged) { const sent = await sendOrder(chatId, o, title); await saveMessage(id, chatId, sent?.message_id); }
        } catch (e) { await release(key); console.warn("[Admin bot] order update:", e.message); }
      }
    }
  }
  const { data: cs, error: ce } = await db.from("chat_messages").select("*").eq("sender", "customer").order("created_at", { ascending: false }).limit(40); if (ce) throw ce;
  for (const c of cs || []) {
    const id = String(c.id); if (!id || state.chats.has(id)) continue; state.chats.add(id);
    const key = `chat:${id}`; if (!(await claim(key, "chat", null))) continue;
    try {
      const m = c.metadata || {};
      await Promise.all(ids.map(chatId => tg("sendMessage", { chat_id: chatId, text: `💬 ONLINE CHAT\n\n👤 Mijoz: ${m.first_name || "Mijoz"}${m.last_name ? ` ${m.last_name}` : ""}${m.telegram_username ? ` (@${m.telegram_username})` : m.telegram_id ? `\n🆔 Telegram ID: ${m.telegram_id}` : ""}${m.phone ? `\n📞 ${m.phone}` : ""}\n\n📝 Xabar:\n${String(c.text || "").slice(0, 1800)}` })));
    } catch (e) { await release(key); console.warn("[Admin bot] chat:", e.message); }
  }
}
if (ADMIN_TOKEN && db) {
  console.log("[Admin Telegram bot] receipt-first single-message order bridge enabled.");
  setTimeout(() => { void updates().catch(e => console.warn("[Admin bot] updates:", e.message)); void poll().catch(e => console.warn("[Admin bot] poll:", e.message)); }, 1500);
  setInterval(() => void updates().catch(e => console.warn("[Admin bot] updates:", e.message)), 3000);
  setInterval(() => void poll().catch(e => console.warn("[Admin bot] poll:", e.message)), 2500);
}
