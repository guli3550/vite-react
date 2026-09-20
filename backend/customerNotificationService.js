const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const URL = String(process.env.SUPABASE_URL || "").trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const db = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function sendTelegramMediaGroup(chatId, media) {
  if (!BOT || !chatId || !Array.isArray(media) || !media.length) return { sent: false, reason: "not_configured" };
  const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: Number(chatId), media }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return { sent: true, message_ids: (j.result || []).map(x => x.message_id).filter(Boolean) };
}

async function signedReceiptUrl(order) {
  const path = String(order?.payment_receipt_path || "").replace(/^\/+/, "");
  if (!path || !db || /\.pdf$/i.test(path)) return "";
  try {
    const { data, error } = await db.storage.from("payment-receipts").createSignedUrl(path, 3600);
    if (error) return "";
    return data?.signedUrl || "";
  } catch { return ""; }
}

function productImageUrls(order) {
  const out = [];
  for (const item of Array.isArray(order?.items) ? order.items : []) {
    const p = item?.product || item?.product_data || item?.productDetails || {};
    const candidates = [
      item?.image, item?.image_url, item?.photo,
      p?.image, p?.image_url,
      ...(Array.isArray(p?.images) ? p.images : []),
      ...(Array.isArray(item?.images) ? item.images : []),
    ];
    const url = candidates.map(x => String(x || "").trim()).find(x => /^https?:\/\//i.test(x));
    if (url && !out.includes(url)) out.push(url);
  }
  return out.slice(0, 9);
}

function customerOrderCaption(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const lines = items.slice(0, 10).map((item, index) => {
    const p = item?.product || item?.product_data || item?.productDetails || item || {};
    const name = p?.name || p?.title || item?.name || item?.title || "Mahsulot";
    const code = p?.product_code || item?.product_code || "";
    const qty = Number(item?.quantity || item?.qty || 1);
    return `${index + 1}. ${name}${code ? ` #${code}` : ""} × ${qty} dona`;
  });
  const paymentStatus = String(order?.payment_status || "pending").toLowerCase();
  const paymentText = paymentStatus === "verified" ? "✅ To‘lov tasdiqlangan" : paymentStatus === "rejected" ? "❌ To‘lov rad etilgan" : paymentStatus === "receipt_uploaded" ? "🧾 Chek yuklangan — tekshirilmoqda" : "⏳ To‘lov kutilmoqda";
  return [
    `🛍️ Guli Market — BUYURTMA № ${String(order?.order_number || order?.id || "—")}`,
    "",
    `💰 Jami: ${Math.round(Number(order?.total || 0)).toLocaleString("uz-UZ")} so‘m`,
    `💳 To‘lov: ${String(order?.payment || "—")}`,
    `🔎 Holat: ${paymentText}`,
    `📦 Buyurtma: ${String(order?.status || "Qabul qilindi")}`,
    "",
    `👗 Mahsulotlar (${items.length} ta):`,
    lines.join("\n") || "• Mahsulot ma’lumoti mavjud emas",
  ].join("\n").slice(0, 1024);
}

async function deleteTelegramMessage(chatId, messageId) {
  if (!BOT || !chatId || !messageId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chatId), message_id: Number(messageId) }),
    });
  } catch {}
}

async function sendCustomerOrderMedia(chatId, order, includeReceipt = true) {
  const urls = productImageUrls(order);
  if (includeReceipt) {
    const receipt = await signedReceiptUrl(order);
    if (receipt) urls.push(receipt);
  }
  const unique = urls.filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 10);
  if (!unique.length) return { sent: false, reason: "no_media" };
  const media = unique.map((url, index) => ({
    type: "photo",
    media: url,
    ...(index === 0 ? { caption: customerOrderCaption(order) } : {}),
  }));
  const result = await sendTelegramMediaGroup(chatId, media);
  if (order?.telegram_status_message_id) await deleteTelegramMessage(chatId, order.telegram_status_message_id);
  return result;
}

