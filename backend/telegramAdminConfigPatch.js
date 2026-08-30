// Server-side Telegram configuration API.
// A chat is only marked postable after Telegram confirms the bot's membership/permissions.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();

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

function normalizeChatId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("@") || raw.startsWith("-")) return raw;
  return /^\d+$/.test(raw) ? `-${raw}` : raw;
}

async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("Render serverida TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) throw new Error(json?.description || `Telegram API ${response.status}`);
  return json.result;
}

function canPostFromMember(member, chat) {
  const status = String(member?.status || "");
  if (status === "creator") return true;
  if (status !== "administrator") return false;
  if (chat?.type === "channel") return member?.can_post_messages !== false;
  return member?.can_send_messages !== false;
}

async function resolveAndVerifyChat(raw) {
  const input = normalizeChatId(raw);
  if (!input) throw new Error("Kanal/guruh ID yoki username kiritilmagan");
  const chat = await telegramApi("getChat", { chat_id: input });
  const me = await telegramApi("getMe", {});
  const member = await telegramApi("getChatMember", { chat_id: chat.id, user_id: me.id });
  const allowed = canPostFromMember(member, chat);
  if (!allowed) {
    throw new Error(`Bot bu chatda admin yoki post qilish huquqiga ega emas (status: ${member?.status || "unknown"})`);
  }
  return {
    chat_id: String(chat.id),
    title: chat.title || chat.username || String(chat.id),
    username: chat.username || null,
    chat_type: ["group", "supergroup", "channel"].includes(chat.type) ? chat.type : "supergroup",
    bot_status: member.status,
    can_post_messages: true,
    active: true,
    updated_at: new Date().toISOString(),
  };
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
      res.json({ success: true, data: { botConfigured: Boolean(BOT_TOKEN), miniAppUrl: process.env.MINI_APP_URL, chats } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message || "Telegram sozlamalarini yuklashda xatolik" });
    }
  });

  app.post("/api/admin/telegram-config/chat", async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
    const raw = String(req.body?.chatId || "").trim();
    if (!raw) return res.status(400).json({ success: false, message: "Kanal/guruh ID kiritilmagan" });
    if (!supabase) return res.status(503).json({ success: false, message: "Supabase sozlanmagan" });
    if (!BOT_TOKEN) return res.status(503).json({ success: false, message: "TELEGRAM_BOT_TOKEN sozlanmagan" });

    try {
      // Resolve @username or numeric ID, then verify the actual bot membership/permissions.
      // Never fabricate administrator/posting flags in the database.
      const row = await resolveAndVerifyChat(raw);
      const { data, error } = await supabase
        .from("telegram_broadcast_chats")
        .upsert(row, { onConflict: "chat_id" })
        .select("*")
        .single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.json({ success: true, message: `${row.title} saqlandi — bot post qila oladi ✅`, data });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message || "Telegram chatni tekshirishda xatolik" });
    }
  });

  return originalListen.apply(this, args);
};
