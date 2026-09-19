// Telegram runtime integration loaded BEFORE backend/index.js.
// Keeps Telegram launch/notification behavior in one place.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY) : null;
const WEB_APP_URL = (process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829").trim();
const STORE_TEXT = "🛍 Do‘konni ochish";
const PAYMENT_LABELS = { pending: "To‘lov kutilmoqda", receipt_uploaded: "Chek yuborildi — admin tekshiradi", verified: "To‘lov tasdiqlandi ✓", rejected: "Chek rad etildi — qayta yuboring" };
const AUTH_KEY = SUPABASE_SECRET_KEY || "guli-auth";
const authHash = (value) => crypto.createHmac("sha256", AUTH_KEY).update(String(value)).digest("hex");
const normalizePhone = (value) => { let v = String(value || "").trim().replace(/[^\d+]/g, ""); if (v.startsWith("00")) v = "+" + v.slice(2); if (!v.startsWith("+")) v = "+" + v; return v; };
const validPhone = (v) => /^\+[1-9]\d{7,14}$/.test(v);
async function telegramApi(method, body) { if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan"); const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!result.ok) throw new Error(result.description || `Telegram ${method} xatosi`); return result.result; }
function storeMenuKeyboard() { return { remove_keyboard: true }; }
function authContactKeyboard() { return { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }; }
function orderText(order) { const items = Array.isArray(order?.items) ? order.items : []; const lines = items.slice(0, 15).map((item) => { const product = item?.product || item || {}; const code = product.product_code || item?.product_code || ""; const name = product.name || product.title || "Mahsulot"; const qty = Number(item?.quantity || item?.qty || 1); return `• ${name}${code ? ` [${code}]` : ""} × ${qty}`; }); const paymentStatus = PAYMENT_LABELS[String(order?.payment_status || "pending")] || "To‘lov kutilmoqda"; return ["🛍 <b>Guli Market — BUYURTMA</b>",`№ <b>${String(order?.order_number || "—")}</b>`,"","<b>Sotib olingan mahsulotlar:</b>",lines.join("\n") || "• Mahsulot ma’lumoti mavjud emas","",`💰 <b>Jami:</b> ${Math.round(Number(order?.total || 0)).toLocaleString("uz-UZ")} so‘m`,`📌 <b>Hozirgi status:</b> ${String(order?.status || "Qabul qilindi")}`,`💳 <b>To‘lov:</b> ${paymentStatus}`,"","Status o‘zgarsa, ushbu xabar avtomatik yangilanadi."].join("\n"); }
async function findOrder(order) { if (!supabase || !order?.order_number) return order; try { const { data } = await supabase.from("orders").select("*").eq("order_number", String(order.order_number)).maybeSingle(); return data || order; } catch { return order; } }
async function sendOrEditOrder(order) {
  if (!order) return;
  const fullOrder = await findOrder(order);
  const telegramId = Number(fullOrder?.telegram_id || 0);
  if (!telegramId || !fullOrder?.order_number) return;
  const text = orderText(fullOrder);
  const existingId = Number(fullOrder?.telegram_status_message_id || 0) || 0;
  if (existingId) {
    try { await telegramApi("editMessageText", { chat_id: telegramId, message_id: existingId, text, parse_mode: "HTML", disable_web_page_preview: true }); return; }
    catch (err) { if (/message is not modified/i.test(err.message)) return; console.warn("[Telegram customer bot] In-place edit failed, keeping single message:", err.message); return; }
  }
  try { const sent = await telegramApi("sendMessage", { chat_id: telegramId, text, parse_mode: "HTML", disable_web_page_preview: true }); const messageId = Number(sent?.message_id || 0); if (messageId && supabase) await supabase.from("orders").update({ telegram_status_message_id: messageId }).eq("order_number", String(fullOrder.order_number)); }
  catch (error) { console.warn("Telegram order notification failed:", error.message); }
}
async function configureTelegram() { if (!TELEGRAM_BOT_TOKEN) return console.warn("[Telegram] TELEGRAM_BOT_TOKEN sozlanmagan"); try { await telegramApi("setMyCommands", { commands: [{ command: "start", description: "Guli Market do‘konini ochish" }, { command: "shop", description: "Onlayn do‘konni ochish" }] }); await telegramApi("setChatMenuButton", { menu_button: { type: "web_app", text: STORE_TEXT, web_app: { url: WEB_APP_URL } } }); const webhookBase = process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com"; await telegramApi("setWebhook", { url: `${webhookBase}/api/telegram/webhook`, allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post", "callback_query", "my_chat_member", "chat_member"] }); console.log(`[Telegram] menu + commands + webhook configured: ${WEB_APP_URL}`); } catch (error) { console.error("[Telegram] configuration failed:", error.message); } }
function wrapRoute(method, path, after) { const original = express.application[method]; express.application[method] = function patchedRoute(routePath, ...handlers) { if (routePath === path && handlers.length) { const index = handlers.length - 1; const handler = handlers[index]; handlers[index] = async function telegramWrappedHandler(req, res, next) { let payload = null; const originalJson = res.json.bind(res); res.json = (body) => { payload = body; return originalJson(body); }; try { return await handler(req, res, next); } finally { try { await after(req, payload); } catch (error) { console.warn(`[Telegram] ${path} notification failed:`, error.message); } } }; } return original.call(this, routePath, ...handlers); }; }
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
        const fromId = Number(message?.from?.id || chatId || 0);
        try {
          // Browser authentication deep-link. Telegram sends /start auth_<UUID>.
          const authStart = text.match(/^\/start(?:@\w+)?\s+auth_([0-9a-f-]{36})$/i);
          if (chatId && authStart && supabase) {
            const sessionId = authStart[1];
            const { data: session } = await supabase.from("auth_sessions").select("session_id,expires_at,is_verified,exchange_ticket_used").eq("session_id", sessionId).maybeSingle();
            if (!session || session.is_verified || session.exchange_ticket_used || new Date(session.expires_at).getTime() < Date.now()) {
              await telegramApi("sendMessage", { chat_id: chatId, text: "❌ Bu autentifikatsiya havolasi yaroqsiz yoki muddati tugagan. Brauzerdan yangi login sessiyasi boshlang.", reply_markup: storeMenuKeyboard() });
              return res.sendStatus(200);
            }
            await supabase.from("auth_sessions").update({ telegram_id: fromId }).eq("session_id", sessionId).eq("is_verified", false).eq("exchange_ticket_used", false);
            await telegramApi("sendMessage", { chat_id: chatId, text: "🔐 <b>Guli Market autentifikatsiyasi</b>\n\nDavom etish uchun faqat o‘zingizning Telegram telefon raqamingizni yuboring.", parse_mode: "HTML", reply_markup: authContactKeyboard() });
            return res.sendStatus(200);
          }

          if (chatId && /^\/start(?:@\w+)?/i.test(text)) {
            await telegramApi("sendMessage", { chat_id: chatId, text: "🌷 <b>Guli Market</b> ga xush kelibsiz!\n\nAyollar uchun ichki kiyimlar, komplektlar, uy kiyimlari va uy kiyimlarini onlayn buyurtma qilishingiz mumkin.\n\n📦 Mahsulot tanlang → buyurtma bering → HUMO/UZCARD orqali to‘lang → chekni shu oynadan yuboring.\n\nAvval telefon raqamingizni yuboring, keyin Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
            return res.sendStatus(200);
          }

          if (chatId && contact?.phone_number) {
            if (!fromId || !contact.user_id || Number(contact.user_id) !== fromId) {
              await telegramApi("sendMessage", { chat_id: chatId, text: "❌ Faqat Telegram hisobingizga tegishli telefon raqamini yuboring. Raqamni oddiy xabar sifatida yuborish autentifikatsiya qilmaydi.", reply_markup: storeMenuKeyboard() });
              return res.sendStatus(200);
            }
            const phone = normalizePhone(contact.phone_number);
            if (!validPhone(phone)) {
              await telegramApi("sendMessage", { chat_id: chatId, text: "❌ Telefon raqami formati noto‘g‘ri.", reply_markup: storeMenuKeyboard() });
              return res.sendStatus(200);
            }

            if (supabase) {
              const { data: authSession } = await supabase.from("auth_sessions").select("session_id,telegram_id,expires_at,is_verified,exchange_ticket_used,created_at").eq("telegram_id", fromId).eq("is_verified", false).eq("exchange_ticket_used", false).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (authSession) {
                // Telegram itself has already proven ownership of this phone
                // number (contact.user_id === message.from.id, checked
                // above), so the browser session is verified directly here -
                // no separate OTP the user has to type is needed. The
                // browser learns this via GET /api/v1/auth/check-status.
                const { error } = await supabase.from("auth_sessions").update({ phone_number: phone, is_verified: true, verified_at: new Date().toISOString() }).eq("session_id", authSession.session_id).eq("is_verified", false);
                if (error) throw error;
                await supabase.from("telegram_users").upsert({ telegram_id: fromId, username: message?.from?.username || null, first_name: message?.from?.first_name || null, last_name: message?.from?.last_name || null, telegram_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
                await telegramApi("sendMessage", { chat_id: chatId, text: "✅ Telefon raqamingiz tasdiqlandi. Brauzer avtomatik ravishda tizimga kiritmoqda.", reply_markup: storeMenuKeyboard() });
                return res.sendStatus(200);
              }
              await supabase.from("telegram_users").upsert({ telegram_id: fromId, username: message?.from?.username || null, first_name: message?.from?.first_name || null, last_name: message?.from?.last_name || null, telegram_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
            }
            await telegramApi("sendMessage", { chat_id: chatId, text: "✅ Telefon raqamingiz Telegram orqali tasdiqlandi. Endi Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: storeMenuKeyboard() });
            return res.sendStatus(200);
          }

          if (chatId && /^\+?\d[\d\s().-]{6,}$/.test(text)) {
            await telegramApi("sendMessage", { chat_id: chatId, text: "❌ Telefon raqamini xabar sifatida yuborish autentifikatsiya qilmaydi. 📱 <b>Telefon raqamimni yuborish</b> tugmasidan foydalaning.", parse_mode: "HTML" });
            return res.sendStatus(200);
          }
          if (chatId && /^\/(shop|store)(?:@\w+)?/i.test(text)) {
            await telegramApi("sendMessage", { chat_id: chatId, text: "🛍 Do‘kon Telegram menyusidagi tugma orqali ochiladi.", reply_markup: storeMenuKeyboard() });
            return res.sendStatus(200);
          }
          return await handler(req, res, next);
        } catch (error) { console.error("[Telegram] webhook handler error:", error.message); return res.sendStatus(200); }
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
