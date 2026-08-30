// Secure server-side Telegram bot diagnostics.
// The bot token is read only from Render/server environment and is never
// accepted from or returned to the browser.
const express = require("express");
const crypto = require("crypto");

function verifyAdmin(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ") || !process.env.ADMIN_SECRET) return false;
  try {
    const [body, sig] = h.slice(7).split(".");
    const expected = crypto.createHmac("sha256", process.env.ADMIN_SECRET).update(body).digest("base64url");
    if (sig !== expected) return false;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.role === "admin" && Number(p.exp) > Date.now();
  } catch {
    return false;
  }
}

const originalGet = express.application.get;
express.application.get = function secureTelegramGet(path, ...handlers) {
  if (path === "/api/admin/telegram-config/test") {
    return originalGet.call(this, path, async (req, res) => {
      if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
      const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
      if (!token) return res.status(503).json({ success: false, message: "Render serverida TELEGRAM_BOT_TOKEN o‘rnatilmagan" });
      try {
        const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          return res.status(502).json({ success: false, message: "Telegram Bot API tokenni qabul qilmadi" });
        }
        return res.json({ success: true, data: { configured: true, botName: data.result?.first_name || "", botUsername: data.result?.username || "" } });
      } catch (error) {
        return res.status(502).json({ success: false, message: error?.message || "Telegram Bot API bilan bog‘lanib bo‘lmadi" });
      }
    });
  }
  return originalGet.call(this, path, ...handlers);
};
