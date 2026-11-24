// Private chat media storage bridge.
// Stores customer/admin chat attachments in Supabase Storage instead of browser localStorage/base64.
const express = require("express");
const crypto = require("crypto");
const { uploadObject, signedReadUrl } = require("./r2StorageRuntime.js");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SIGNING_SECRET = ADMIN_SECRET || BOT_TOKEN;
const BUCKET = "chat-media";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB for video, voice, PDF, docs, images
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const originalJson = express.json;
express.json = function chatMediaJson(options = {}) { return originalJson.call(this, { ...options, limit: "30mb" }); };
function safeEqual(a, b) { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function admin(req) {
  const secret = ADMIN_SECRET || BOT_TOKEN;
  if (!secret) return false;
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return false;
  try {
    const [body, sig] = h.slice(7).split(".");
    if (!body || !sig) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET || secret).update(body).digest("base64url");
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const validSig = safeEqual(sig, expected) || safeEqual(sig, crypto.createHmac("sha256", secret).update(body).digest("base64url"));
    return validSig && p.role === "admin" && Number(p.exp) > Date.now();
  } catch { return false; }
}
function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const p = new URLSearchParams(initData); const hash = p.get("hash"); const authDate = Number(p.get("auth_date"));
    if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const pairs = []; p.forEach((v, k) => { if (k !== "hash") pairs.push(`${k}=${v}`); }); pairs.sort();
    const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const calc = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
    if (!safeEqual(calc, hash)) return null; const u = JSON.parse(p.get("user") || "null"); return u?.id ? Number(u.id) : null;
  } catch { return null; }
}
function chatTokenValid(req, id) {
  const n = Number(id), secret = SIGNING_SECRET; if (!secret) return false;
  const linked = String(req.headers["x-guli-linked-token"] || ""); const lp = linked.split(".");
  if (lp.length === 4 && lp[0] === "linked" && Number(lp[1]) === n && Number(lp[2]) > Date.now()) {
    const expected = crypto.createHmac("sha256", secret).update(`linked.${lp[1]}.${lp[2]}`).digest("base64url"); if (safeEqual(lp[3], expected)) return true;
  }
  const guest = String(req.headers["x-guli-guest-token"] || ""); const gp = guest.split(".");
  if (gp.length === 3 && Number(gp[0]) === n && Number(gp[1]) > Date.now()) {
    const expected = crypto.createHmac("sha256", secret).update(`${gp[0]}.${gp[1]}`).digest("base64url"); if (safeEqual(gp[2], expected)) return true;
  }
  if (gp.length === 2) { try { const expected = crypto.createHmac("sha256", secret).update(gp[0]).digest("base64url"); const p = JSON.parse(Buffer.from(gp[0], "base64url").toString("utf8")); if (safeEqual(gp[1], expected) && (Number(p.guestId) === n || !n) && Number(p.exp) > Date.now()) return true; } catch {} }
  return false;
}
function customCustomer(req) { const h = String(req.headers.authorization || ""); if (!h.startsWith("Bearer ")) return null; return verifyAccessToken(h.slice(7)); }
function authorized(req, id) { if (admin(req)) return true; const n = Number(id); const tg = telegramUser(String(req.headers["x-telegram-init-data"] || "")); if (tg && tg === n) return true; const jwt = customCustomer(req); if (jwt && Number(jwt.telegram_id) === n) return true; return chatTokenValid(req, n); }
function decodeData(raw) {
  const s = String(raw || "").replace(/^data:[^;]+(?:;[^;,]+)*;base64,/i, "");
  const maxB64Len = Math.ceil(MAX_BYTES * 1.42) + 64;
  if (!s || s.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Fayl noto‘g‘ri kodlangan");
  if (s.length > maxB64Len) throw new Error("Fayl hajmi 20 MB dan oshmasligi kerak");
  const b = Buffer.from(s, "base64");
  if (!b.length || b.length > MAX_BYTES) throw new Error("Fayl hajmi 20 MB dan oshmasligi kerak");
  return b;
}
function canonicalMimeAlias(mime) {
  const base = String(mime || "").toLowerCase().split(";")[0].trim();
  const aliases = {
    "image/jpg": "image/jpeg",
    "audio/mp3": "audio/mpeg",
    "audio/x-mpeg": "audio/mpeg",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "video/x-m4v": "video/mp4",
    "application/x-pdf": "application/pdf",
  };
  return aliases[base] || base;
}
function mimeFromFilename(name, typeHint) {
  const lower = String(name || "").toLowerCase();
  const extMap = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".webm": typeHint === "audio" ? "audio/webm" : "video/webm",
    ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".aac": "audio/aac", ".m4a": "audio/mp4",
    ".mp4": typeHint === "audio" ? "audio/mp4" : "video/mp4",
    ".mov": "video/quicktime", ".3gp": "video/3gpp",
    ".pdf": "application/pdf", ".txt": "text/plain", ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  for (const [ext, m] of Object.entries(extMap)) {
    if (lower.endsWith(ext)) return m;
  }
  return "";
}
function extFor(mime, name) {
  const n = String(name || "").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExts = new Set(["jpg", "jpeg", "png", "webp", "gif", "webm", "ogg", "oga", "opus", "mp4", "m4a", "mp3", "wav", "aac", "mov", "3gp", "pdf", "txt", "zip", "doc", "docx", "xls", "xlsx"]);
  if (n && safeExts.has(n)) return n;
  const map = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/aac": "aac",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/3gpp": "3gp",
    "application/pdf": "pdf", "text/plain": "txt", "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[canonicalMimeAlias(mime)] || "bin";
}
function validMime(mime) {
  const m = canonicalMimeAlias(mime);
  return ALLOWED_MIME_TYPES.includes(m);
}
function sniffMime(buffer, fileName, typeHint) {
  if (!buffer || buffer.length < 4) return "";
  const h = buffer.subarray(0, 16);
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return "image/jpeg";
  if (h.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  if (h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (h.toString("ascii", 0, 6) === "GIF87a" || h.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
  if (h.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (h.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (h.toString("hex", 0, 4) === "1a45dfa3") return typeHint === "audio" ? "audio/webm" : "video/webm";
  if (h.toString("ascii", 4, 8) === "ftyp") {
    const brand = h.toString("ascii", 8, 12).toLowerCase();
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("3gp")) return "video/3gpp";
    return typeHint === "audio" ? "audio/mp4" : "video/mp4";
  }
  if (h.toString("ascii", 0, 3) === "ID3" || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (h.toString("hex", 0, 4) === "504b0304") {
    const byName = mimeFromFilename(fileName, typeHint);
    if (byName) return byName;
    return "application/zip";
  }
  if (h.toString("hex", 0, 8) === "d0cf11e0a1b11ae1") {
    const byName = mimeFromFilename(fileName, typeHint);
    return byName || "application/msword";
  }
  return "";
}
function normalizeMime(mime, buffer, fileName, typeHint) {
  const normalized = canonicalMimeAlias(mime);
  if (validMime(normalized)) return normalized;
  const sniffed = sniffMime(buffer, fileName, typeHint);
  if (validMime(sniffed)) return sniffed;
  const byName = mimeFromFilename(fileName, typeHint);
  return validMime(byName) ? byName : "";
}
function validMagic(buffer, mime) {
  const m = canonicalMimeAlias(mime);
  const h = buffer.subarray(0, 16);
  if (m === "image/jpeg") return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  if (m === "image/png") return h.toString("hex", 0, 8) === "89504e470d0a1a0a";
  if (m === "image/webp") return h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WEBP";
  if (m === "audio/wav") return h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WAVE";
  if (m === "image/gif") return h.toString("ascii", 0, 6) === "GIF87a" || h.toString("ascii", 0, 6) === "GIF89a";
  if (m === "application/pdf") return h.toString("ascii", 0, 5) === "%PDF-";
  if (m === "audio/ogg") return h.toString("ascii", 0, 4) === "OggS";
  if (m === "video/webm" || m === "audio/webm") return h.toString("hex", 0, 4) === "1a45dfa3";
  if (m === "video/mp4" || m === "audio/mp4" || m === "video/quicktime" || m === "video/3gpp") {
    return h.toString("ascii", 4, 8) === "ftyp" || h.toString("ascii", 4, 8) === "moov" || h.toString("ascii", 4, 8) === "mdat";
  }
  if (m === "application/zip" || m.includes("openxmlformats-officedocument")) {
    return h.toString("hex", 0, 4) === "504b0304" || h.toString("hex", 0, 4) === "504b0506";
  }
  if (m === "application/msword" || m === "application/vnd.ms-excel") {
    return h.toString("hex", 0, 8) === "d0cf11e0a1b11ae1" || h.toString("ascii", 0, 5) === "{\\rtf";
  }
  if (m === "text/plain") {
    return !h.includes(0x00);
  }
  return validMime(m);
}

function signPath(path, fileName) {
  const exp = Date.now() + TOKEN_TTL;
  const body = Buffer.from(JSON.stringify({ path, exp, ...(fileName ? { fileName } : {}) })).toString("base64url");
  const sig = crypto.createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyPath(token) {
  if (!token || !SIGNING_SECRET) return null;
  try {
    const [body, sig] = String(token).split(".");
    const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(body).digest("base64url");
    if (!safeEqual(sig, expected)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.path || Number(p.exp) <= Date.now()) return null;
    return p;
  } catch { return null; }
}
function inferChatTypeFromMime(mimeType, explicitType) {
  if (explicitType === "video_note") return "video_note";
  const m = canonicalMimeAlias(mimeType);
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (explicitType && ["image", "video", "video_note", "audio", "file"].includes(explicitType)) return explicitType;
  return "file";
}
async function persistInlineChatMedia({ telegramId, type, mediaUrl, fileName }) {
  const raw = String(mediaUrl || "");
  if (!raw.startsWith("data:")) return { mediaUrl: raw, mediaPath: null, fileName: fileName || null };
  const match = raw.match(/^data:([^;]+)(?:;[^;,]+)*;base64,(.+)$/i);
  if (!match) throw new Error("Chat media data URL noto‘g‘ri");
  const buffer = decodeData(raw);
  const safeName = String(fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const mimeType = normalizeMime(match[1], buffer, safeName, type);
  if (!mimeType) throw new Error("Bu fayl turi qo‘llab-quvvatlanmaydi");
  if (!validMagic(buffer, mimeType)) throw new Error("Fayl formati noto‘g‘ri");
  const id = Number.isSafeInteger(Number(telegramId)) ? Number(telegramId) : 0;
  const path = `messages/${id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extFor(mimeType, safeName)}`;
  await uploadObject(BUCKET, path, buffer, { contentType: mimeType });
  const token = signPath(path, safeName);
  let telegramMediaUrl = "";
  try {
    telegramMediaUrl = signedReadUrl(BUCKET, path, 3600);
  } catch {}
  const resolvedType = inferChatTypeFromMime(mimeType, String(type || ""));
  return { mediaUrl: `/api/chat/media-file/${token}`, telegramMediaUrl, mediaPath: path, fileName: safeName, mimeType, type: resolvedType };
}
globalThis.__GULI_CHAT_PERSIST_MEDIA__ = persistInlineChatMedia;
async function persistTelegramChatMedia({ telegramId, fileId, fileName, type, mimeHint }) {
  if (!BOT_TOKEN || !fileId) return null;
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileJson = await fileRes.json().catch(() => null);
  if (!fileRes.ok || !fileJson?.ok || !fileJson?.result?.file_path) {
    throw new Error(fileJson?.description || "Telegram fayl yo'li olinmadi");
  }
  const mediaResp = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileJson.result.file_path}`);
  if (!mediaResp.ok) throw new Error("Telegramdan media yuklab olinmadi");
  const buffer = Buffer.from(await mediaResp.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error("Telegram media hajmi 20 MB dan oshdi");
  const safeName = String(fileName || fileJson.result.file_path.split("/").pop() || "telegram-media").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "telegram-media";
  const headerMime = String(mediaResp.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  const candidateMime = (headerMime && headerMime !== "application/octet-stream")
    ? headerMime
    : (mimeHint || mimeFromFilename(fileJson.result.file_path, type) || mimeFromFilename(safeName, type) || "");
  const mimeType = normalizeMime(candidateMime, buffer, safeName, type);
  if (!mimeType) throw new Error("Telegram media turi qo'llab-quvvatlanmaydi");
  if (!validMagic(buffer, mimeType)) throw new Error("Telegram media formati noto'g'ri");
  const id = Number.isSafeInteger(Number(telegramId)) ? Number(telegramId) : 0;
  const path = `messages/${id}/telegram-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extFor(mimeType, safeName)}`;
  await uploadObject(BUCKET, path, buffer, { contentType: mimeType });
  const token = signPath(path, safeName);
  return { mediaUrl: `/api/chat/media-file/${token}`, mediaPath: path, fileName: safeName, mimeType, type: inferChatTypeFromMime(mimeType, String(type || "")) };
}
globalThis.__GULI_CHAT_PERSIST_TELEGRAM_MEDIA__ = persistTelegramChatMedia;
const { install } = require('./routeRegistry.js');
install("post", "/api/chat/media-upload", async (req, res) => {
  try {
    let id = Number(req.body?.telegram_id);
    const isAdmin = admin(req);
    if (!Number.isSafeInteger(id)) {
      const guest = String(req.headers["x-guli-guest-token"] || "");
      const gp = guest.split(".");
      if (gp.length === 2) { try { const p = JSON.parse(Buffer.from(gp[0], "base64url").toString("utf8")); if (Number.isSafeInteger(Number(p.guestId))) id = Number(p.guestId); } catch {} }
      else if (gp.length === 3 && Number.isSafeInteger(Number(gp[0]))) id = Number(gp[0]);
      if (!Number.isSafeInteger(id)) { const tg = telegramUser(String(req.headers["x-telegram-init-data"] || "")); if (tg) id = tg; }
      const jwt = customCustomer(req);
      if (!Number.isSafeInteger(id) && jwt && Number.isSafeInteger(Number(jwt.telegram_id))) id = Number(jwt.telegram_id);
      if (!Number.isSafeInteger(id) && isAdmin) id = 0;
    }
    if ((!Number.isSafeInteger(id) || !authorized(req, id)) && !isAdmin) {
      return res.status(401).json({ success: false, message: "Chat sessiyasi tasdiqlanmadi" });
    }
    const safeName = String(req.body?.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
    const reqType = String(req.body?.type || "");
    const buffer = decodeData(req.body?.data);
    const rawMime = String(req.body?.mimeType || req.body?.mime_type || "");
    const mimeType = normalizeMime(rawMime, buffer, safeName, reqType);
    if (!mimeType) return res.status(400).json({ success: false, message: "Bu fayl turi qo‘llab-quvvatlanmaydi" });
    if (!validMagic(buffer, mimeType)) return res.status(400).json({ success: false, message: "Fayl formati noto‘g‘ri" });
      const path = `messages/${id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extFor(mimeType, safeName)}`;
    await uploadObject(BUCKET, path, buffer, { contentType: mimeType });
    const token = signPath(path, safeName);
    let telegramMediaUrl = "";
    telegramMediaUrl = signedReadUrl(BUCKET, path, 3600);
    const resolvedType = inferChatTypeFromMime(mimeType, reqType);
    return res.json({ success: true, data: { mediaUrl: `/api/chat/media-file/${token}`, telegramMediaUrl, mediaPath: path, fileName: safeName, type: resolvedType, mimeType } });
  } catch (e) {
    console.error("Chat media upload error:", e);
    const status = /20 MB|hajmi/i.test(String(e?.message || "")) ? 413 : 500;
    return res.status(status).json({ success: false, message: e?.message || "Faylni saqlashda xatolik" });
  }
});
install("get", "/api/chat/media-file/:token", async (req, res) => {
  try {
    const parsed = verifyPath(req.params.token);
    if (!parsed?.path) return res.status(404).json({ success: false, message: "Fayl havolasi eskirgan yoki yaroqsiz" });
      const signedUrl = signedReadUrl(BUCKET, parsed.path, 3600);
    if (!signedUrl) return res.status(404).json({ success: false, message: "Fayl Storage'da topilmadi" });
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.redirect(302, signedUrl);
  } catch (e) {
    console.error("Chat media proxy error:", e);
    return res.status(500).json({ success: false, message: "Faylni ochishda xatolik" });
  }
});