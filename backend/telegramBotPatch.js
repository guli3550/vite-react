// GULI Telegram bot UX + live order status notifications + canonical phone authentication.
(() => {
  const crypto = require("crypto");
  const DEFAULT_WEB_APP_URL = "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829";
  const configuredWebAppUrl = String(process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || DEFAULT_WEB_APP_URL).trim();
  const WEB_APP_URL = /[?&]tgapp=/.test(configuredWebAppUrl)
    ? configuredWebAppUrl
    : `${configuredWebAppUrl}${configuredWebAppUrl.includes("?") ? "&" : "?"}tgapp=v20260829`;
  const STORE_TEXT = "🛍 Do‘konni ochish";
  const paymentLabels = { pending: "To‘lov kutilmoqda", receipt_uploaded: "Chek yuborildi — admin tekshiradi", verified: "To‘lov tasdiqlandi ✓", rejected: "Chek rad etildi — qayta yuboring" };
  const removeReplyKeyboard = { remove_keyboard: true };
  const AUTH_SESSION_MS = 5 * 60 * 1000;
  const OTP_MS = 3 * 60 * 1000;
  const AUTH_KEY = process.env.SUPABASE_SECRET_KEY || "guli-auth";
  const authHash = (value) => crypto.createHmac("sha256", AUTH_KEY).update(String(value)).digest("hex");
  const normalizePhone = (value) => { let v = String(value || "").trim().replace(/[^\d+]/g, ""); if (v.startsWith("00")) v = "+" + v.slice(2); if (!v.startsWith("+")) v = "+" + v; return v; };
  const validPhone = (v) => /^\+[1-9]\d{7,14}$/.test(v);
  const randomOtp = () => crypto.randomInt(100000, 1000000).toString();

  const orderText = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const lines = items.slice(0, 12).map((item) => { const p = item?.product || item || {}; const code = p.product_code || item?.product_code || ""; const name = p.name || p.title || "Mahsulot"; const qty = Number(item?.quantity || item?.qty || 1); const price = Math.round(Number(p.price || item?.price || 0)); return `• ${name}${code ? ` [${code}]` : ""} × ${qty}${price ? ` — ${price.toLocaleString("uz-UZ")} so‘m` : ""}`; });
    const payment = paymentLabels[String(order?.payment_status || "pending")] || "To‘lov kutilmoqda";
    return [`🛍 <b>GULI PREMIUM — BUYURTMA</b>`,`№ <b>${String(order?.order_number || "—")}</b>`,"","<b>Sotib olingan mahsulotlar:</b>",lines.join("\n") || "• Mahsulot ma’lumoti mavjud emas","",`💰 <b>Jami:</b> ${Math.round(Number(order?.total || 0)).toLocaleString("uz-UZ")} so‘m`,`📌 <b>Hozirgi status:</b> ${String(order?.status || "Qabul qilindi")}`,`💳 <b>To‘lov:</b> ${payment}`,"","Status o‘zgarsa, ushbu xabar yangilanadi."].join("\n");
  };

  async function sendOrEditOrderMessage(order, telegramId, existingMessageId = null) {
    if (!telegramId || !order?.order_number) return null;
    const chatId = Number(telegramId), text = orderText(order);
    if (existingMessageId) { try { await telegramApi("editMessageText", { chat_id: chatId, message_id: Number(existingMessageId), text, parse_mode: "HTML", reply_markup: { inline_keyboard: [] }, disable_web_page_preview: true }); return Number(existingMessageId); } catch (err) { if (/message is not modified/i.test(err.message)) return Number(existingMessageId); console.warn("[Telegram bot] Edit in place failed:", err.message); return Number(existingMessageId); } }
    try { const sent = await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }); const messageId = Number(sent?.message_id || 0) || null; if (messageId) await supabase.from("orders").update({ telegram_status_message_id: messageId }).eq("order_number", String(order.order_number)); return messageId; } catch (error) { console.warn("Telegram order notification failed:", error.message); return null; }
  }

  async function configureTelegramBot() {
    if (!TELEGRAM_BOT_TOKEN) return;
    try { await telegramApi("setMyCommands", { commands: [{ command: "start", description: "GULI do‘konini ochish" }, { command: "shop", description: "Onlayn do‘konni ochish" }] }); await telegramApi("setChatMenuButton", { menu_button: { type: "web_app", text: STORE_TEXT, web_app: { url: WEB_APP_URL } } }); console.log(`Telegram Mini App menu configured: ${WEB_APP_URL}`); } catch (error) { console.warn("Telegram bot menu configuration failed:", error.message); }
  }

  const webhookLayer = (app._router?.stack || []).find((layer) => layer.route?.path === "/api/telegram/webhook" && layer.route?.methods?.post);
  if (webhookLayer?.route?.stack?.length) {
    const original = webhookLayer.route.stack[webhookLayer.route.stack.length - 1].handle;
    webhookLayer.route.stack[webhookLayer.route.stack.length - 1].handle = async (req, res, next) => {
      try {
        const message = req.body?.message, chatId = message?.chat?.id, text = String(message?.text || "").trim(), contact = message?.contact, fromId = Number(message?.from?.id || chatId || 0);

        // Browser authentication entry: /start auth_<UUID> creates a short-lived auth session.
        const authStart = text.match(/^\/start(?:@\w+)?\s+auth_([0-9a-f-]{36})$/i);
        if (chatId && authStart) {
          const sessionId = authStart[1];
          const { data: session } = await supabase.from("auth_sessions").select("session_id,expires_at,is_verified,otp_used").eq("session_id", sessionId).maybeSingle();
          if (!session || session.is_verified || new Date(session.expires_at).getTime() < Date.now()) {
            await telegramApi("sendMessage", { chat_id: Number(chatId), text: "❌ Bu autentifikatsiya havolasi yaroqsiz yoki muddati tugagan. Brauzerdan yangi login sessiyasi boshlang.", reply_markup: removeReplyKeyboard });
            return res.sendStatus(200);
          }
          await supabase.from("auth_sessions").update({ telegram_id: fromId }).eq("session_id", sessionId).eq("is_verified", false);
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "🔐 <b>GULI autentifikatsiyasi</b>\n\nDavom etish uchun faqat o‘zingizning Telegram telefon raqamingizni yuboring.", parse_mode: "HTML", reply_markup: { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
          return res.sendStatus(200);
        }

        if (chatId && /^\/start(?:@\w+)?/i.test(text)) {
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "🌷 <b>GULI_3550 Online Market</b> ga xush kelibsiz!\n\nAyollar uchun ichki kiyimlar, komplektlar, uy kiyimlari va boshqa mahsulotlarni onlayn buyurtma qilishingiz mumkin.\n\n📦 Mahsulot tanlang → buyurtma bering → HUMO/UZCARD orqali to‘lang → chekni shu oynadan yuboring.\n\nAvval telefon raqamingizni yuboring, keyin Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
          return res.sendStatus(200);
        }

        if (chatId && contact?.phone_number) {
          // Contact messages are trusted only when Telegram identifies the contact as the sender.
          if (!fromId || !contact.user_id || Number(contact.user_id) !== fromId) {
            await telegramApi("sendMessage", { chat_id: Number(chatId), text: "❌ Faqat Telegram hisobingizga tegishli telefon raqamini yuboring. Raqamni oddiy xabar sifatida yuborish autentifikatsiya qilmaydi.", reply_markup: removeReplyKeyboard });
            return res.sendStatus(200);
          }
          const phone = normalizePhone(contact.phone_number);
          if (!validPhone(phone)) {
            await telegramApi("sendMessage", { chat_id: Number(chatId), text: "❌ Telefon raqami formati noto‘g‘ri.", reply_markup: removeReplyKeyboard });
            return res.sendStatus(200);
          }

          const { data: authSession } = await supabase.from("auth_sessions").select("session_id,telegram_id,expires_at,is_verified,otp_used,otp_hash,created_at").eq("telegram_id", fromId).eq("is_verified", false).eq("otp_used", false).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (authSession) {
            const otp = randomOtp();
            await supabase.from("auth_sessions").update({ phone_number: phone, otp_hash: authHash(otp), otp_attempts: 0 }).eq("session_id", authSession.session_id).eq("is_verified", false).eq("otp_used", false);
            await supabase.from("telegram_users").upsert({ telegram_id: fromId, username: message?.from?.username || null, first_name: message?.from?.first_name || null, last_name: message?.from?.last_name || null, telegram_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
            await telegramApi("sendMessage", { chat_id: Number(chatId), text: `✅ Telefon raqamingiz Telegram orqali tasdiqlandi.\n\n🔢 <b>GULI tasdiqlash kodi:</b> <code>${otp}</code>\n\nKod 3 daqiqa amal qiladi va bir marta ishlatiladi. Kodni brauzerdagi GULI oynasiga kiriting.`, parse_mode: "HTML", reply_markup: removeReplyKeyboard });
            return res.sendStatus(200);
          }

          await supabase.from("telegram_users").upsert({ telegram_id: fromId, username: message?.from?.username || null, first_name: message?.from?.first_name || null, last_name: message?.from?.last_name || null, telegram_phone: phone, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "✅ Telefon raqamingiz Telegram orqali tasdiqlandi. Endi Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: removeReplyKeyboard });
          return res.sendStatus(200);
        }

        // Do not treat arbitrary text containing a phone number as authentication.
        if (chatId && /^\+?\d[\d\s().-]{6,}$/.test(text)) {
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "❌ Telefon raqamini xabar sifatida yuborish autentifikatsiya qilmaydi. 📱 <b>Telefon raqamimni yuborish</b> tugmasidan foydalaning.", parse_mode: "HTML" });
          return res.sendStatus(200);
        }

        if (chatId && /^\/(shop|store)(?:@\w+)?/i.test(text)) {
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "🛍 Do‘kon Telegram menyusidagi tugma orqali ochiladi.", reply_markup: removeReplyKeyboard });
          return res.sendStatus(200);
        }
        return original(req, res, next);
      } catch (error) { console.error("Telegram enhanced webhook error:", error); return res.sendStatus(200); }
    };
  }

  function wrapRoute(path, method, after) {
    const layer = (app._router?.stack || []).find((item) => item.route?.path === path && item.route?.methods?.[method]);
    if (!layer?.route?.stack?.length) return;
    const index = layer.route.stack.length - 1, original = layer.route.stack[index].handle;
    layer.route.stack[index].handle = async (req, res, next) => { let payload = null; const originalJson = res.json.bind(res); res.json = (body) => { payload = body; return originalJson(body); }; try { await original(req, res, next); } finally { try { await after(req, payload); } catch (error) { console.warn("Telegram order post-action failed:", error.message); } } };
  }
  const notifyOrder = async (req, payload) => { if (!payload?.success || !payload?.data) return; const order = Array.isArray(payload.data) ? payload.data[0] : payload.data; const telegramId = Number(order?.telegram_id || req.telegramUser?.id || 0); if (!telegramId) return; await sendOrEditOrderMessage(order, telegramId, Number(order?.telegram_status_message_id || 0) || null); };
  wrapRoute("/api/orders", "post", notifyOrder);
  wrapRoute("/api/guest/orders", "post", notifyOrder);
  wrapRoute("/api/admin/orders/:id", "put", async (req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrderMessage(payload.data, Number(payload.data.telegram_id || 0), Number(payload.data.telegram_status_message_id || 0) || null); });
  wrapRoute("/api/admin/orders/:id/payment", "put", async (req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrderMessage(payload.data, Number(payload.data.telegram_id || 0), Number(payload.data.telegram_status_message_id || 0) || null); });
  configureTelegramBot().catch(() => {});
})();
