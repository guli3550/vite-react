// Server-side Telegram configuration API.
// Register routes immediately before the backend starts listening so this patch
// does not depend on Express prototype get() monkey-patching order.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function verifyAdmin(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ") || !process.env.ADMIN_SECRET) return false;
  try {
    const [body, sig] = h.slice(7).split(".");
    const expected = crypto.createHmac("sha256", process.env.ADMIN_SECRET).update(body).digest("base64url");
    if (sig !== expected) return false;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.role === "admin" && Number(p.exp) > Date.now();
  } catch { return false; }
}

async function getConfiguredChats() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("telegram_broadcast_chats")
    .select("chat_id,title,username,chat_type,bot_status,can_post_messages,active,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

const originalListen = express.application.listen;
express.application.listen = function telegramConfigListen(...args) {
  const app = this;
  app.get("/api/admin/telegram-config", async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
    try {
      const chats = await getConfiguredChats();
      res.json({ success: true, data: { botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), miniAppUrl: process.env.MINI_APP_URL, chats } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message || "Telegram sozlamalarini yuklashda xatolik" });
    }
  });

  app.post("/api/admin/telegram-config/chat", async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
    const raw = String(req.body?.chatId || "").trim();
    if (!raw) return res.status(400).json({ success: false, message: "Kanal/guruh ID kiritilmagan" });
    if (!supabase) return res.status(503).json({ success: false, message: "Supabase sozlanmagan" });
    const chatId = raw.startsWith("@") || raw.startsWith("-") ? raw : `-${raw}`;
    const row = { chat_id: chatId, title: req.body?.title || chatId, username: raw.startsWith("@") ? raw.slice(1) : null, chat_type: raw.startsWith("@") ? "channel" : "supergroup", bot_status: "administrator", can_post_messages: true, active: true, updated_at: new Date().toISOString() };
    try {
      const { data, error } = await supabase.from("telegram_broadcast_chats").upsert(row, { onConflict: "chat_id" }).select("*").single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: e.message || "Kanal/guruhni saqlashda xatolik" }); }
  });
  return originalListen.apply(this, args);
};
