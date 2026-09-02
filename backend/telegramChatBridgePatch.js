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

async function broadcastRealtime(data) {
  const channel = supabase.channel("guli-chat-realtime", { config: { broadcast: { self: true } } });
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => { if (settled) return; settled = true; fn(value); };
      channel.subscribe(async status => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.send({ type: "broadcast", event: "chat_message", payload: data });
            finish(resolve);
          } catch (error) { finish(reject, error); }
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          finish(reject, new Error(`Supabase realtime ${status}`));
        }
      });
    });
  } finally {
    try { await channel.unsubscribe(); } catch {}
  }
}

async function persistTelegramMessage(message) {
  if (!supabase) return null;
  const from = message?.from || {};
  const chatId = Number(message?.chat?.id || from.id || 0);
  if (!chatId) return null;

  let fileId = "";
  let fileName = "";
  let msgType = "text";
  if (Array.isArray(message?.photo) && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    fileId = largest.file_id;
    fileName = "photo.jpg";
    msgType = "image";
  } else if (message?.document) {
    fileId = message.document.file_id;
    fileName = message.document.file_name || "document";
    msgType = "file";
  } else if (message?.audio) {
    fileId = message.audio.file_id;
    fileName = message.audio.file_name || "audio.mp3";
    msgType = "audio";
  } else if (message?.voice) {
    fileId = message.voice.file_id;
    fileName = "voice.ogg";
    msgType = "audio";
  }

  const mediaProxyUrl = fileId ? `/api/chat/media/${encodeURIComponent(fileId)}?name=${encodeURIComponent(fileName)}` : null;

  const text = String(message?.text || message?.caption || "").trim()
    || (msgType === "image" ? "📷 Rasm" : msgType === "audio" ? "🎙️ Ovozli xabar" : msgType === "file" ? `📁 ${fileName || "Fayl"}` : "");
  if (!text && !mediaProxyUrl) return null;

  const metadata = {
    source: "telegram",
    telegram_message_id: Number(message?.message_id || 0) || null,
    telegram_username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    type: msgType,
    mediaUrl: mediaProxyUrl,
    fileName: fileName || null,
    file_id: fileId || null
  };

  const row = { telegram_id: chatId, sender: "customer", text };
  let data, error;
  ({ data, error } = await supabase.from("chat_messages").insert([{ ...row, metadata }]).select("*").single());
  if (error && /metadata|column|schema cache/i.test(error.message || "")) {
    ({ data, error } = await supabase.from("chat_messages").insert([row]).select("*").single());
  }
  if (error) throw error;

  // Enrich data with metadata in case column was stripped
  if (data && !data.metadata) {
    data.metadata = metadata;
  }
  if (data && mediaProxyUrl && !data.mediaUrl) {
    data.mediaUrl = mediaProxyUrl;
    data.type = msgType;
    data.fileName = fileName;
  }

  const adminText = `💬 <b>Yangi Telegram xabari</b>\n\n👤 ${from.first_name || "Mijoz"}${from.username ? ` (@${from.username})` : ""}\n📝 ${text.slice(0, 500)}${fileId ? `\n📎 ${msgType.toUpperCase()}: ${fileName}` : ""}`;
  await Promise.all(ADMIN_CHAT_IDS.map(id => telegramSend(id, adminText)));

  try { await broadcastRealtime(data); }
  catch (error) { console.warn("[Telegram chat bridge] realtime broadcast failed:", error.message); }
  return data;
}

// Media proxy for Telegram photos & files so admin and client can view without exposing BOT_TOKEN
const originalGet = express.application.get;
express.application.get = function telegramChatMediaGet(routePath, ...handlers) {
  if (routePath === "/api/chat/media/:fileId") {
    return originalGet.call(this, routePath, async (req, res) => {
      try {
        const fileId = String(req.params.fileId || "").trim();
        if (!fileId || !BOT_TOKEN) return res.status(404).json({ success: false, message: "Fayl topilmadi" });

        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const fileJson = await fileRes.json().catch(() => null);
        if (!fileRes.ok || !fileJson?.ok || !fileJson?.result?.file_path) {
          return res.status(404).json({ success: false, message: "Telegram fayl yo'li olinmadi" });
        }

        const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileJson.result.file_path}`;
        const mediaResp = await fetch(telegramFileUrl);
        if (!mediaResp.ok) return res.status(502).json({ success: false, message: "Telegramdan fayl yuklab olinmadi" });

        const contentType = mediaResp.headers.get("content-type") || (fileJson.result.file_path.endsWith(".jpg") || fileJson.result.file_path.endsWith(".jpeg") ? "image/jpeg" : fileJson.result.file_path.endsWith(".png") ? "image/png" : "application/octet-stream");
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        const buffer = Buffer.from(await mediaResp.arrayBuffer());
        res.setHeader("Content-Length", String(buffer.length));
        return res.send(buffer);
      } catch (err) {
        console.error("Chat media proxy error:", err);
        return res.status(500).json({ success: false, message: "Fayl proxy xatosi" });
      }
    });
  }
  return originalGet.call(this, routePath, ...handlers);
};

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
