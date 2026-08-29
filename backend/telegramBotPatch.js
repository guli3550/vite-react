// GULI Telegram bot UX + live order status notifications.
(() => {
  const DEFAULT_WEB_APP_URL = "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829";
  const configuredWebAppUrl = String(process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || DEFAULT_WEB_APP_URL).trim();
  const WEB_APP_URL = /[?&]tgapp=/.test(configuredWebAppUrl)
    ? configuredWebAppUrl
    : `${configuredWebAppUrl}${configuredWebAppUrl.includes("?") ? "&" : "?"}tgapp=v20260829`;
  const STORE_TEXT = "🛍 Do‘konni ochish";
  const paymentLabels = { pending: "To‘lov kutilmoqda", receipt_uploaded: "Chek yuborildi — admin tekshiradi", verified: "To‘lov tasdiqlandi ✓", rejected: "Chek rad etildi — qayta yuboring" };
  const removeReplyKeyboard = { remove_keyboard: true };

  const orderText = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const lines = items.slice(0, 12).map((item) => {
      const p = item?.product || item || {};
      const code = p.product_code || item?.product_code || "";
      const name = p.name || p.title || "Mahsulot";
      const qty = Number(item?.quantity || item?.qty || 1);
      const price = Math.round(Number(p.price || item?.price || 0));
      return `• ${name}${code ? ` [${code}]` : ""} × ${qty}${price ? ` — ${price.toLocaleString("uz-UZ")} so‘m` : ""}`;
    });
    const payment = paymentLabels[String(order?.payment_status || "pending")] || "To‘lov kutilmoqda";
    return [`🛍 <b>GULI PREMIUM — BUYURTMA</b>`,`№ <b>${String(order?.order_number || "—")}</b>`,"","<b>Sotib olingan mahsulotlar:</b>",lines.join("\n") || "• Mahsulot ma’lumoti mavjud emas","",`💰 <b>Jami:</b> ${Math.round(Number(order?.total || 0)).toLocaleString("uz-UZ")} so‘m`,`📌 <b>Hozirgi status:</b> ${String(order?.status || "Qabul qilindi")}`,`💳 <b>To‘lov:</b> ${payment}`,"","Status o‘zgarsa, ushbu xabar yangilanadi."].join("\n");
  };

  async function sendOrEditOrderMessage(order, telegramId, existingMessageId = null) {
    if (!telegramId || !order?.order_number) return null;
    const chatId = Number(telegramId), text = orderText(order);
    try {
      if (existingMessageId) {
        await telegramApi("editMessageText", { chat_id: chatId, message_id: Number(existingMessageId), text, parse_mode: "HTML", reply_markup: { inline_keyboard: [] }, disable_web_page_preview: true });
        return Number(existingMessageId);
      }
    } catch {}
    try {
      const sent = await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
      const messageId = Number(sent?.message_id || 0) || null;
      if (messageId) await supabase.from("orders").update({ telegram_status_message_id: messageId }).eq("order_number", String(order.order_number));
      return messageId;
    } catch (error) { console.warn("Telegram order notification failed:", error.message); return null; }
  }

  async function configureTelegramBot() {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
      await telegramApi("setMyCommands", { commands: [{ command: "start", description: "GULI do‘konini ochish" }, { command: "shop", description: "Onlayn do‘konni ochish" }] });
      await telegramApi("setChatMenuButton", { menu_button: { type: "web_app", text: STORE_TEXT, web_app: { url: WEB_APP_URL } } });
      console.log(`Telegram Mini App menu configured: ${WEB_APP_URL}`);
    } catch (error) { console.warn("Telegram bot menu configuration failed:", error.message); }
  }

  const webhookLayer = (app._router?.stack || []).find((layer) => layer.route?.path === "/api/telegram/webhook" && layer.route?.methods?.post);
  if (webhookLayer?.route?.stack?.length) {
    const original = webhookLayer.route.stack[webhookLayer.route.stack.length - 1].handle;
    webhookLayer.route.stack[webhookLayer.route.stack.length - 1].handle = async (req, res, next) => {
      try {
        const message = req.body?.message, chatId = message?.chat?.id, text = String(message?.text || "").trim(), contact = message?.contact;
        if (chatId && /^\/start(?:@\w+)?/i.test(text)) {
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "🌷 <b>GULI_3550 Online Market</b> ga xush kelibsiz!\n\nAyollar uchun ichki kiyimlar, komplektlar, uy kiyimlari va boshqa mahsulotlarni onlayn buyurtma qilishingiz mumkin.\n\n📦 Mahsulot tanlang → buyurtma bering → HUMO/UZCARD orqali to‘lang → chekni shu oynadan yuboring.\n\nAvval telefon raqamingizni yuboring, keyin Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: { keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
          return res.sendStatus(200);
        }
        if (chatId && /^\/(shop|store)(?:@\w+)?/i.test(text)) {
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "🛍 Do‘kon Telegram menyusidagi tugma orqali ochiladi.", reply_markup: removeReplyKeyboard });
          return res.sendStatus(200);
        }
        if (chatId && contact?.phone_number) {
          const telegramUser = message?.from || {}, ownerId = Number(contact.user_id || telegramUser.id || chatId);
          if (ownerId) await supabase.from("telegram_users").upsert({ telegram_id: ownerId, username: telegramUser.username || null, first_name: telegramUser.first_name || null, last_name: telegramUser.last_name || null, telegram_phone: String(contact.phone_number), updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
          await telegramApi("sendMessage", { chat_id: Number(chatId), text: "✅ Telefon raqamingiz saqlandi. Endi Telegram menyusidagi <b>Do‘konni ochish</b> tugmasidan foydalaning.", parse_mode: "HTML", reply_markup: removeReplyKeyboard });
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
    layer.route.stack[index].handle = async (req, res, next) => {
      let payload = null; const originalJson = res.json.bind(res); res.json = (body) => { payload = body; return originalJson(body); };
      try { await original(req, res, next); } finally { try { await after(req, payload); } catch (error) { console.warn("Telegram order post-action failed:", error.message); } }
    };
  }
  const notifyOrder = async (req, payload) => {
    if (!payload?.success || !payload?.data) return;
    const order = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    const telegramId = Number(order?.telegram_id || req.telegramUser?.id || 0);
    if (!telegramId) return;
    await sendOrEditOrderMessage(order, telegramId, Number(order?.telegram_status_message_id || 0) || null);
  };
  wrapRoute("/api/orders", "post", notifyOrder);
  wrapRoute("/api/guest/orders", "post", notifyOrder);
  wrapRoute("/api/admin/orders/:id", "put", async (req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrderMessage(payload.data, Number(payload.data.telegram_id || 0), Number(payload.data.telegram_status_message_id || 0) || null); });
  wrapRoute("/api/admin/orders/:id/payment", "put", async (req, payload) => { if (payload?.success && payload?.data) await sendOrEditOrderMessage(payload.data, Number(payload.data.telegram_id || 0), Number(payload.data.telegram_status_message_id || 0) || null); });
  configureTelegramBot().catch(() => {});
})();
