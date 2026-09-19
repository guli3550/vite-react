const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const URL = String(process.env.SUPABASE_URL || "").trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const db = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

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
  const telegramId = Number(order?.telegram_id || 0);
  const status = String(order?.status || "").trim();
  if (!telegramId || !status || status === "⏳ Buyurtma kutilmoqda") return { sent: false, reason: "not_applicable" };

  const orderNo = String(order?.order_number || order?.id || "—");
  const version = String(order?.updated_at || order?.status_updated_at || status);
  const key = `customer-order-status:${order?.id}:${status}:${version}`;
  const c = await claim(key, "customer_order_status_notice", order?.id);
  if (!c.claimed) return { sent: false, reason: "duplicate" };

  const text = [
    "📦 GULI — BUYURTMA HOLATI",
    "",
    `№ ${orderNo}`,
    `Hozirgi holat: ${status}`,
    `💰 Jami: ${money(order?.total)}`,
    "",
    "Buyurtmalarim bo‘limida batafsil ko‘rishingiz mumkin.",
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

async function notifyCustomerPayment(order) {
  const telegramId = Number(order?.telegram_id || 0);
  const paymentStatus = String(order?.payment_status || "").trim().toLowerCase();
  if (!telegramId || !["verified", "rejected"].includes(paymentStatus)) return { sent: false, reason: "not_applicable" };

  const orderNo = String(order?.order_number || order?.id || "—");
  const version = String(order?.updated_at || Date.now());
  const key = `customer-payment:${order?.id}:${paymentStatus}:${version}`;
  const c = await claim(key, "customer_payment_notice", order?.id);
  if (!c.claimed) return { sent: false, reason: "duplicate" };

  const text = paymentStatus === "verified"
    ? [
        "✅ GULI — TO‘LOV TASDIQLANDI",
        "",
        `Buyurtma № ${orderNo}`,
        `💰 Summa: ${money(order?.total)}`,
        `📦 Buyurtma holati: ${String(order?.status || "Qabul qilindi")}`,
      ].join("\n")
    : [
        "⚠️ GULI — TO‘LOV CHEKI RAD ETILDI",
        "",
        `Buyurtma № ${orderNo}`,
        "Iltimos, to‘lov chekini qayta yuboring.",
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

module.exports = { notifyCustomerOrderStatus, notifyCustomerPayment };
