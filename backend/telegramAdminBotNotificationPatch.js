// Dedicated GULI admin Telegram bot bridge.
// This bot is independent from the customer-facing TELEGRAM_BOT_TOKEN.
// It polls the production DB so notifications do not depend on Express route registration order.
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const API_BASE = String(process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "")
  .split(",").map(v => v.trim()).filter(Boolean);
const state = globalThis.__GULI_ADMIN_BOT_STATE__ || {
  updateOffset: 0,
  ready: false,
  seenOrders: new Map(),
  sentOrderMedia: new Set(),
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

async function storedIds() {
  const ids = new Set(explicitIds());
  if (supabase) {
    const { data, error } = await supabase
      .from("telegram_admin_bot_chats")
      .select("chat_id")
      .eq("active", true);
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
      await telegram("sendMessage", {
        chat_id,
        text: String(text).slice(0, 3900),
        disable_web_page_preview: true,
        ...extra,
      });
    } catch (e) {
      console.warn(`[Admin Telegram bot] notification failed for ${chat_id}:`, e.message);
    }
  }));
}

globalThis.__GULI_ADMIN_BOT_NOTIFY__ = notify;

function money(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("uz-UZ")} so‘m`;
}

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

function orderText(order, title = "🛒 YANGI ORDER") {
  const items = Array.isArray(order?.items) ? order.items : [];
  const lines = items.slice(0, 12).map((item, i) => {
    const name = item?.name || item?.title || item?.product_name || "Mahsulot";
    const qty = Number(item?.quantity || item?.qty || 1);
    const price = item?.price != null ? ` — ${money(item.price)}` : "";
    return `${i + 1}. ${name} × ${qty}${price}`;
  });
  return `${title}\n\n` +
    `🔢 Order №: ${order?.order_number || order?.id || "—"}\n` +
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
  const pending = !["verified", "rejected"].includes(String(order?.payment_status || "").toLowerCase());
  if (!id || !pending) return { inline_keyboard: [] };
  return {
    inline_keyboard: [[
      { text: "✅ Tasdiqlash", callback_data: `guli_pay:verified:${id}` },
      { text: "❌ Rad etish", callback_data: `guli_pay:rejected:${id}` },
    ]],
  };
}

function mediaUrl(item) {
  const candidates = [item?.image, item?.image_url, item?.photo, ...(Array.isArray(item?.images) ? item.images : [])];
  return candidates.map(v => String(v || "").trim()).find(v => /^https?:\/\//i.test(v)) || "";
}

function orderProductImages(order) {
  const seen = new Set();
  const out = [];
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
  if (error) {
    console.warn("[Admin Telegram bot] receipt signed URL failed:", error.message);
    return "";
  }
  return data?.signedUrl || "";
}

function isPdf(path) { return /\.pdf$/i.test(String(path || "")); }

async function sendOrderMedia(chatId, order, includeReceipt = true) {
  const products = orderProductImages(order);
  if (products.length) {
    const media = products.map(url => ({ type: "photo", media: url }));
    try { await telegram("sendMediaGroup", { chat_id: chatId, media }); }
    catch (e) { console.warn("[Admin Telegram bot] product media failed:", e.message); }
  }

  if (includeReceipt && order?.payment_receipt_path) {
    const url = await receiptUrl(order);
    if (url) {
      try {
        if (isPdf(order.payment_receipt_path)) {
          await telegram("sendDocument", { chat_id: chatId, document: url, caption: `🧾 №${order.order_number || order.id} — To‘lov cheki` });
        } else {
          await telegram("sendPhoto", { chat_id: chatId, photo: url, caption: `🧾 №${order.order_number || order.id} — To‘lov cheki` });
        }
      } catch (e) { console.warn("[Admin Telegram bot] receipt media failed:", e.message); }
    }
  }
}

async function sendOrderNotification(order, title = "🛒 YANGI ORDER", forceMedia = false) {
  if (!order?.id) return;
  const ids = await storedIds();
  for (const chat_id of ids) {
    try {
      const sent = await telegram("sendMessage", {
        chat_id,
        text: orderText(order, title),
        disable_web_page_preview: true,
        reply_markup: paymentKeyboard(order),
      });
      const key = `${chat_id}:${order.id}:${order.payment_receipt_path || "no-receipt"}`;
      if (forceMedia || !state.sentOrderMedia.has(key)) {
        await sendOrderMedia(chat_id, order, true);
        state.sentOrderMedia.add(key);
      }
      if (sent?.message_id) {
        state.lastOrderMessage = state.lastOrderMessage || new Map();
        state.lastOrderMessage.set(`${chat_id}:${order.id}`, sent.message_id);
      }
    } catch (e) {
      console.warn(`[Admin Telegram bot] order notification failed for ${chat_id}:`, e.message);
    }
  }
}

async function discoverAdminChats() {
  if (!BOT_TOKEN || !supabase) return;
  try {
    const updates = await telegram("getUpdates", {
      offset: state.updateOffset,
      timeout: 0,
      allowed_updates: ["message", "callback_query"],
    });
    for (const update of updates || []) {
      state.updateOffset = Math.max(state.updateOffset, Number(update.update_id || 0) + 1);
      const callback = update?.callback_query;
      if (callback) {
        await handlePaymentCallback(callback);
        continue;
      }
      const message = update?.message;
      const chat = message?.chat;
      if (chat?.type !== "private" || !chat?.id) continue;
      const text = String(message?.text || "").trim();
      if (!/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) continue;
      await supabase.from("telegram_admin_bot_chats").upsert({
        chat_id: Number(chat.id),
        username: chat.username || null,
        first_name: chat.first_name || null,
        last_name: chat.last_name || null,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "chat_id" });
      await telegram("sendMessage", {
        chat_id: chat.id,
        text: `👤 GULI ADMIN MA‘LUMOTI\n\nIsm: ${[chat.first_name, chat.last_name].filter(Boolean).join(" ") || "Noma‘lum"}\nUsername: ${chat.username ? `@${chat.username}` : "mavjud emas"}\nTelegram ID: ${chat.id}\nChat ID: ${chat.id}\nHolat: ✅ Admin botga ulangan\n\n🔐 Ushbu chat GULI admin bildirishnomalarini olish uchun saqlandi.`,
        disable_web_page_preview: true,
      });
    }
  } catch (e) {
    console.warn("[Admin Telegram bot] update polling failed:", e.message);
  }
}

async function handlePaymentCallback(callback) {
  const chatId = Number(callback?.message?.chat?.id || 0);
  const fromId = Number(callback?.from?.id || 0);
  const data = String(callback?.data || "");
  if (!chatId || !fromId || !data.startsWith("guli_pay:")) return;
  const ids = await storedIds();
  if (!ids.includes(String(chatId)) || String(chatId) !== String(fromId)) {
    await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: "⛔ Ruxsat yo‘q", show_alert: true }).catch(() => {});
    return;
  }
  const [, decision, orderId] = data.split(":");
  if (!orderId || !["verified", "rejected"].includes(decision)) return;
  try {
    const { data: result, error } = await supabase.rpc("admin_payment_decision", {
      p_order_id: orderId,
      p_payment_status: decision,
    });
    if (error) throw error;
    const order = Array.isArray(result) ? result[0] : result;
    await telegram("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: decision === "verified" ? "✅ To‘lov tasdiqlandi" : "❌ To‘lov rad etildi",
      show_alert: false,
    });
    await telegram("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
    if (order) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: orderText(order, decision === "verified" ? "💳 TO‘LOV TASDIQLANDI" : "💳 TO‘LOV RAD ETILDI"),
        disable_web_page_preview: true,
      });
    }
  } catch (e) {
    console.warn("[Admin Telegram bot] payment decision failed:", e.message);
    await telegram("answerCallbackQuery", { callback_query_id: callback.id, text: `Xatolik: ${String(e.message || "qaror saqlanmadi").slice(0, 180)}`, show_alert: true }).catch(() => {});
  }
}

async function bootstrapBaseline() {
  if (!supabase || state.ready) return;
  const { data: orders } = await supabase.from("orders").select("id,status,payment_status,created_at,payment_receipt_path").order("created_at", { ascending: false }).limit(200);
  for (const o of orders || []) state.seenOrders.set(String(o.id), `${o.status}|${o.payment_status}|${o.payment_receipt_path || ""}`);
  const { data: chats } = await supabase.from("chat_messages").select("id").order("created_at", { ascending: false }).limit(100);
  for (const c of chats || []) state.seenChats.add(String(c.id));
  state.ready = true;
}

async function pollDatabase() {
  if (!BOT_TOKEN || !supabase) return;
  try {
    await bootstrapBaseline();

    const { data: orders, error: oe } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (oe) throw oe;
    for (const order of orders || []) {
      const id = String(order.id || "");
      if (!id) continue;
      const signature = `${order.status || ""}|${order.payment_status || ""}|${order.payment_receipt_path || ""}`;
      const previous = state.seenOrders.get(id);
      if (previous === undefined) {
        state.seenOrders.set(id, signature);
        await sendOrderNotification(order, "🛒 YANGI ORDER", true);
      } else if (previous !== signature) {
        state.seenOrders.set(id, signature);
        const paymentChanged = String(previous).split("|")[1] !== String(order.payment_status || "");
        const title = paymentChanged
          ? (String(order.payment_status || "").toLowerCase() === "verified" ? "💳 TO‘LOV TASDIQLANDI" : String(order.payment_status || "").toLowerCase() === "rejected" ? "💳 TO‘LOV RAD ETILDI" : "🧾 CHEK YUKLANDI")
          : "📦 ORDER STATUS O‘ZGARDI";
        await sendOrderNotification(order, title, Boolean(order.payment_receipt_path && !String(previous).includes(String(order.payment_receipt_path))));
      }
    }

    const { data: chats, error: ce } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("sender", "customer")
      .order("created_at", { ascending: false })
      .limit(40);
    if (ce) throw ce;
    for (const chat of chats || []) {
      const id = String(chat.id || "");
      if (!id || state.seenChats.has(id)) continue;
      state.seenChats.add(id);
      const meta = chat.metadata || {};
      await notify(`💬 ONLINE CHAT\n\n👤 Mijoz: ${meta.first_name || "Mijoz"}${meta.last_name ? ` ${meta.last_name}` : ""}${meta.telegram_username ? ` (@${meta.telegram_username})` : meta.telegram_id ? `\n🆔 Telegram ID: ${meta.telegram_id}` : ""}\n📞 ${meta.phone || ""}\n📝 Xabar:\n${String(chat.text || "").slice(0, 1800)}`);
    }

    if (state.seenOrders.size > 400) {
      const keep = new Set((orders || []).map(o => String(o.id)));
      for (const id of state.seenOrders.keys()) if (!keep.has(id)) state.seenOrders.delete(id);
    }
    if (state.seenChats.size > 400) state.seenChats = new Set([...state.seenChats].slice(-200));
  } catch (e) {
    console.warn("[Admin Telegram bot] DB polling failed:", e.message);
  }
}

if (BOT_TOKEN && supabase) {
  console.log("[Admin Telegram bot] live order/chat notification bridge enabled.");
  setTimeout(() => { void discoverAdminChats(); void pollDatabase(); }, 1500);
  setInterval(() => { void discoverAdminChats(); }, 3000);
  setInterval(() => { void pollDatabase(); }, 2500);
} else {
  console.warn("[Admin Telegram bot] TELEGRAM_ADMIN_BOT_TOKEN or Supabase is not configured; admin alerts disabled.");
}
