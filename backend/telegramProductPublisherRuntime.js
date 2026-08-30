// Loaded before backend/index.js. Publishes newly created products to Telegram users and every group/channel where the bot is known as a member/admin.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const DEFAULT_MINI_APP_URL = "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829";
const configuredMiniAppUrl = String(process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || DEFAULT_MINI_APP_URL).trim();
const MINI_APP_URL = /[?&]tgapp=/.test(configuredMiniAppUrl) ? configuredMiniAppUrl : `${configuredMiniAppUrl}${configuredMiniAppUrl.includes("?") ? "&" : "?"}tgapp=v20260829`;
const PRODUCT_CHAT_IDS = String(process.env.TELEGRAM_PRODUCT_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const BROADCAST_USERS = String(process.env.TELEGRAM_PRODUCT_BROADCAST || "1") !== "0";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY) : null;

async function telegramApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram ${method} xatosi`);
  return result.result;
}
function baseUrl() { return MINI_APP_URL.includes("?") ? `${MINI_APP_URL}&` : `${MINI_APP_URL}?`; }
function productUrl(product) { const ref = String(product?.product_code || product?.id || "").trim(); return `${baseUrl()}product=${encodeURIComponent(ref)}`; }
function caption(product) { const name = String(product?.name || product?.title || "GULI mahsuloti").trim(); const code = product?.product_code ? `\n🔖 Kod: ${product.product_code}` : ""; const price = Number(product?.price || 0).toLocaleString("uz-UZ"); return `🌷 <b>${name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</b>${code}\n💰 ${price} so‘m`; }
function productImage(product) { return String(product?.image || (Array.isArray(product?.images) ? product.images[0] : "") || "").trim(); }
function replyMarkup(product) { return { inline_keyboard: [[{ text: "🛍️ Online Market", url: productUrl(product) }]] }; }
async function sendProduct(chatId, product) { const image = productImage(product); const markup = replyMarkup(product); if (image) await telegramApi("sendPhoto", { chat_id: chatId, photo: image, caption: caption(product), parse_mode: "HTML", reply_markup: markup }); else await telegramApi("sendMessage", { chat_id: chatId, text: caption(product), parse_mode: "HTML", reply_markup: markup, disable_web_page_preview: true }); return true; }
const inMemoryChatRegistry = new Map();

async function getUserChatIds() { if (!BROADCAST_USERS || !supabase) return []; try { const { data, error } = await supabase.from("telegram_users").select("telegram_id").not("telegram_id", "is", null).limit(10000); if (error) throw error; return (data || []).map(row => String(row.telegram_id)).filter(Boolean); } catch (error) { console.warn("[Telegram product] users broadcast skipped:", error.message); return []; } }
async function getBroadcastChatIds() {
  let list = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from("telegram_broadcast_chats").select("chat_id").eq("active", true).in("chat_type", ["group", "supergroup", "channel"]).limit(10000);
      if (!error && data) list = data.map(row => String(row.chat_id)).filter(Boolean);
    } catch (error) {
      console.warn("[Telegram product] group/channel registry unavailable:", error.message);
    }
  }
  for (const [id, record] of inMemoryChatRegistry.entries()) {
    if (record.active && !list.includes(String(id))) list.push(String(id));
  }
  return list;
}

async function registerManualChat(rawId) {
  if (!rawId) return null;
  let chatIdStr = String(rawId).trim();
  if (!chatIdStr.startsWith("@") && !chatIdStr.startsWith("-") && /^\d+$/.test(chatIdStr)) {
    chatIdStr = `-${chatIdStr}`;
  }

  let title = chatIdStr;
  let username = chatIdStr.startsWith("@") ? chatIdStr.replace(/^@/, "") : null;
  let type = chatIdStr.startsWith("@") ? "channel" : "supergroup";

  if (BOT_TOKEN) {
    try {
      const chatInfo = await telegramApi("getChat", { chat_id: chatIdStr });
      if (chatInfo) {
        if (chatInfo.id) chatIdStr = String(chatInfo.id);
        if (chatInfo.title) title = chatInfo.title;
        if (chatInfo.username) username = chatInfo.username;
        if (chatInfo.type) type = chatInfo.type;
      }
    } catch (err) {
      console.warn(`[getChat info for ${chatIdStr}]:`, err.message);
    }
  }

  const chatRecord = {
    chat_id: chatIdStr,
    chat_type: type,
    title: title || chatIdStr,
    username,
    bot_status: "administrator",
    can_post_messages: true,
    active: true,
    updated_at: new Date().toISOString()
  };

  inMemoryChatRegistry.set(chatIdStr, chatRecord);
  if (username) inMemoryChatRegistry.set(`@${username}`, chatRecord);

  if (supabase) {
    try {
      await supabase.from("telegram_broadcast_chats").upsert(chatRecord, { onConflict: "chat_id" });
    } catch (e) {
      console.warn("[Manual chat upsert failed]:", e.message);
    }
  }

  return chatRecord;
}

async function publishProduct(product) {
  if (!BOT_TOKEN || !product || product.active === false) return;
  const targets = [...new Set([...PRODUCT_CHAT_IDS, ...(await getUserChatIds()), ...(await getBroadcastChatIds())])];
  if (!targets.length) { console.warn("[Telegram product] target chatlar topilmadi."); return; }
  let ok = 0;
  for (const chatId of targets) { try { if (await sendProduct(chatId, product)) ok++; } catch (error) { console.warn(`[Telegram product] ${chatId} yuborilmadi:`, error.message); } await new Promise(resolve => setTimeout(resolve, 40)); }
  console.log(`[Telegram product] ${product.product_code || product.id || "?"}: ${ok}/${targets.length} chatga yuborildi`);
}
async function registerTelegramChat(chat, memberStatus) {
  if (!chat?.id) return;
  const type = String(chat.type || "");
  if (!["group", "supergroup", "channel"].includes(type)) return;
  const active = ["member", "administrator", "creator"].includes(memberStatus);
  const record = {
    chat_id: String(chat.id),
    chat_type: type,
    title: chat.title || null,
    username: chat.username || null,
    bot_status: memberStatus || "member",
    can_post_messages: ["administrator", "creator"].includes(memberStatus),
    active,
    updated_at: new Date().toISOString()
  };
  inMemoryChatRegistry.set(String(chat.id), record);
  if (chat.username) inMemoryChatRegistry.set(`@${chat.username}`, record);

  if (supabase) {
    try {
      await supabase.from("telegram_broadcast_chats").upsert(record, { onConflict: "chat_id" });
    } catch (error) { console.warn("[Telegram product] chat registry update failed:", error.message); }
  }
}
async function handleBroadcastTelegram(req, res) {
  try {
    const { title, body: adBody, imageUrl, target, buttonText, buttonUrl, telegramChannelId, channelId } = req.body || {};
    if (!title && !adBody) {
      return res.status(400).json({ success: false, message: "Reklama sarlavhasi yoki matni kiritilmagan" });
    }

    const rawCustomId = String(telegramChannelId || channelId || "").trim();
    if (rawCustomId) {
      await registerManualChat(rawCustomId);
    }

    const messageText = [
      title ? `<b>${String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</b>` : "",
      adBody ? String(adBody).replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""
    ].filter(Boolean).join("\n\n");

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: buttonText || "🛍️ Online Marketni Ochish",
            url: buttonUrl || MINI_APP_URL
          }
        ]
      ]
    };

    let groupTargets = [];
    let userTargets = [];

    if (target === "groups" || target === "all") {
      groupTargets = await getBroadcastChatIds();
      if (PRODUCT_CHAT_IDS.length) {
        groupTargets = [...new Set([...groupTargets, ...PRODUCT_CHAT_IDS])];
      }
    }

    if (rawCustomId) {
      let formattedId = rawCustomId;
      if (!formattedId.startsWith("@") && !formattedId.startsWith("-") && /^\d+$/.test(formattedId)) {
        formattedId = `-${formattedId}`;
      }
      groupTargets = [...new Set([formattedId, ...groupTargets])];
    }

    if (target === "users" || target === "all") {
      userTargets = await getUserChatIds();
    }

    const allTargets = [...new Set([...groupTargets, ...userTargets])];

    if (!allTargets.length) {
      return res.status(400).json({
        success: false,
        message: "Reklama yuborish uchun faol Telegram guruh va mijozlar topilmadi. Bot admin bo'lgan guruh yoki kanallarga botni qo'shing."
      });
    }

    let okCount = 0;
    let failedCount = 0;
    const errorsList = [];

    for (const chatId of allTargets) {
      try {
        if (imageUrl && String(imageUrl).trim()) {
          await telegramApi("sendPhoto", {
            chat_id: chatId,
            photo: String(imageUrl).trim(),
            caption: messageText,
            parse_mode: "HTML",
            reply_markup: replyMarkup
          });
        } else {
          await telegramApi("sendMessage", {
            chat_id: chatId,
            text: messageText,
            parse_mode: "HTML",
            reply_markup: replyMarkup,
            disable_web_page_preview: false
          });
        }
        okCount++;
      } catch (err) {
        failedCount++;
        errorsList.push(`${chatId}: ${err.message}`);
        console.warn(`[Broadcast] ${chatId} ga yuborishda xatolik:`, err.message);
      }
      await new Promise(r => setTimeout(r, 45));
    }

    return res.json({
      success: true,
      message: okCount > 0
        ? `Reklama ${okCount} ta chat/guruhga muvaffaqiyatli yuborildi! ${failedCount > 0 ? `(${failedCount} ta xatolik)` : ''}`
        : `Yuborishda xatolik yuz berdi (${errorsList[0] || 'Bot guruhda admin emas'})`,
      data: {
        total: allTargets.length,
        sent: okCount,
        failed: failedCount,
        groupsCount: groupTargets.length,
        usersCount: userTargets.length,
        errors: errorsList
      }
    });
  } catch (error) {
    console.error("[Broadcast error]:", error);
    return res.status(500).json({ success: false, message: error.message || "Reklama yuborishda xatolik" });
  }
}

async function handleGetBroadcastChats(req, res) {
  try {
    const chatsMap = new Map();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("telegram_broadcast_chats")
          .select("*")
          .order("updated_at", { ascending: false });
        if (data && Array.isArray(data)) {
          for (const c of data) {
            chatsMap.set(String(c.chat_id), c);
          }
        }
      } catch {}
    }

    for (const [id, record] of inMemoryChatRegistry.entries()) {
      if (!chatsMap.has(String(id))) {
        chatsMap.set(String(id), record);
      }
    }

    const chats = Array.from(chatsMap.values());

    return res.json({
      success: true,
      data: {
        chats,
        totalGroups: chats.length,
        adminGroupsCount: chats.filter(c => c.can_post_messages || c.bot_status === "administrator" || c.bot_status === "creator").length
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

async function handleRegisterBroadcastChat(req, res) {
  try {
    const { chatId, channelId } = req.body || {};
    const targetId = String(chatId || channelId || "").trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: "Kanal yoki guruh ID si kiritilmadi" });
    }

    const record = await registerManualChat(targetId);
    return res.json({
      success: true,
      message: `Telegram kanal/guruh saqlandi va ulandi (${record?.title || targetId})`,
      data: record
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || "Kanalni saqlashda xatolik" });
  }
}

const originalPost = express.application.post;
express.application.post = function productPublisherPost(routePath, ...handlers) {
  if (routePath === "/api/admin/broadcast-telegram") {
    return originalPost.call(this, routePath, handleBroadcastTelegram);
  }
  if (routePath === "/api/admin/broadcast-chats/register") {
    return originalPost.call(this, routePath, handleRegisterBroadcastChat);
  }
  if (routePath === "/api/telegram/webhook" && handlers.length) {
    const index = handlers.length - 1; const handler = handlers[index];
    handlers[index] = async function telegramRegistryHandler(req, res, next) {
      const update = req.body || {};
      const membership = update.my_chat_member || update.chat_member || null;
      if (membership?.chat) void registerTelegramChat(membership.chat, membership.new_chat_member?.status || membership.status || "member");
      const messageChat = update.message?.chat || update.channel_post?.chat;
      if (messageChat && ["group", "supergroup", "channel"].includes(String(messageChat.type))) void registerTelegramChat(messageChat, "member");
      return handler(req, res, next);
    };
  }
  if (routePath === "/api/admin/products" && handlers.length) {
    const index = handlers.length - 1; const handler = handlers[index];
    handlers[index] = async function productPublisherHandler(req, res, next) {
      let payload = null; const originalJson = res.json.bind(res); res.json = body => { payload = body; return originalJson(body); };
      const result = await handler(req, res, next); if (payload?.success && payload?.data) void publishProduct(payload.data); return result;
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};

const originalGet = express.application.get;
express.application.get = function productPublisherGet(routePath, ...handlers) {
  if (routePath === "/api/admin/broadcast-chats") {
    return originalGet.call(this, routePath, handleGetBroadcastChats);
  }
  return originalGet.call(this, routePath, ...handlers);
};
