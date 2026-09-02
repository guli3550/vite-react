// Fan out Telegram webhook inserts to connected admin SSE clients.
// Complements telegramChatBridgePatch: persistence stays in Supabase, while this
// patch makes the same persisted message visible immediately in /api/chat/stream/all.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const adminStreams = new Set();

async function findPersistedMessage(message) {
  if (!supabase) return null;
  const telegramId = Number(message?.chat?.id || message?.from?.id || 0);
  const text = String(message?.text || message?.caption || "").trim();
  if (!telegramId || !text) return null;
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("sender", "customer")
    .eq("text", text)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0];
}

function pushToAdmins(message) {
  for (const res of Array.from(adminStreams)) {
    try {
      res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
    } catch {
      adminStreams.delete(res);
    }
  }
}

const originalGet = express.application.get;
express.application.get = function telegramFanoutGet(routePath, ...handlers) {
  if (routePath === "/api/chat/stream/:telegram_id" && handlers.length) {
    const index = handlers.length - 1;
    const handler = handlers[index];
    handlers[index] = async function captureAdminStream(req, res, next) {
      if (String(req.params?.telegram_id || "") === "all") {
        adminStreams.add(res);
        req.on("close", () => adminStreams.delete(res));
      }
      return handler(req, res, next);
    };
  }
  return originalGet.call(this, routePath, ...handlers);
};

const originalPost = express.application.post;
express.application.post = function telegramFanoutPost(routePath, ...handlers) {
  if (routePath === "/api/telegram/webhook" && handlers.length) {
    const index = handlers.length - 1;
    const handler = handlers[index];
    handlers[index] = async function fanoutTelegramWebhook(req, res, next) {
      const result = await handler(req, res, next);
      const message = req.body?.message;
      const text = String(message?.text || message?.caption || "").trim();
      const isCommand = /^\/(start|shop|store)(?:@\w+)?$/i.test(text);
      const isContact = Boolean(message?.contact?.phone_number);
      if (message?.from?.id && !isCommand && !isContact) {
        const row = await findPersistedMessage(message);
        if (row) pushToAdmins(row);
      }
      return result;
    };
  }
  return originalPost.call(this, routePath, ...handlers);
};
