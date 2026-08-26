// Wrap the already-registered manual-card admin payment route so verification/rejection
// always produces a direct Telegram notification. The later paymentConfirmationRuntime
// cannot replace an earlier Express route, so this wrapper is intentionally applied to
// the existing route stack.
(() => {
  const stack = app._router?.stack || [];
  const layer = stack.find((item) => item.route?.path === "/api/admin/orders/:id/payment" && item.route?.methods?.put);
  if (!layer?.route?.stack?.length) return;
  const index = layer.route.stack.length - 1;
  const original = layer.route.stack[index].handle;
  layer.route.stack[index].handle = async (req, res, next) => {
    let payload = null;
    const originalJson = res.json.bind(res);
    res.json = (body) => { payload = body; return originalJson(body); };
    await original(req, res, next);
    try {
      if (!payload?.success || !payload?.data) return;
      const order = payload.data;
      const status = String(req.body?.payment_status || "");
      if (!order.telegram_id || !TELEGRAM_BOT_TOKEN || !["verified", "rejected"].includes(status)) return;
      const text = status === "verified"
        ? `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${order.order_number}\nSumma: ${Math.round(Number(order.total)||0).toLocaleString("uz-UZ")} so‘m\n\nBuyurtma holati: ${order.status || "Qabul qilindi"}`
        : `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${order.order_number}\nIltimos, to‘lov chekini qayta yuboring.`;
      await telegramApi("sendMessage", { chat_id: Number(order.telegram_id), text, disable_web_page_preview: true });
    } catch (error) { console.warn("Admin payment direct Telegram notification failed:", error.message); }
  };
})();
