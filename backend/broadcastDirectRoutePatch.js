// Direct Telegram broadcast routes.
// Supports one image or a Telegram media album, including browser data URLs.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const MINI_APP_URL = String(process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829").trim();
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function verifyAdmin(req) {
  const header = String(req.headers.authorization || "");
  if (!ADMIN_SECRET || !header.startsWith("Bearer ")) return false;
  try {
    const [body, signature] = header.slice(7).split(".");
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (signature !== expected) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch { return false; }
}

function normalizeChatId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("@") || raw.startsWith("-")) return raw;
  return /^\d+$/.test(raw) ? `-${raw}` : raw;
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseImage(value, index) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
  if (match) {
    const mime = match[1] || "image/jpeg";
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
    return { kind: "buffer", buffer: Buffer.from(match[2], "base64"), mime, filename: `broadcast-${index}.${ext}` };
  }
  return { kind: "url", url: raw };
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

async function telegramMultipart(method, fields, files = []) {
  if (!BOT_TOKEN) throw new Error("Render serverida TELEGRAM_BOT_TOKEN sozlanmagan");
  const form = new FormData();
  for (const [key, value] of Object.entries(fields || {})) form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  for (const file of files) form.append(file.name, new Blob([file.buffer], { type: file.mime || "application/octet-stream" }), file.filename);
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", body: form });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) throw new Error(json?.description || `Telegram API ${response.status}`);
  return json.result;
}

async function loadChats() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("telegram_broadcast_chats")
    .select("chat_id,title,username,chat_type,bot_status,can_post_messages,active,updated_at")
    .order("updated_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data || [];
}

async function handleGetChats(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  try {
    const chats = await loadChats();
    return res.json({
      success: true,
      data: {
        chats,
        totalGroups: chats.length,
        adminGroupsCount: chats.filter((c) => c.active && (c.can_post_messages || ["administrator", "creator"].includes(String(c.bot_status || "")))).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || "Telegram chatlarini yuklashda xatolik" });
  }
}

async function handleRegisterChat(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  const raw = String(req.body?.chatId || req.body?.channelId || "").trim();
  if (!raw) return res.status(400).json({ success: false, message: "Kanal yoki guruh ID si kiritilmadi" });
  if (!supabase) return res.status(503).json({ success: false, message: "Supabase server konfiguratsiyasi topilmadi" });

  let chatId = normalizeChatId(raw);
  let title = chatId;
  let username = chatId.startsWith("@") ? chatId.slice(1) : null;
  let chatType = chatId.startsWith("@") ? "channel" : "supergroup";

  if (BOT_TOKEN) {
    try {
      const chat = await telegramApi("getChat", { chat_id: chatId });
      if (chat?.id != null) chatId = String(chat.id);
      title = chat?.title || title;
      username = chat?.username || username;
      chatType = chat?.type || chatType;
    } catch (error) {
      return res.status(400).json({ success: false, message: `Telegram chatni tekshirishda xatolik: ${error.message}` });
    }
  }

  const row = {
    chat_id: chatId,
    title,
    username,
    chat_type: ["group", "supergroup", "channel"].includes(chatType) ? chatType : "supergroup",
    bot_status: "administrator",
    can_post_messages: true,
    active: true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("telegram_broadcast_chats").upsert(row, { onConflict: "chat_id" }).select("*").single();
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, message: `Telegram chat saqlandi (${title})`, data });
}

function buildMarkup(buttonText, buttonUrl) {
  return { inline_keyboard: [[{ text: String(buttonText || "🛍️ Online Marketni Ochish").trim().slice(0, 64), url: String(buttonUrl || MINI_APP_URL).trim() }]] };
}

async function sendSingleImage(chatId, image, caption, markup) {
  if (image.kind === "url") {
    return telegramApi("sendPhoto", { chat_id: chatId, photo: image.url, caption, parse_mode: "HTML", reply_markup: markup });
  }
  return telegramMultipart("sendPhoto", { chat_id: chatId, caption, parse_mode: "HTML", reply_markup: markup }, [{ name: "photo", ...image }]);
}

