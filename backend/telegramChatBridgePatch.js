// Persist ordinary Telegram customer messages into the shared chat store.
// Loaded before backend/index.js, after chatRealtimePatch in backend/package.json.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const SIGNING_SECRET = ADMIN_SECRET || BOT_TOKEN;
const ADMIN_CHAT_IDS = String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function isAdminRequest(req) {
  if (!ADMIN_SECRET) return false;
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return false;
  try {
    const [body, sig] = h.slice(7).split(".");
    if (!body || !sig) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (!safeEqual(sig, expected)) return false;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.role === "admin" && Number(p.exp) > Date.now();
  } catch { return false; }
}
function verifiedTelegramCustomerId(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const p = new URLSearchParams(String(initData));
    const hash = p.get("hash"); const authDate = Number(p.get("auth_date"));
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const pairs = []; p.forEach((v, k) => { if (k !== "hash") pairs.push(`${k}=${v}`); }); pairs.sort();
    const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const calc = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
    if (!safeEqual(calc, hash)) return null;
    const u = JSON.parse(p.get("user") || "null");
    return u?.id ? Number(u.id) : null;
  } catch { return null; }
}
// Accepts both current and legacy browser guest-token shapes, and the
// Telegram-Login-linked token shape - same schemes verified elsewhere in the
// chat backend (chatRealtimePatch.js, chatMediaStorageRuntime.js).
function hasValidGuestOrLinkedToken(req) {
  if (!SIGNING_SECRET) return false;
  const linked = String(req.headers["x-guli-linked-token"] || "");
  const lp = linked.split(".");
  if (lp.length === 4 && lp[0] === "linked" && Number(lp[2]) > Date.now()) {
    const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(`linked.${lp[1]}.${lp[2]}`).digest("base64url");
    if (safeEqual(lp[3], expected)) return true;
  }
  const guest = String(req.headers["x-guli-guest-token"] || "");
  const gp = guest.split(".");
  if (gp.length === 3 && Number(gp[1]) > Date.now()) {
    const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(`${gp[0]}.${gp[1]}`).digest("base64url");
    if (safeEqual(gp[2], expected)) return true;
  }
  if (gp.length === 2) {
    try {
      const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(gp[0]).digest("base64url");
      const payload = JSON.parse(Buffer.from(gp[0], "base64url").toString("utf8"));
      if (safeEqual(gp[1], expected) && Number(payload.exp) > Date.now()) return true;
    } catch {}
  }
  return false;
}
function hasAuthenticatedChatSession(req) {
  if (isAdminRequest(req)) return true;
  if (verifiedTelegramCustomerId(req.headers["x-telegram-init-data"] || "")) return true;
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) {
    try { if (verifyAccessToken(auth.slice(7).trim())?.telegram_id) return true; } catch {}
  }
  return hasValidGuestOrLinkedToken(req);
}

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
  // Use the canonical backend fanout when chatRealtimePatch is loaded.
  // This directly reaches connected admin SSE clients and the shared
  // Supabase broadcast channel without creating a second parallel bus.
  if (typeof globalThis.__GULI_CHAT_PUBLISH__ === "function") {
    await globalThis.__GULI_CHAT_PUBLISH__(data);
    return;
  }

  // Safe fallback for isolated startup/testing.
  if (!supabase) return;
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

async function persistTelegramProfile(message) {
  if (!supabase) return;
  const from = message?.from || {};
  const telegramId = Number(message?.chat?.id || from.id || 0);
  if (!telegramId) return;
  const contact = message?.contact;
  const phone = contact?.phone_number ? String(contact.phone_number).trim() : "";
  const payload = {
    telegram_id: telegramId,
    username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    ...(phone ? { telegram_phone: phone } : {}),
    updated_at: new Date().toISOString()
  };
  try {
    await supabase.from("telegram_users").upsert(payload, { onConflict: "telegram_id" });
  } catch (error) {
    console.warn("[Telegram chat bridge] profile persistence failed:", error.message);
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

  let mediaProxyUrl = fileId ? `/api/chat/media/${encodeURIComponent(fileId)}?name=${encodeURIComponent(fileName)}` : null;
  let mediaPath = null;
  let mimeType = null;
  if (fileId && typeof globalThis.__GULI_CHAT_PERSIST_TELEGRAM_MEDIA__ === "function") {
    try {
      const stored = await globalThis.__GULI_CHAT_PERSIST_TELEGRAM_MEDIA__({
        telegramId: chatId,
        fileId,
        fileName,
        type: msgType
      });
      if (stored?.mediaUrl) {
        mediaProxyUrl = stored.mediaUrl;
        mediaPath = stored.mediaPath || null;
        mimeType = stored.mimeType || null;
        fileName = stored.fileName || fileName;
      }
    } catch (error) {
      console.warn("[Telegram chat bridge] canonical media storage failed; using Telegram proxy:", error.message);
    }
  }

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
    mediaPath,
    mimeType,
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

// Media proxy for Telegram photos & files so admin and client can view without exposing BOT_TOKEN.
// Fallback path only (canonical storage uses the signed /api/chat/media-file/:token
// route instead whenever it succeeds) - kept for older rows / storage failures, but
// gated behind an authenticated Guli chat session so a bare Telegram file_id alone
// can no longer be used to pull media from the public internet (Phase 4a).
const originalGet = express.application.get;
express.application.get = function telegramChatMediaGet(routePath, ...handlers) {
  if (routePath === "/api/chat/media/:fileId") {
    return originalGet.call(this, routePath, async (req, res) => {
      try {
        if (!hasAuthenticatedChatSession(req)) {
          return res.status(401).json({ success: false, message: "Chat sessiyasi tasdiqlanmadi" });
        }
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
      if (message?.from?.id) {
        await persistTelegramProfile(message);
      }
      if (message?.from?.id && !isCommand && !isContact) {
        try {
          const persisted = await persistTelegramMessage(message);
          if (persisted) {
            req.__guliTelegramChatPersisted = true;
            req.__guliTelegramChatMessage = persisted;
          }
        } catch (error) { console.error("[Telegram chat bridge] message persistence failed:", error.message); }
      }
      return handler(req, res, next);
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};