async function sendTelegram(chatId, text) {
  if (!BOT || !chatId || !text) return { sent: false, reason: "not_configured" };
  const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: Number(chatId), text: String(text), disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return { sent: true, message_id: j.result?.message_id || null };
}

async function claim(key, type, orderId) {
  if (!db) return { claimed: true, durable: false };
  const eventKey = crypto.createHash("sha256").update(key).digest("hex");
  const { error } = await db.from("telegram_admin_bot_events").insert({
    event_key: eventKey,
    event_type: type,
    order_id: orderId ? String(orderId) : null,
    status: "processing",
    retry_count: 0,
    updated_at: new Date().toISOString(),
  });
  if (!error) return { claimed: true, durable: true, eventKey };
  if (String(error.code) === "23505") return { claimed: false, duplicate: true };
  console.warn("[Customer notification claim]", error.message);
  return { claimed: true, durable: false };
}

async function release(eventKey) {
  if (!db || !eventKey) return;
  try { await db.from("telegram_admin_bot_events").delete().eq("event_key", eventKey); } catch {}
}

async function markSent(eventKey) {
  if (!db || !eventKey) return;
  try { await db.from("telegram_admin_bot_events").update({ status: "sent", updated_at: new Date().toISOString() }).eq("event_key", eventKey); } catch {}
}

function money(v) {
  return Math.round(Number(v || 0)).toLocaleString("uz-UZ") + " so‘m";
}

async function notifyCustomerOrderStatus(order) {
  // Canonical customer order notification is maintained by telegramAdminBotProduction.
  // Do not send a second standalone Telegram message.
  return { sent: false, reason: "handled_by_canonical_customer_order_message" };
}

async function notifyCustomerPayment(order) {
  // Canonical customer order notification is maintained by telegramAdminBotProduction.
  // Do not send a second standalone Telegram message.
  return { sent: false, reason: "handled_by_canonical_customer_order_message" };
}

async function notifyCustomerAdminChat(message) {
  const telegramId = Number(message?.telegram_id || 0);
  const textBody = String(message?.text || "").trim();
  const messageId = String(message?.id || "").trim();
  if (!telegramId || !textBody) return { sent: false, reason: "not_applicable" };

  const key = `customer-admin-chat:${messageId || telegramId + ":" + textBody + ":" + String(message?.created_at || "")}`;
  const c = await claim(key, "customer_admin_chat_notice", null);
  if (!c.claimed) return { sent: false, reason: "duplicate" };

  const text = [
    "💬 Guli Market — ADMIN XABARI",
    "",
    textBody,
    "",
    "GULI Web App → Online chat bo‘limida suhbatni davom ettirishingiz mumkin.",
  ].join("\n");

  try {
    const result = await sendTelegram(telegramId, text);
    if (c.durable) await markSent(c.eventKey);
    return result;
  } catch (e) {
    if (c.durable) await release(c.eventKey);
    throw e;
  }
}

async function hydrateCustomerOrderMedia(order) {
  if (!db || !order?.id) return order;
  try {
    // Receipt upload handlers intentionally select only payment/ownership fields.
    // Before sending customer media, re-read the canonical order so product
    // images stored inside items/product_data are available to this service.
    const { data, error } = await db.from("orders")
      .select("*")
      .eq("id", String(order.id))
      .maybeSingle();
    if (error || !data) return order;
    return { ...order, ...data };
  } catch {
    return order;
  }
}

async function notifyCustomerReceiptUploaded(order) {
  // Receipt/status media is handled by telegramAdminBotProduction so one order
  // produces exactly one customer-facing Telegram message/album.
  return { sent: false, reason: "handled_by_canonical_customer_order_message" };
}

module.exports = { notifyCustomerOrderStatus, notifyCustomerPayment, notifyCustomerAdminChat, notifyCustomerReceiptUploaded };
