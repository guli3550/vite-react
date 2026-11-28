"use strict";

const crypto = require("node:crypto");
const sharp = require("sharp");
const { uploadMedia, isR2MediaUrl } = require("./r2StorageRuntime");

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(12_000) });
}

async function telegramProfileFileId(telegramId) {
  if (!TELEGRAM_BOT_TOKEN) return "";
  const response = await fetchWithTimeout(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUserProfilePhotos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: Number(telegramId), limit: 1 }),
  });
  const payload = await response.json().catch(() => null);
  const sizes = payload?.ok && Array.isArray(payload.result?.photos) ? payload.result.photos[0] : null;
  if (!Array.isArray(sizes) || !sizes.length) return "";
  return String(sizes[sizes.length - 1]?.file_id || "");
}

async function telegramFileUrl(fileId) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetchWithTimeout(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: String(fileId) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.result?.file_path) {
    throw new Error("Telegram profil rasmini olish imkoni bo'lmadi");
  }
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${payload.result.file_path}`;
}

function safeTelegramPhotoUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "t.me" || !url.pathname.startsWith("/i/userpic/")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function downloadImage(url) {
  const response = await fetchWithTimeout(url, { redirect: "error" });
  if (!response.ok) throw new Error(`Avatar manbasidan HTTP ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType)) {
    throw new Error("Telegram avatar MIME turi ruxsat etilmagan");
  }
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_SOURCE_BYTES) throw new Error("Telegram avatar hajmi 5 MB dan katta");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) throw new Error("Telegram avatar hajmi noto'g'ri");
  return buffer;
}

async function uploadTelegramAvatarToR2({ telegramId, photoUrl, fileId }) {
  const id = Number(telegramId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Telegram ID noto'g'ri");

  let source = null;
  const safePhotoUrl = safeTelegramPhotoUrl(photoUrl);
  if (safePhotoUrl) {
    try { source = await downloadImage(safePhotoUrl); } catch (error) {
      console.warn("[Customer avatar] Telegram photo_url download skipped:", error.message);
    }
  }
  let resolvedFileId = String(fileId || "");
  if (!source && !resolvedFileId) {
    try { resolvedFileId = await telegramProfileFileId(id); } catch (error) {
      console.warn("[Customer avatar] Telegram profile file lookup skipped:", error.message);
    }
  }
  if (!source && resolvedFileId) {
    const url = await telegramFileUrl(resolvedFileId);
    source = await downloadImage(url);
  }
  if (!source) return null;

  const metadata = await sharp(source, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!["jpeg", "png", "webp", "avif"].includes(String(metadata.format || ""))) {
    throw new Error("Avatar rasm formati qo'llab-quvvatlanmaydi");
  }

  const webp = await sharp(source, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();

  const publicBucket = String(process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET_NAME || "").trim();
  if (publicBucket !== "guli-market-media") {
    throw new Error("Avatarlar faqat guli-market-media public bucket'iga yuklanishi mumkin");
  }

  const digest = crypto.createHash("sha256").update(webp).digest("hex").slice(0, 20);
  const path = `${id}/${digest}.webp`;
  const uploaded = await uploadMedia("avatars", path, webp, {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });
  if (!uploaded?.url || !isR2MediaUrl(uploaded.url)) {
    throw new Error("R2 avatar public URL tekshiruvidan o'tmadi");
  }
  return uploaded.url;
}

module.exports = { uploadTelegramAvatarToR2, safeTelegramPhotoUrl, telegramProfileFileId };
