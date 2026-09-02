// Persist ordinary Telegram customer messages into the shared chat store.
// Loaded before backend/index.js, after chatRealtimePatch in backend/package.json.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const ADMIN_CHAT_IDS = String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function telegramSend(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  } catch (error) {
    console.warn("[Telegram chat bridge] admin notification failed:", error.message);
  }
}

async function persistTelegramMessage(message) {
  if (!supabase) return null;
  const from = message?.from || {};
  const chatId = Number(message?.chat?.id || from.id || 0);
  if (!chatId) return null;

  const text = String(message?.text || message?.caption || "").trim()
    || (message?.photo ? "📷 Rasm" : message?.audio ? "🎵 Audio" : message?.voice ? "🎙️ Ovozli xabar" : message?.document ? "📁 Fayl" : "");
  if (!text) return null;

  const metadata = {
    source: "telegram",
    telegram_message_id: Number(message?.message_id || 0) || null,
    telegram_username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    type: message?.photo ? "image" : message?.audio ? "audio" : message?.voice ? "audio" : message?.document ? "file" : "text"
  };

  const row = { telegram_id: chatId, sender: "customer", text };
  // chat_messages.metadata is present in the current production schema; keep the insert
  // compatible with older deployments by retrying without metadata if the column is absent.
  let data, error;
  ({ data, error } = await supabase.from("chat_messages").insert([{ ...row, metadata }]).select("*").single());
  if (error && /metadata|column|schema cache/i.test(error.message || "")) {
    ({ data, error } = await supabase.from("chat_messages").insert([row]).select("*").single());
  }
  if (error) throw error;

  const adminText = `💬 <b>Yangi Telegram xabari</b>\n\n👤 ${from.first_name || "Mijoz"}${from.username ? ` (@${from.username})` : ""}\n📝 ${text.slice(0, 500)}`;
  await Promise.all(ADMIN_CHAT_IDS.map(id => telegramSend(id, adminText)));

  // chatRealtimePatch subscribes to the same broadcast channel and fans the message out
  // to connected admin/customer SSE clients.
  try {
    const channel = supabase.channel("guli-chat-realtime", { config: { broadcast: { self: true } } });
    await channel.subscribe();
    await channel.send({ type: "broadcast", event: "chat_message", payload: data });
    await channel.unsubscribe();
  } catch (error) {
    console.warn("[Telegram chat bridge] realtime broadcast failed:", error.message);
  }
  return data;
}

const originalPost = express.application.post;
express.application.post = function telegramChatBridgePost(routePath, ...handlers) {
  if (routePath === "/api/telegram/webhook" && handlers.length) {
    const index = handlers.length - 1;
    const handler = handlers[index];
    handlers[index] = async function telegramChatBridgeWebhook(req, res, next) {
      const message = req.body?.message;
      const text = String(message?.text || "").trim();
      const isCommand = /^\/(start|shop|store)(?:@\w+)?$/i.test(text);
      const isContact = Boolean(message?.contact?.phone_number);
      if (message?.from?.id && !isCommand && !isContact) {
        try { await persistTelegramMessage(message); }
        catch (error) { console.error("[Telegram chat bridge] message persistence failed:", error.message); }
      }
      return handler(req, res, next);
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};
