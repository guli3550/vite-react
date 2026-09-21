// Realtime chat bridge with Telegram, browser guests and admin auth.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { resolveChatIdentity } = require("./chatIdentityResolver.js");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const ADMIN_CHAT_IDS = String(process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const clients = new Set();
const REALTIME_CHANNEL = "guli-chat-realtime";
let realtimeStarted = false;
let realtimeChannel = null;
function safeEqual(a, b) { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function signGuest(id, exp) { return crypto.createHmac("sha256", ADMIN_SECRET || BOT_TOKEN).update(`${id}.${exp}`).digest("base64url"); }
function createGuestToken(id) { const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; return `${id}.${exp}.${signGuest(id, exp)}`; }
// Accepts both guest-token shapes seen in production:
//  - legacy 3-part `${id}.${exp}.${sig}` (still produced by createGuestToken above)
//  - current 2-part `${base64url(JSON{guestId,exp})}.${sig}` issued by
//    chatGuestSessionHardeningPatch.js's GET /api/chat/guest-session, which is
//    the only guest-session endpoint the frontend calls today. Without this,
//    every currently-issued guest token failed verification here (Root Cause C).
function verifyGuest(req, expectedId) {
  if (!ADMIN_SECRET && !BOT_TOKEN) return false;
  const token = String(req.headers["x-guli-guest-token"] || "");
  const parts = token.split(".");
  if (parts.length === 3) {
    const [id, exp, sig] = parts;
    if (!id || !exp || !sig || Number(id) !== Number(expectedId) || Number(exp) <= Date.now()) return false;
    return safeEqual(sig, signGuest(id, Number(exp)));
  }
  if (parts.length === 2) {
    const [body, sig] = parts;
    if (!body || !sig) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET || BOT_TOKEN).update(body).digest("base64url");
    if (!safeEqual(sig, expected)) return false;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      return Number(payload.guestId) === Number(expectedId) && Number(payload.exp) > Date.now();
    } catch { return false; }
  }
  return false;
}
function signLinked(id, exp) { return crypto.createHmac("sha256", ADMIN_SECRET || BOT_TOKEN).update(`linked.${id}.${exp}`).digest("base64url"); }
function createLinkedToken(id) { const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; return `linked.${id}.${exp}.${signLinked(id, exp)}`; }
function verifyLinked(req, expectedId) { if (!ADMIN_SECRET && !BOT_TOKEN) return false; const token = String(req.headers["x-guli-linked-token"] || ""); const [prefix, id, exp, sig] = token.split("."); if (prefix !== "linked" || !id || !exp || !sig || Number(id) !== Number(expectedId) || Number(exp) <= Date.now()) return false; return safeEqual(sig, signLinked(id, Number(exp))); }
function verifyTelegram(initData) { if (!BOT_TOKEN || !initData) return null; try { const p = new URLSearchParams(initData); const hash = p.get("hash"); const authDate = Number(p.get("auth_date")); if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null; const pairs = []; p.forEach((v, k) => { if (k !== "hash") pairs.push(`${k}=${v}`); }); pairs.sort(); const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest(); const calc = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex"); if (!safeEqual(calc, hash)) return null; const u = JSON.parse(p.get("user") || "null"); return u?.id ? { id: Number(u.id), username: u.username || null, first_name: u.first_name || null } : null; } catch { return null; } }
function verifyLoginUrlPayload(payload) { if (!BOT_TOKEN || !payload?.id || !payload?.auth_date || !payload?.hash) return null; try { const authDate = Number(payload.auth_date); if (!Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null; const pairs = Object.entries(payload).filter(([key]) => key !== "hash" && payload[key] !== undefined && payload[key] !== null && payload[key] !== "").map(([key, value]) => `${key}=${value}`).sort(); const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest(); const calc = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex"); if (!safeEqual(calc, payload.hash)) return null; return { id: Number(payload.id), username: payload.username || null, first_name: payload.first_name || null, last_name: payload.last_name || null, photo_url: payload.photo_url || null }; } catch { return null; } }
function verifyAdmin(req) { const h = req.headers.authorization || ""; if (!h.startsWith("Bearer ") || !ADMIN_SECRET) return false; try { const [body, sig] = h.slice(7).split("."); if (!body || !sig) return false; const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url"); if (!safeEqual(sig, expected)) return false; const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return p.role === "admin" && Number(p.exp) > Date.now(); } catch { return false; } }
function customer(req) { return verifyTelegram(req.headers["x-telegram-init-data"] || ""); }
function authorizedForUser(req, id) { const n = Number(id); const u = customer(req); return (!!u && Number(u.id) === n) || verifyLinked(req, n) || (n < 0 && verifyGuest(req, n)); }
function sseSend(client, event, data) { try { client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} }
function deliverToClients(message) { for (const c of clients) { if (c.admin || Number(c.chatId) === Number(message?.telegram_id)) sseSend(c, "message", message); } }
function telegramMiniAppOnline(telegramId) { const id = Number(telegramId); return Number.isFinite(id) && [...clients].some(c => c.telegramMiniApp && Number(c.chatId) === id); }
globalThis.__GULI_TELEGRAM_MINIAPP_ONLINE = telegramMiniAppOnline;
const customerProfileCache = new Map();

function extractTelegramPhotoFileId(value) {
  try {
    const raw = String(value || "");
    const match = raw.match(/\/telegram-avatar\/\\d+\/([^?/#]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  } catch { return ""; }
}

function signedAdminPhotoUrl(telegramId, fileId) {
  if (!ADMIN_SECRET || !telegramId || !fileId) return null;
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const signature = crypto.createHmac("sha256", ADMIN_SECRET)
    .update(`${telegramId}.${fileId}.${expires}`)
    .digest("base64url");
  return `/api/admin/users/${telegramId}/photo/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
}

async function getCachedCustomerProfile(telegramId) {
  const key = String(telegramId);
  const cached = customerProfileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.customer;

  const customer = {};
  try {
    const [{ data: user }, { data: canonicalUser }, { data: customerRow }, { data: latestOrder }] = await Promise.all([
      supabase?.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,profile_photos").eq("telegram_id", telegramId).maybeSingle(),
      supabase?.from("users").select("telegram_id,phone_number,full_name,telegram_username,telegram_photo_url").eq("telegram_id", telegramId).maybeSingle(),
      supabase?.from("customers").select("telegram_id,phone,full_name,avatar_url").eq("telegram_id", telegramId).maybeSingle(),
      supabase?.from("orders").select("order_number,username,first_name,phone,telegram_phone,status,total,created_at").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    if (user) Object.assign(customer, user);
    if (canonicalUser) {
      if (!customer.username) customer.username = canonicalUser.telegram_username;
      if (!customer.first_name && canonicalUser.full_name) customer.first_name = canonicalUser.full_name;
      if (!customer.phone) customer.phone = canonicalUser.phone_number || null;
      if (!customer.telegram_photo_url) customer.telegram_photo_url = canonicalUser.telegram_photo_url || null;
    }
    if (customerRow) {
      if (!customer.phone) customer.phone = customerRow.phone || null;
      if (!customer.full_name) customer.full_name = customerRow.full_name || null;
      if (!customer.avatar_url) customer.avatar_url = customerRow.avatar_url || null;
    }
    if (latestOrder) {
      if (!customer.phone) customer.phone = latestOrder.phone || latestOrder.telegram_phone || null;
      if (!customer.telegram_phone) customer.telegram_phone = latestOrder.telegram_phone || null;
      if (!customer.username) customer.username = latestOrder.username || null;
      if (!customer.first_name) customer.first_name = latestOrder.first_name || null;
    }

    const storedPhotoId =
      (Array.isArray(user?.profile_photos) && user.profile_photos.length ? String(user.profile_photos[0] || "") : "") ||
      extractTelegramPhotoFileId(canonicalUser?.telegram_photo_url);

    if (storedPhotoId) customer.photoFileId = storedPhotoId;

    // Telegram profile data is already persisted in the canonical users tables.
    // Keep the photo file id durable so leaving/blocking the bot does not erase
    // the profile shown in the admin chat.
    if (customer.photoFileId && supabase && (!Array.isArray(user?.profile_photos) || !user.profile_photos.includes(customer.photoFileId))) {
      try {
        await supabase.from("telegram_users").upsert({
          telegram_id: telegramId,
          username: customer.username || null,
          first_name: customer.first_name || null,
          last_name: customer.last_name || null,
          telegram_phone: customer.telegram_phone || customer.phone || null,
          profile_photos: [customer.photoFileId],
          profile_photo_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "telegram_id" });
      } catch {}
    }
  } catch (error) {
    console.warn("[Chat realtime] customer CRM/profile enrichment failed:", error.message);
  }

  if (BOT_TOKEN) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${telegramId}`);
      const result = await response.json().catch(() => null);
      const chat = result?.ok ? result.result : null;
      if (chat) {
        customer.username = customer.username || chat.username || null;
        customer.first_name = customer.first_name || chat.first_name || null;
        customer.last_name = customer.last_name || chat.last_name || null;
        const fileId = chat.photo?.big_file_id || chat.photo?.small_file_id || "";
        if (fileId) {
          customer.photoFileId = fileId;
          if (supabase) {
            try {
              await supabase.from("telegram_users").upsert({
                telegram_id: telegramId,
                username: customer.username || null,
                first_name: customer.first_name || null,
                last_name: customer.last_name || null,
                telegram_phone: customer.telegram_phone || customer.phone || null,
                profile_photos: [fileId],
                profile_photo_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: "telegram_id" });
            } catch {}
          }
        }
      }
    } catch (error) {
      console.warn("[Chat realtime] Telegram profile refresh skipped:", error.message);
    }
  }

  customer.photoUrl =
    signedAdminPhotoUrl(telegramId, customer.photoFileId) ||
    customer.avatar_url ||
    customer.telegram_photo_url ||
    null;

  try {
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("telegram_id", telegramId);
    customer.orderCount = Number(count || 0);
    const { data: latestOrder } = await supabase.from("orders").select("order_number,status,total,created_at").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (latestOrder) {
      customer.lastOrderNumber = latestOrder.order_number || null;
      customer.lastOrderStatus = latestOrder.status || null;
      customer.lastOrderTotal = latestOrder.total ?? null;
    }
  } catch {}

  customerProfileCache.set(key, { customer, expiresAt: Date.now() + 5 * 60 * 1000 });
  return customer;
}

async function enrichCustomerMessage(message) {
  if (!message || message.sender !== "customer") return message;
  const telegramId = Number(message.telegram_id);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) return message;

  const customer = await getCachedCustomerProfile(telegramId);
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return {
    ...message,
    userName: fullName || customer.full_name || customer.username || `Telegram #${telegramId}`,
    userPhoto: customer.photoUrl || null,
    metadata: {
      ...(message.metadata || {}),
      source: "telegram",
      customer: {
        ...customer,
        photoUrl: customer.photoUrl || null
      }
    }
  };
}
async function publishRealtime(message) {
  if (!message) return;
  const enriched = await enrichCustomerMessage(message);
  deliverToClients(enriched);
  if (!realtimeChannel) return;
  try { await realtimeChannel.send({ type: "broadcast", event: "chat_message", payload: enriched }); }
  catch (error) { console.warn("[Chat realtime] broadcast failed:", error.message); }
}
// Canonical publisher exposed to Telegram webhook adapters. This keeps every
// persisted chat message on the same SSE/broadcast fanout path.
globalThis.__GULI_CHAT_PUBLISH__ = publishRealtime;
async function telegramSend(chatId, text) { if (!BOT_TOKEN || !chatId) return; try { const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }) }); const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`); } catch (e) { console.warn("[Chat] Telegram notification failed:", e.message); } }
async function notifyAdmins(message) { if (!ADMIN_CHAT_IDS.length || message?.sender !== "customer") return; const id = Number(message.telegram_id); const who = id < 0 ? `Browser guest ${Math.abs(id)}` : `Telegram ${id}`; const text = `💬 <b>Yangi mijoz xabari</b>\n\n👤 ${who}\n📝 ${String(message.text || "").slice(0, 300)}`; await Promise.all(ADMIN_CHAT_IDS.map(cid => telegramSend(cid, text))); }
async function notifyTelegramCustomerIfOffline(message) { if (!message || message.sender !== "admin") return; const id = Number(message.telegram_id); if (!Number.isSafeInteger(id) || id <= 0 || telegramMiniAppOnline(id)) return; const text = "💬 <b>Qo'llab quvvatlash markazidan yangi habar keldi</b>\n\n🔔 Ko'rish uchun Guli Premium bildirishnomalar oynasini oching."; await telegramSend(id, text); }
function startRealtime() { if (realtimeStarted || !supabase) return; realtimeStarted = true; realtimeChannel = supabase.channel(REALTIME_CHANNEL, { config: { broadcast: { self: true } } }); realtimeChannel.on("broadcast", { event: "chat_message" }, payload => deliverToClients(payload.payload));
  realtimeChannel.on("broadcast", { event: "chat_read" }, payload => {
    const data = payload?.payload || {};
    for (const client of clients) {
      if (Number(client.chatId) === Number(data.telegram_id)) sseSend(client, "read_receipt", data);
    }
  }); realtimeChannel.subscribe(status => console.log(`[Chat realtime] ${status}`)); }
function patchGet() { const original = express.application.get; express.application.get = function patchedGet(routePath, ...handlers) {
  if (routePath === "/api/admin/users/:telegramId/photo/:fileId") return original.call(this, routePath, async (req, res) => {
    try {
      const telegramId = Number(req.params.telegramId);
      const fileId = String(req.params.fileId || "");
      const expires = Number(req.query.expires);
      const signature = String(req.query.signature || "");
      if (!ADMIN_SECRET || !Number.isSafeInteger(telegramId) || !fileId || !Number.isFinite(expires) || expires < Math.floor(Date.now()/1000)) return res.status(403).end();
      const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(`${telegramId}.${fileId}.${expires}`).digest("base64url");
      if (!safeEqual(signature, expected)) return res.status(403).end();
      const fileResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const fileJson = await fileResult.json().catch(() => null);
      if (!fileResult.ok || !fileJson?.ok || !fileJson.result?.file_path) return res.status(404).end();
      const image = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileJson.result.file_path}`);
      if (!image.ok) return res.status(502).end();
      res.set("Content-Type", image.headers.get("content-type") || "image/jpeg");
      res.set("Cache-Control", "private, max-age=3600");
      return res.send(Buffer.from(await image.arrayBuffer()));
    } catch (error) {
      console.warn("[Chat realtime] profile photo proxy failed:", error.message);
      return res.status(502).end();
    }
  });
  if (routePath === "/api/chat/guest-session/:guest_id") return original.call(this, routePath, (req, res) => { const id = Number(req.params.guest_id); if (!Number.isSafeInteger(id) || id >= 0 || id < -9007199254740991) return res.status(400).json({ success: false, message: "Noto‘g‘ri guest ID" }); if (!ADMIN_SECRET && !BOT_TOKEN) return res.status(503).json({ success: false, message: "Chat auth secret sozlanmagan" }); return res.json({ success: true, guest_id: id, token: createGuestToken(id), expires_in: 2592000 }); });
  if (routePath === "/api/admin/chat/messages") return original.call(this, routePath, async (req, res) => { if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" }); if (!supabase) return res.status(503).json({ success: false, message: "Chat bazasi sozlanmagan" }); const { data, error } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }); if (error) return res.status(500).json({ success: false, message: "Chat tarixini yuklashda xatolik" }); const enriched = await Promise.all((data || []).map(enrichCustomerMessage)); return res.json({ success: true, data: enriched }); });
  if (routePath === "/api/chat/messages/:telegram_id") return original.call(this, routePath, async (req, res) => { const rawId = String(req.params.telegram_id || ""); const isAdmin = rawId === "all" && verifyAdmin(req); if (!isAdmin && !authorizedForUser(req, rawId)) return res.status(401).json({ success: false, message: "Chat sessiyasi tasdiqlanmadi" }); const { data, error } = await supabase.from("chat_messages").select("*").eq("telegram_id", rawId).order("created_at", { ascending: true }); if (error) return res.status(500).json({ success: false, message: "Chat tarixini yuklashda xatolik" }); const enriched = await Promise.all((data || []).map(enrichCustomerMessage)); return res.json({ success: true, data: enriched }); });
  if (routePath === "/api/chat/stream/:telegram_id") return original.call(this, routePath, (req, res) => { const rawId = String(req.params.telegram_id || ""); const isAdmin = rawId === "all" && verifyAdmin(req); if (!isAdmin && !authorizedForUser(req, rawId)) return res.status(401).json({ success: false, message: "Chat sessiyasi tasdiqlanmadi" }); res.status(200); res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.flushHeaders?.(); const client = { res, chatId: isAdmin ? null : Number(rawId), admin: isAdmin, telegramMiniApp: !isAdmin && Boolean(req.headers["x-telegram-init-data"]) }; clients.add(client); sseSend(client, "ready", { ok: true }); const heartbeat = setInterval(() => { try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {} }, 25000); req.on("close", () => { clearInterval(heartbeat); clients.delete(client); }); });
  return original.call(this, routePath, ...handlers);
}; }
const { install } = require('./routeRegistry.js');
install("get", "/api/admin/chat/messages", async (req, res) => {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  if (!supabase) return res.status(503).json({ success: false, message: "Chat bazasi sozlanmagan" });
  const { data, error } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true });
  if (error) {
    console.warn("[Chat realtime] admin history failed:", error.message);
    return res.status(500).json({ success: false, message: "Chat tarixini yuklashda xatolik" });
  }
  return res.json({ success: true, data: data || [] });
});
install("get", "/api/admin/chat/presence", async (req, res) => {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  const onlineIds = [...clients]
    .filter(c => !c.admin && Number.isFinite(Number(c.chatId)))
    .map(c => String(c.chatId));
  res.json({ success: true, data: { onlineTelegramIds: [...new Set(onlineIds)] } });
});
install("post", "/api/chat/read", async (req, res) => {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  if (!supabase) return res.status(503).json({ success: false, message: "Chat bazasi sozlanmagan" });
  const telegramId = String(req.body?.telegram_id || "").trim();
  if (!/^\d+$/.test(telegramId)) return res.status(400).json({ success: false, message: "Mijoz ID noto'g'ri" });
  const { data: rows, error: readError } = await supabase.from("chat_messages")
    .select("id,metadata")
    .eq("telegram_id", Number(telegramId))
    .eq("sender", "customer");
  if (readError) return res.status(500).json({ success: false, message: "O'qilgan holat saqlanmadi" });
  const readAt = new Date().toISOString();
  const ids = [];
  for (const row of rows || []) {
    const metadata = { ...(row.metadata || {}), read_at: readAt, read_by: "admin" };
    const { error } = await supabase.from("chat_messages").update({ metadata }).eq("id", row.id);
    if (!error) ids.push(String(row.id));
  }
  if (ids.length) {
    for (const client of clients) {
      if (Number(client.chatId) === Number(telegramId)) sseSend(client, "read_receipt", { telegram_id: Number(telegramId), message_ids: ids, read_at: readAt });
    }
    if (realtimeChannel) {
      try { await realtimeChannel.send({ type: "broadcast", event: "chat_read", payload: { telegram_id: Number(telegramId), message_ids: ids, read_at: readAt } }); } catch {}
    }
  }
  return res.json({ success: true, data: { message_ids: ids, read_at: readAt } });
});
install("post", "/api/chat/admin-reply", async (req, res) => {
  if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
  if (!supabase) return res.status(503).json({ success: false, message: "Chat bazasi sozlanmagan" });
  const telegramId = String(req.body?.telegram_id || "").trim();
  const text = String(req.body?.text || "").trim();
  if (!/^\d+$/.test(telegramId) || !text) return res.status(400).json({ success: false, message: "Mijoz va xabar majburiy" });
  let metadata = req.body?.metadata && typeof req.body.metadata === "object" ? { ...req.body.metadata } : {};
  let mediaUrl = String(req.body?.media_url || req.body?.mediaUrl || metadata.mediaUrl || metadata.media_url || "").trim();
  const mediaType = String(req.body?.type || metadata.type || "").toLowerCase();
  if (mediaUrl && mediaUrl.startsWith("data:") && typeof globalThis.__GULI_CHAT_PERSIST_MEDIA__ === "function") {
    try {
      const stored = await globalThis.__GULI_CHAT_PERSIST_MEDIA__({
        telegramId: Number(telegramId),
        type: mediaType || "file",
        mediaUrl,
        fileName: metadata.fileName || metadata.file_name || req.body?.fileName || "file"
      });
      mediaUrl = stored.mediaUrl || mediaUrl;
      metadata = {
        ...metadata,
        mediaUrl,
        mediaPath: stored.mediaPath || metadata.mediaPath,
        fileName: stored.fileName || metadata.fileName,
        mimeType: stored.mimeType || metadata.mimeType,
        type: stored.type || mediaType || "file",
        // Absolute, Telegram-reachable signed URL. Required by
        // customerNotificationService.notifyCustomerAdminChat to relay the
        // image/file to the Telegram customer via sendPhoto/sendDocument -
        // the app's own /api/chat/media-file/... path is not publicly
        // reachable by Telegram's servers. Was previously dropped here
        // (Root Cause / Phase 6).
        telegramMediaUrl: stored.telegramMediaUrl || metadata.telegramMediaUrl
      };
    } catch (e) {
      console.warn("[Chat admin reply] media persistence failed:", e.message);
      return res.status(400).json({ success: false, message: e?.message || "Media faylini saqlab bo‘lmadi" });
    }
  }
  const { data, error } = await supabase.from("chat_messages")
    .insert([{ telegram_id: Number(telegramId), sender: "admin", text, metadata }])
    .select("*").single();
  if (error) return res.status(500).json({ success: false, message: "Xabar saqlanmadi" });
  await publishRealtime(data);
  try {
    const { notifyCustomerAdminChat } = require("./customerNotificationService");
    await notifyCustomerAdminChat(data, req);
  } catch (e) {
    console.warn("[Chat admin reply] Telegram notification failed:", e.message);
  }
  return res.status(201).json({ success: true, data });
});