async function sendAlbum(chatId, images, caption, markup) {
  // Telegram does not allow an inline keyboard on a media-group item.
  // Keep the album visually clean (no caption on the first photo), then send
  // exactly one text/action message containing the campaign text and button.
  const media = images.map((image, index) => ({
    type: "photo",
    media: image.kind === "url" ? image.url : `attach://broadcast${index}`,
  }));
  const files = images.map((image, index) => image.kind === "buffer"
    ? { name: `broadcast${index}`, buffer: image.buffer, mime: image.mime, filename: image.filename }
    : null
  ).filter(Boolean);

  const result = files.length
    ? await telegramMultipart("sendMediaGroup", { chat_id: chatId, media: JSON.stringify(media) }, files)
    : await telegramApi("sendMediaGroup", { chat_id: chatId, media });

  // The text and CTA are intentionally one message, so there is no redundant
  // "Online Market" message between the album and the actual CTA button.
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: caption || "🛍️ Online Market",
    parse_mode: "HTML",
    reply_markup: markup,
    disable_web_page_preview: true,
  });
  return result;
}

async function handleBroadcast(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  try {
    const { title, body, imageUrl, imageUrls, target, buttonText, buttonUrl, telegramChannelId, channelId } = req.body || {};
    const safeTitle = String(title || "").trim();
    const safeBody = String(body || "").trim();
    if (!safeTitle && !safeBody) return res.status(400).json({ success: false, message: "Reklama sarlavhasi yoki matni kiritilmagan" });

    const rawImages = Array.isArray(imageUrls) && imageUrls.length ? imageUrls : [imageUrl].filter(Boolean);
    const images = rawImages.slice(0, 10).map(parseImage).filter(Boolean);
    if (images.length > 10) return res.status(400).json({ success: false, message: "Maksimal 10 ta rasm yuborish mumkin" });
    if (images.some((image) => image.kind === "buffer" && !image.buffer.length)) return res.status(400).json({ success: false, message: "Rasm ma'lumotlari bo'sh" });

    const ids = new Set();
    if (target === "groups" || target === "all") {
      for (const chat of await loadChats()) {
        if (chat.active && (chat.can_post_messages || ["administrator", "creator"].includes(String(chat.bot_status || "")))) ids.add(String(chat.chat_id));
      }
    }
    const manualId = normalizeChatId(telegramChannelId || channelId);
    if (manualId && (target === "groups" || target === "all")) ids.add(manualId);

    if (target === "users" || target === "all") {
      if (!supabase) throw new Error("Supabase server konfiguratsiyasi topilmadi");
      const { data, error } = await supabase.from("telegram_users").select("telegram_id").not("telegram_id", "is", null).limit(10000);
      if (error) throw error;
      for (const row of data || []) if (row.telegram_id != null) ids.add(String(row.telegram_id));
    }

    const targets = [...ids];
    if (!targets.length) return res.status(400).json({ success: false, message: "Yuborish uchun faol Telegram chat topilmadi" });

    const text = [safeTitle ? `<b>${escapeHtml(safeTitle)}</b>` : "", safeBody ? escapeHtml(safeBody) : ""].filter(Boolean).join("\n\n");
    const markup = buildMarkup(buttonText, buttonUrl);
    let sent = 0;
    const errors = [];

    for (const chatId of targets) {
      try {
        if (images.length === 1) {
          await sendSingleImage(chatId, images[0], text, markup);
        } else if (images.length > 1) {
          await sendAlbum(chatId, images, text, markup);
        } else {
          await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup, disable_web_page_preview: false });
        }
        sent++;
      } catch (error) {
        errors.push({ chatId, message: error?.message || "Telegram yuborish xatosi" });
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const failed = targets.length - sent;
    const data = { total: targets.length, sent, failed, imageCount: images.length, errors };
    if (!sent) return res.status(502).json({ success: false, message: errors[0]?.message || "Telegram hech bir chatga reklamani qabul qilmadi", data });
    return res.json({ success: true, message: `Reklama ${sent} ta chatga muvaffaqiyatli yuborildi${failed ? `, ${failed} ta chatda xatolik` : ""}.`, data });
  } catch (error) {
    console.error("[Direct Telegram broadcast]", error);
    return res.status(500).json({ success: false, message: error?.message || "Reklama yuborishda server xatosi" });
  }
}

const originalListen = express.application.listen;
express.application.listen = function broadcastDirectListen(...args) {
  const app = this;
  app.route("/api/admin/broadcast-chats").get(handleGetChats);
  app.route("/api/admin/broadcast-chats/register").post(handleRegisterChat);
  app.route("/api/admin/broadcast-telegram").post(handleBroadcast);
  return originalListen.apply(this, args);
};
