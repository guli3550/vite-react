// Reliable Telegram broadcast endpoint.
// Loaded after the legacy publisher patch so failed Telegram sends can never
// be reported as successful broadcasts.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const MINI_APP_URL = String(process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829").trim();
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY) : null;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAdmin(req) {
  if (!ADMIN_SECRET) return false;
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return false;
  try {
    const [body, signature] = header.slice(7).split(".");
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
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

function normalizeChatId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("@") || raw.startsWith("-")) return raw;
  return /^\d+$/.test(raw) ? `-${raw}` : raw;
}

async function registeredChatIds() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("telegram_broadcast_chats")
    .select("chat_id, chat_type, active, can_post_messages, bot_status")
    .eq("active", true)
    .in("chat_type", ["group", "supergroup", "channel"])
    .limit(10000);
  if (error) throw error;
  return (data || [])
    .filter((row) => row.can_post_messages || ["administrator", "creator"].includes(String(row.bot_status || "")))
    .map((row) => String(row.chat_id))
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleReliableBroadcast(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });

  try {
    const { title, body, imageUrl, target, buttonText, buttonUrl, telegramChannelId } = req.body || {};
    const safeTitle = String(title || "").trim();
    const safeBody = String(body || "").trim();
    if (!safeTitle && !safeBody) return res.status(400).json({ success: false, message: "Reklama sarlavhasi yoki matni kiritilmagan" });

    const ids = new Set();
    if (target === "groups" || target === "all") {
      for (const id of await registeredChatIds()) ids.add(id);
    }
    const manualId = normalizeChatId(telegramChannelId);
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
    const markup = {
      inline_keyboard: [[{
        text: String(buttonText || "🛍️ Online Marketni Ochish").trim().slice(0, 64),
        url: String(buttonUrl || MINI_APP_URL).trim(),
      }]],
    };

    let sent = 0;
    const errors = [];
    for (const chatId of targets) {
      try {
        const photo = String(imageUrl || "").trim();
        if (photo) {
          await telegramApi("sendPhoto", { chat_id: chatId, photo, caption: text, parse_mode: "HTML", reply_markup: markup });
        } else {
          await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup, disable_web_page_preview: false });
        }
        sent++;
      } catch (error) {
        errors.push({ chatId, message: error?.message || "Telegram yuborish xatosi" });
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const failed = targets.length - sent;
    if (!sent) {
      return res.status(502).json({
        success: false,
        message: errors[0]?.message || "Telegram hech bir chatga reklamani qabul qilmadi",
        data: { total: targets.length, sent: 0, failed, errors },
      });
    }

    return res.json({
      success: true,
      message: `Reklama ${sent} ta chatga muvaffaqiyatli yuborildi${failed ? `, ${failed} ta chatda xatolik` : ""}.`,
      data: { total: targets.length, sent, failed, errors },
    });
  } catch (error) {
    console.error("[Reliable broadcast]", error);
    return res.status(500).json({ success: false, message: error?.message || "Reklama yuborishda server xatosi" });
  }
}

const originalPost = express.application.post;
express.application.post = function reliableBroadcastPost(routePath, ...handlers) {
  if (routePath === "/api/admin/broadcast-telegram") return originalPost.call(this, routePath, handleReliableBroadcast);
  return originalPost.call(this, routePath, ...handlers);
};
