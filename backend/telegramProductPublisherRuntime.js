// Loaded before backend/index.js. Publishes newly created products to configured Telegram chats.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const MINI_APP_URL = (process.env.MINI_APP_URL || "https://guli-lingerie-web.onrender.com/?tgapp=v20260826").replace(/\/$/, "");
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

function baseUrl() {
  return MINI_APP_URL.includes("?") ? `${MINI_APP_URL}&` : `${MINI_APP_URL}?`;
}
function productUrl(product) {
  const ref = String(product?.product_code || product?.id || "").trim();
  return `${baseUrl()}product=${encodeURIComponent(ref)}`;
}
function homeUrl() { return MINI_APP_URL; }
function caption(product) {
  const name = String(product?.name || product?.title || "GULI mahsuloti").trim();
  const code = product?.product_code ? `\n🔖 Kod: ${product.product_code}` : "";
  const price = Number(product?.price || 0).toLocaleString("uz-UZ");
  return `🌷 <b>${name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</b>${code}\n💰 ${price} so‘m`;
}
async function sendProduct(chatId, product) {
  const image = String(product?.image || "").trim();
  if (!image) return false;
  await telegramApi("sendPhoto", {
    chat_id: chatId,
    photo: image,
    caption: caption(product),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "🛍️ Online Market", url: homeUrl() }, { text: "🤩 Sotib olish", url: productUrl(product) }]] },
  });
  return true;
}
async function getUserChatIds() {
  if (!BROADCAST_USERS || !supabase) return [];
  try {
    const { data, error } = await supabase.from("telegram_users").select("telegram_id").not("telegram_id", "is", null).limit(10000);
    if (error) throw error;
    return (data || []).map(row => String(row.telegram_id)).filter(Boolean);
  } catch (error) {
    console.warn("[Telegram product] users broadcast skipped:", error.message);
    return [];
  }
}
async function publishProduct(product) {
  if (!BOT_TOKEN || !product || product.active === false) return;
  const targets = [...new Set([...PRODUCT_CHAT_IDS, ...(await getUserChatIds())])];
  if (!targets.length) {
    console.warn("[Telegram product] target chatlar sozlanmagan; TELEGRAM_PRODUCT_CHAT_IDS ni kiriting.");
    return;
  }
  let ok = 0;
  for (const chatId of targets) {
    try { if (await sendProduct(chatId, product)) ok++; }
    catch (error) { console.warn(`[Telegram product] ${chatId} yuborilmadi:`, error.message); }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  console.log(`[Telegram product] ${product.product_code || product.id || "?"}: ${ok}/${targets.length} chatga yuborildi`);
}

const originalPost = express.application.post;
express.application.post = function productPublisherPost(routePath, ...handlers) {
  if (routePath === "/api/admin/products" && handlers.length) {
    const index = handlers.length - 1;
    const handler = handlers[index];
    handlers[index] = async function productPublisherHandler(req, res, next) {
      let payload = null;
      const originalJson = res.json.bind(res);
      res.json = (body) => { payload = body; return originalJson(body); };
      const result = await handler(req, res, next);
      if (payload?.success && payload?.data) void publishProduct(payload.data);
      return result;
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};
