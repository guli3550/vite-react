// Server-side Telegram configuration API.
// Telegram chat targets are discovered/verified dynamically; no per-group code or deployment is needed.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function getBotToken() { return String(process.env.TELEGRAM_BOT_TOKEN || "").trim(); }
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
  const token = getBotToken();
  if (!token) throw new Error("Render serverida TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
function rowFromTelegramChat(chat, member) {
  return {
    chat_id: String(chat.id),
    title: chat.title || chat.username || String(chat.id),
    username: chat.username || null,
    chat_type: ["group", "supergroup", "channel"].includes(chat.type) ? chat.type : "supergroup",
    bot_status: String(member?.status || "administrator"),
    can_post_messages: true,
    active: true,
    updated_at: new Date().toISOString(),
  };
}
async function resolveAndVerifyChat(raw) {
  const input = normalizeChatId(raw);
  if (!input) throw new Error("Kanal/guruh ID yoki username kiritilmagan");
  const chat = await telegramApi("getChat", { chat_id: input });
  const me = await telegramApi("getMe", {});
  const member = await telegramApi("getChatMember", { chat_id: chat.id, user_id: me.id });
  if (!canPostFromMember(member, chat)) throw new Error(`Bot bu chatda admin yoki post qilish huquqiga ega emas (status: ${member?.status || "unknown"})`);
  return rowFromTelegramChat(chat, member);
}
async function upsertChatRow(row) {
  if (!supabase || !row?.chat_id) return null;
  const { data, error } = await supabase.from("telegram_broadcast_chats").upsert(row, { onConflict: "chat_id" }).select("*").single();
  if (error) throw error;
  return data;
}

// Handles both bot-membership updates. The fallback getMe check makes this
// work for private groups/supergroups as well as public groups/channels.
async function autoRegisterFromWebhook(update) {
  if (!update || !supabase) return;
  const change = update.my_chat_member || update.chat_member;
  if (!change?.chat?.id || !change?.new_chat_member) return;
  const bot = await telegramApi("getMe", {});
  if (Number(change.new_chat_member?.user?.id || 0) !== Number(bot?.id || 0)) return;

  const chat = change.chat;
  const member = change.new_chat_member;
  const status = String(member.status || "");
  if (status === "administrator" || status === "creator") {
    if (!canPostFromMember(member, chat)) return;
    await upsertChatRow(rowFromTelegramChat(chat, member));
    console.log(`[Telegram auto chat discovery] registered ${chat.id} (${chat.title || chat.username || "private chat"})`);
    return;
  }
  if (status === "left" || status === "kicked" || status === "member") {
    await supabase.from("telegram_broadcast_chats").update({
      active: status === "member" ? true : false,
      can_post_messages: status === "member" ? false : false,
      bot_status: status,
      updated_at: new Date().toISOString(),
    }).eq("chat_id", String(chat.id));
  }
}

async function getConfiguredChats() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("telegram_broadcast_chats").select("chat_id,title,username,chat_type,bot_status,can_post_messages,active,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

const originalListen = express.application.listen;
express.application.listen = function telegramConfigListen(...args) {
  const app = this;
  app.get("/api/admin/telegram-config", async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
    try { const chats = await getConfiguredChats(); res.json({ success: true, data: { botConfigured: Boolean(getBotToken()), miniAppUrl: process.env.MINI_APP_URL, chats } }); }
    catch (e) { res.status(500).json({ success: false, message: e.message || "Telegram sozlamalarini yuklashda xatolik" }); }
  });
  app.post("/api/admin/telegram-config/chat", async (req, res) => {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
    const raw = String(req.body?.chatId || "").trim();
    if (!raw) return res.status(400).json({ success: false, message: "Kanal/guruh ID kiritilmagan" });
    if (!supabase) return res.status(503).json({ success: false, message: "Supabase sozlanmagan" });
    if (!getBotToken()) return res.status(503).json({ success: false, message: "TELEGRAM_BOT_TOKEN sozlanmagan" });
    try { const row = await resolveAndVerifyChat(raw); const data = await upsertChatRow(row); return res.json({ success: true, message: `${row.title} saqlandi — bot post qila oladi ✅`, data }); }
    catch (e) { return res.status(400).json({ success: false, message: e.message || "Telegram chatni tekshirishda xatolik" }); }
  });

  // IMPORTANT: use application.post interception instead of app.use so this
  // discovery runs before the real webhook handler, regardless of route order.
  const originalPost = express.application.post;
  express.application.post = function telegramDiscoveryPost(routePath, ...handlers) {
    if (routePath === "/api/telegram/webhook" && handlers.length) {
      const first = handlers[0];
      handlers.unshift(async (req, res, next) => {
        try { await autoRegisterFromWebhook(req.body); } catch (error) { console.error("[Telegram auto chat discovery]", error?.message || error); }
        return next();
      });
    }
    return originalPost.call(this, routePath, ...handlers);
  };
  return originalListen.apply(this, args);
};
