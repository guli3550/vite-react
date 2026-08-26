// Telegram runtime integration loaded BEFORE backend/index.js.
// Keeps Telegram launch/notification behavior in one place.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY) : null;
const WEB_APP_URL = "https://vite-react-guli3550.vercel.app/?tgapp=v20260826";
const STORE_TEXT = "🛍 Do‘konni ochish";
const PAYMENT_LABELS = {
  pending: "To‘lov kutilmoqda",
  receipt_uploaded: "Chek yuborildi — admin tekshiradi",
  verified: "To‘lov tasdiqlandi ✓",
  rejected: "Chek rad etildi — qayta yuboring",
};

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram ${method} xatosi`);
  return result.result;
}

// The persistent Telegram menu button is the single official Mini App launcher.
// Order-status messages intentionally do not contain a second web_app/inline launcher.
function storeMenuKeyboard() {
  return { remove_keyboard: true };
}

function orderText(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const lines = items.slice(0, 15).map((item) => {
    const product = item?.product || item || {};
    const code = product.product_code || item?.product_code || "";
    const name = product.name || product.title || "Mahsulot";
    const qty = Number(item?.quantity || item?.qty || 1);
    return `• ${name}${code ? ` [${code}]` : ""} × ${qty}`;
  });
  const paymentStatus = PAYMENT_LABELS[String(order?.payment_status || "pending")] || "To‘lov kutilmoqda";
  return [
    "🛍 <b>GULI PREMIUM — BUYURTMA</b>",
    `№ <b>${String(order?.order_number || "—")}</b>`, "",
    "<b>Sotib olingan mahsulotlar:</b>", lines.join("\n") || "• Mahsulot ma’lumoti mavjud emas", "",
    `💰 <b>Jami:</b> ${Math.round(Number(order?.total || 0)).toLocaleString("uz-UZ")} so‘m`,
    `📌 <b>Hozirgi status:</b> ${String(order?.status || "Qabul qilindi")}`,
    `💳 <b>To‘lov:</b> ${paymentStatus}`, "",
    "Status o‘zgarsa, ushbu xabar avtomatik yangilanadi.",
  ].join("\n");
}

async function findOrder(order) {
  if (!supabase || !order?.order_number) return order;
  try {
    const { data } = await supabase.from("orders").select("*").eq("order_number", String(order.order_number)).maybeSingle();
    return data || order;
  } catch { return order; }
}

async function sendOrEditOrder(order) {
  if (!order) return;
  const fullOrder = await findOrder(order);
  const telegramId = Number(fullOrder?.telegram_id || 0);
  if (!telegramId || !fullOrder?.order_number) return;
  const text = orderText(fullOrder);
  const existingId = Number(fullOrder?.telegram_status_message_id || 0) || 0;
  if (existingId) {
    try {
      // Explicitly clear any legacy inline launcher that may still be attached.
      await telegramApi("editMessageText", {
        chat_id: telegramId,
        message_id: existingId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
        disable_web_page_preview: true,
      });
      return;
    } catch {}
  }
  try {
    const sent = await telegramApi("sendMessage", {
      chat_id: telegramId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    const messageId = Number(sent?.message_id || 0);
    if (messageId && supabase) await supabase.from("orders").update({ telegram_status_message_id: messageId }).eq("order_number", String(fullOrder.order_number));
  } catch (error) { console.warn("Telegram order notification failed:", error.message); }
}

async function configureTelegram() {
  if (!TELEGRAM_BOT_TOKEN) return console.warn("[Telegram] TELEGRAM_BOT_TOKEN sozlanmagan");
  try {
    await telegramApi("setMyCommands", { commands: [
      { command: "start", description: "GULI do‘konini ochish" },
      { command: "shop", description: "Onlayn do‘konni ochish" },
    ] });
    await telegramApi("setChatMenuButton", { menu_button: { type: "web_app", text: STORE_TEXT, web_app: { url: WEB_APP_URL } } });
    const webhookBase = process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com";
    await telegramApi("setWebhook", { url: `${webhookBase}/api/telegram/webhook` });
    console.log(`[Telegram] menu + commands + webhook configured: ${WEB_APP_URL}`);
  } catch (error) { console.error("[Telegram] configuration failed:", error.message); }
}

function wrapRoute(method, path, after) {
  const original = express.application[method];
  express.application[method] = function patchedRoute(routePath, ...handlers) {
    if (routePath === path && handlers.length) {
      const index = handlers.length - 1;
      const handler = handlers[index];
      handlers[index] = async function telegramWrappedHandler(req, res, next) {
        let payload = null;
        const originalJson = res.json.bind(res);
        res.json = (body) => { payload = body; return originalJson(body); };
        try { return await handler(req, res, next); }
        finally { try { await after(req, payload); } catch (error) { console.warn(`[Telegram] ${path} notification failed:`, error.message); } }
      };
    }
    return original.call(this, routePath, ...handlers);
  };
}

function wrapWebhook() {
  const original = express.application.post;
  express.application.post = function patchedPost(routePath, ...handlers) {
    if (routePath === "/api/telegram/webhook" && handlers.length) {
      const index = handlers.length - 1;
      const handler = handlers[index];
      handlers[index] = async function telegramWebhookHandler(req, res, next) {
        const message = req.body?.message;
        const chatId = Number(message?.chat?.id || 0);
        const text = String(message?.text || "").trim();
        const contact = message?.contact;
        try {
          if (chatId && /^\/start(?:@\w+)?/i.test(text)) {
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "🌷 <b>GULI_3550 Online Market</b> ga xush kelibsiz!\n\nAyollar uchun ichki kiyimlar, komplektlar, uy kiyimlari va uy kiyimlarini onlayn buyurtma qilishingiz mumkin.\n\n📦 Mahsulot tanlang → buyurtma bering → HUMO/UZCARD orqali to‘lang → chekni shu oynadan yuboring.\n\nAvval telefon raqamingizni yuboring, keyin Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.",
              parse_mode: "HTML",
              reply_markup: { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
            });
            return res.sendStatus(200);
          }
          if (chatId && /^\/(shop|store)(?:@\w+)?/i.test(text)) {
            // Do not create a second launcher in the chat. The persistent Telegram
            // menu button is the single official Mini App entry point.
            await telegramApi("sendMessage", { chat_id: chatId, text: "🛍 Do‘kon Telegram menyusidagi tugma orqali ochiladi.", reply_markup: storeMenuKeyboard() });
            return res.sendStatus(200);
          }
          if (chatId && contact?.phone_number) {
            const from = message?.from || {};
            const telegramId = Number(contact.user_id || from.id || chatId);
            if (telegramId && supabase) {
              await supabase.from("telegram_users").upsert({
                telegram_id: telegramId, username: from.username || null, first_name: from.first_name || null,
                last_name: from.last_name || null, telegram_phone: String(contact.phone_number), updated_at: new Date().toISOString(),
              }, { onConflict: "telegram_id" });
            }
            await telegramApi("sendMessage", {
              chat_id: chatId,
              text: "✅ Telefon raqamingiz saqlandi. Endi Telegram yuqorisidagi <b>Do‘konni ochish</b> menyu tugmasidan kiring.",
              parse_mode: "HTML",
              reply_markup: storeMenuKeyboard(),
            });
            return res.sendStatus(200);
          }
          return await handler(req, res, next);
        } catch (error) {
          console.error("[Telegram] webhook handler error:", error.message);
          return res.sendStatus(200);
        }
      };
    }
    return original.call(this, routePath, ...handlers);
  };
}

wrapWebhook();
wrapRoute("post", "/api/orders", async (_req, payload) => { const order = Array.isArray(payload?.data) ? payload.data[0] : payload?.data; if (payload?.success && order) await sendOrEditOrder(order); });
wrapRoute("post", "/api/guest/orders", async (_req, payload) => { const order = Array.isArray(payload?.data) ? payload.data[0] : payload?.data; if (payload?.success && order) await sendOrEditOrder(order); });
wrapRoute("put", "/api/admin/orders/:id", async (_req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrder(payload.data); });
wrapRoute("put", "/api/admin/orders/:id/payment", async (_req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrder(payload.data); });

void configureTelegram();