install("get", "/api/chat/stream/:telegram_id", (req, res) => { const rawId = String(req.params.telegram_id || ""); const isAdmin = rawId === "all" && verifyAdmin(req); if (!isAdmin && !authorizedForUser(req, rawId)) return res.status(401).json({ success: false, message: "Chat sessiyasi tasdiqlanmadi" }); res.status(200); res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.flushHeaders?.(); const client = { res, chatId: isAdmin ? null : Number(rawId), admin: isAdmin, telegramMiniApp: !isAdmin && Boolean(req.headers["x-telegram-init-data"]) }; clients.add(client); sseSend(client, "ready", { ok: true }); const heartbeat = setInterval(() => { try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {} }, 25000); req.on("close", () => { clearInterval(heartbeat); clients.delete(client); }); });
install("post", "/api/chat/browser-login", async (req, res) => { const user = verifyLoginUrlPayload(req.body || {}); if (!user) return res.status(401).json({ success: false, message: "Telegram browser avtorizatsiyasi yaroqsiz yoki muddati tugagan" }); if (!ADMIN_SECRET && !BOT_TOKEN) return res.status(503).json({ success: false, message: "Chat auth secret sozlanmagan" }); return res.json({ success: true, data: { telegram_id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name, photo_url: user.photo_url, token: createLinkedToken(user.id), expires_in: 2592000 } }); });
function patchChatPost() { const original = express.application.post; express.application.post = function patchedPost(routePath, ...handlers) { if (routePath === "/api/chat/messages" && handlers.length) { const index = handlers.length - 1; const handler = handlers[index]; handlers[index] = async function secureChatPost(req, res, next) { const sender = String(req.body?.sender || "").toLowerCase(); const id = Number(req.body?.telegram_id || 0); if (sender === "customer" || sender === "user") { const identity = resolveChatIdentity(req); if (!identity?.verified || !id || Number(identity.telegramId) !== id) return res.status(401).json({ success: false, message: "Mijoz sessiyasi tasdiqlanmadi" }); req.body.sender = "customer"; req.body.telegram_id = id; } else if (sender === "admin") { if (!verifyAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" }); } else return res.status(400).json({ success: false, message: "Noto‘g‘ri chat jo‘natuvchisi" }); let payload = null; const originalJson = res.json.bind(res); res.json = body => { payload = body; return originalJson(body); }; const result = await handler(req, res, next); if (payload?.success && payload?.data) { await publishRealtime(payload.data); await notifyAdmins(payload.data); await notifyTelegramCustomerIfOffline(payload.data); } return result; }; } return original.call(this, routePath, ...handlers); }; }
patchGet(); patchChatPost();
setImmediate(startRealtime);
