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
async function getUserChatIds() { if (!BROADCAST_USERS || !supabase) return []; try { const { data, error } = await supabase.from("telegram_users").select("telegram_id").not("telegram_id", "is", null).limit(10000); if (error) throw error; return (data || []).map(row => String(row.telegram_id)).filter(Boolean); } catch (error) { console.warn("[Telegram product] users broadcast skipped:", error.message); return []; } }
async function getBroadcastChatIds() { if (!supabase) return []; try { const { data, error } = await supabase.from("telegram_broadcast_chats").select("chat_id").eq("active", true).in("chat_type", ["group", "supergroup", "channel"]).limit(10000); if (error) throw error; return (data || []).map(row => String(row.chat_id)).filter(Boolean); } catch (error) { console.warn("[Telegram product] group/channel registry unavailable:", error.message); return []; } }
async function publishProduct(product) {
  if (!BOT_TOKEN || !product || product.active === false) return;
  const targets = [...new Set([...PRODUCT_CHAT_IDS, ...(await getUserChatIds()), ...(await getBroadcastChatIds())])];
  if (!targets.length) { console.warn("[Telegram product] target chatlar topilmadi."); return; }
  let ok = 0;
  for (const chatId of targets) { try { if (await sendProduct(chatId, product)) ok++; } catch (error) { console.warn(`[Telegram product] ${chatId} yuborilmadi:`, error.message); } await new Promise(resolve => setTimeout(resolve, 40)); }
  console.log(`[Telegram product] ${product.product_code || product.id || "?"}: ${ok}/${targets.length} chatga yuborildi`);
}
async function registerTelegramChat(chat, memberStatus) {
  if (!supabase || !chat?.id) return;
  const type = String(chat.type || "");
  if (!["group", "supergroup", "channel"].includes(type)) return;
  const active = ["member", "administrator", "creator"].includes(memberStatus);
  try {
    await supabase.from("telegram_broadcast_chats").upsert({ chat_id: chat.id, chat_type: type, title: chat.title || null, username: chat.username || null, bot_status: memberStatus || "member", can_post_messages: ["administrator", "creator"].includes(memberStatus), active, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
  } catch (error) { console.warn("[Telegram product] chat registry update failed:", error.message); }
}
const originalPost = express.application.post;
express.application.post = function productPublisherPost(routePath, ...handlers) {
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
