// Dedicated admin Telegram bot notification bridge.
// The customer-facing bot remains TELEGRAM_BOT_TOKEN; this bot is only for admin alerts.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const explicitIds = () => String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);

async function telegram(method, body) {
  if (!BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  return j.result;
}

async function storedIds() {
  const ids = new Set(explicitIds());
  if (supabase) {
    const { data } = await supabase.from("telegram_admin_bot_chats").select("chat_id").eq("active", true);
    for (const row of data || []) ids.add(String(row.chat_id));
  }
  return [...ids];
}

async function notify(text, extra = {}) {
  if (!BOT_TOKEN || !String(text || "").trim()) return;
  const ids = await storedIds();
  if (!ids.length) {
    console.warn("[Admin Telegram bot] No admin chat discovered yet. Send /start to the new admin bot.");
    return;
  }
  await Promise.all(ids.map(async chat_id => {
    try {
      await telegram("sendMessage", { chat_id, text: String(text).slice(0, 3900), disable_web_page_preview: true, ...extra });
    } catch (e) {
      console.warn(`[Admin Telegram bot] notification failed for ${chat_id}:`, e.message);
    }
  }));
}

globalThis.__GULI_ADMIN_BOT_NOTIFY__ = notify;

async function discoverAdminChats() {
  if (!BOT_TOKEN || !supabase) return;
  try {
    const state = globalThis.__GULI_ADMIN_BOT_UPDATE_STATE__ || { offset: 0 };
    const updates = await telegram("getUpdates", { offset: state.offset, timeout: 0, allowed_updates: ["message"] });
    for (const update of updates || []) {
      state.offset = Math.max(state.offset, Number(update.update_id || 0) + 1);
      const message = update?.message;
      const chat = message?.chat;
      if (chat?.type !== "private" || !chat?.id) continue;
      const text = String(message?.text || "").trim();
      if (!/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) continue;
      await supabase.from("telegram_admin_bot_chats").upsert({
        chat_id: Number(chat.id),
        username: chat.username || null,
        first_name: chat.first_name || null,
        last_name: chat.last_name || null,
        active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "chat_id" });
      console.log(`[Admin Telegram bot] admin chat discovered: ${chat.id}`);
      await telegram("sendMessage", {
        chat_id: chat.id,
        text: "✅ GULI admin bot ulandi. Yangi buyurtmalar, chatlar, to‘lovlar va muhim hodisalar shu yerga keladi."
      });
    }
    globalThis.__GULI_ADMIN_BOT_UPDATE_STATE__ = state;
  } catch (e) {
    console.warn("[Admin Telegram bot] update discovery failed:", e.message);
  }
}

if (BOT_TOKEN) {
  setTimeout(() => discoverAdminChats(), 3000);
  setInterval(discoverAdminChats, 10000);
  console.log("[Admin Telegram bot] notification bridge enabled.");
} else {
  console.warn("[Admin Telegram bot] TELEGRAM_ADMIN_BOT_TOKEN is not configured; admin bot alerts disabled.");
}

function money(value) {
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString("uz-UZ")} so‘m`;
}

function orderText(order, title = "🛒 YANGI BUYURTMA") {
  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemText = items.slice(0, 8).map((item, i) => {
    const name = item?.name || item?.title || item?.product_name || "Mahsulot";
    const qty = Number(item?.quantity || item?.qty || 1);
    return `${i + 1}. ${name} × ${qty}`;
  }).join("\n");
  return `${title}\n\n🔢 № ${order.order_number || order.id || "—"}\n👤 ${order.customer_name || [order.first_name, order.last_name].filter(Boolean).join(" ") || "Mijoz"}\n📞 ${order.phone || "—"}\n💰 ${money(order.total)}\n💳 ${order.payment || "—"}\n📦 ${items.length} ta mahsulot${itemText ? `\n\n${itemText}` : ""}\n\n📍 ${typeof order.address === "string" ? order.address : "Manzil buyurtmada mavjud"}`;
}

function wrapJsonRoute(path, classify) {
  const original = express.application.post;
  express.application.post = function(routePath, ...handlers) {
    if (routePath === path && handlers.length) {
      const wrapped = async function(req, res, next) {
        let payload = null;
        const json = res.json.bind(res);
        res.json = body => { payload = body; return json(body); };
        try {
          return await handlers[handlers.length - 1](req, res, next);
        } finally {
          try {
            const message = classify(req, payload);
            if (message) await notify(message);
          } catch (e) { console.warn("[Admin Telegram bot] route notification failed:", e.message); }
        }
      };
      return original.call(this, routePath, ...handlers.slice(0, -1), wrapped);
    }
    return original.call(this, routePath, ...handlers);
  };
}

wrapJsonRoute("/api/orders", (_req, body) => body?.success ? orderText(body.data) : null);
wrapJsonRoute("/api/customer/orders", (_req, body) => body?.success ? orderText(body.data) : null);
wrapJsonRoute("/api/auth/orders", (_req, body) => body?.success ? orderText(body.data) : null);
wrapJsonRoute("/api/guest/orders", (_req, body) => body?.success ? orderText(body.data) : null);
wrapJsonRoute("/api/chat/messages", (req, body) => {
  if (!body?.success) return null;
  const b = req.body || {};
  if (String(b.sender || "").toLowerCase() === "admin") return null;
  return `💬 YANGI ONLINE CHAT\n\n👤 Telegram ID: ${b.telegram_id || "—"}\n📝 ${String(b.text || "Yangi xabar").slice(0, 1000)}`;
});
wrapJsonRoute("/api/reviews", (_req, body) => body?.success ? `⭐ YANGI SHARH\n\n📦 ${body.data?.product_code || body.data?.product_name || "Mahsulot"}\n⭐ ${body.data?.rating || "—"}/5\n📝 ${String(body.data?.text || body.data?.comment || "").slice(0, 700)}` : null);

// Admin status/payment actions are PUT routes; inject a lightweight response observer.
const originalPut = express.application.put;
express.application.put = function(routePath, ...handlers) {
  const watched = /^\/api\/admin\/orders\/[^/]+(?:\/payment)?$/.test(String(routePath));
  if (watched && handlers.length) {
    const wrapped = async function(req, res, next) {
      let payload = null;
      const json = res.json.bind(res);
      res.json = body => { payload = body; return json(body); };
      try { return await handlers[handlers.length - 1](req, res, next); }
      finally {
        try {
          if (payload?.success && payload?.data) {
            const status = String(req.body?.payment_status || req.body?.status || payload.data.status || "");
            const title = /verified|tasdiq/i.test(status) ? "✅ TO‘LOV TASDIQLANDI" : /rejected|rad/i.test(status) ? "⚠️ TO‘LOV RAD ETILDI" : "📦 BUYURTMA HOLATI O‘ZGARDI";
            await notify(orderText(payload.data, title));
          }
        } catch (e) { console.warn("[Admin Telegram bot] order status notification failed:", e.message); }
      }
    };
    return originalPut.call(this, routePath, ...handlers.slice(0, -1), wrapped);
  }
  return originalPut.call(this, routePath, ...handlers);
};

// Telegram customer messages arriving through the existing webhook also reach the dedicated admin bot.
const originalPost = express.application.post;
express.application.post = function(routePath, ...handlers) {
  if (routePath === "/api/telegram/webhook" && handlers.length) {
    const wrapped = async function(req, res, next) {
      try {
        const message = req.body?.message;
        const from = message?.from || {};
        const text = String(message?.text || message?.caption || "").trim();
        const isCommand = /^\/(start|shop|store)(?:@\w+)?$/i.test(text);
        if (from.id && text && !isCommand) {
          await notify(`💬 YANGI TELEGRAM CHAT\n\n👤 ${from.first_name || "Mijoz"}${from.username ? ` (@${from.username})` : ""}\n🆔 ${from.id}\n📝 ${text.slice(0, 1200)}`);
        }
      } catch (e) { console.warn("[Admin Telegram bot] Telegram chat notification failed:", e.message); }
      return handlers[handlers.length - 1](req, res, next);
    };
    return originalPost.call(this, routePath, ...handlers.slice(0, -1), wrapped);
  }
  return originalPost.call(this, routePath, ...handlers);
};

console.log("[Admin Telegram bot] notification routes registered.");
