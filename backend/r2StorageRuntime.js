"use strict";

const { createR2MediaStorage } = require("./r2MediaStorage");

const PUBLIC_BUCKETS = new Set(["reels-media", "video-ads", "product-images", "review-images", "avatars"]);
const PRIVATE_BUCKETS = new Set(["chat-media", "payment-receipts"]);
const clients = new Map();

function clean(value) { return String(value || "").trim().replace(/^['"]|['"]$/g, ""); }
function getBucketName(sourceBucket) {
  if (PUBLIC_BUCKETS.has(sourceBucket)) return clean(process.env.R2_PUBLIC_BUCKET_NAME || process.env.R2_BUCKET_NAME) || "guli-market-media";
  if (PRIVATE_BUCKETS.has(sourceBucket)) return clean(process.env.R2_PRIVATE_BUCKET_NAME) || "guli-market-private";
  throw new Error("R2 uchun ruxsat etilmagan source bucket");
}
function getR2Storage(sourceBucket) {
  const bucket = getBucketName(sourceBucket);
  if (clients.has(bucket)) return clients.get(bucket);
  const endpoint = clean(process.env.R2_ENDPOINT);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID va R2_SECRET_ACCESS_KEY Render'da sozlanishi kerak");
  const isPublic = PUBLIC_BUCKETS.has(sourceBucket);
  const publicBase = isPublic ? clean(process.env.R2_PUBLIC_URL) : "";
  const storage = createR2MediaStorage({ config: { endpoint, bucket, accessKeyId, secretAccessKey, publicBase } });
  clients.set(bucket, storage);
  return storage;
}
function objectKey(sourceBucket, path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!cleanPath || cleanPath.split("/").some((part) => !part || part === "." || part === "..") || cleanPath.includes("\\") || /[\u0000-\u001f\u007f]/.test(cleanPath)) {
    throw new Error("Media object path noto'g'ri");
  }
  return sourceBucket + "/" + cleanPath;
}
async function uploadMedia(sourceBucket, path, body, options = {}) {
  const storage = getR2Storage(sourceBucket);
  const key = objectKey(sourceBucket, path);
  const isPublic = PUBLIC_BUCKETS.has(sourceBucket);
  await storage.uploadObject(key, body, {
    contentType: options.contentType || "application/octet-stream",
    cacheControl: options.cacheControl || (isPublic ? "public, max-age=31536000, immutable" : "private, no-store"),
    expiresIn: 600,
  });
  const head = await storage.headObject(key);
  const expectedSize = Buffer.isBuffer(body) ? body.length : Number(body?.byteLength ?? body?.length);
  if (Number.isFinite(expectedSize) && head.contentLength !== expectedSize) throw new Error("R2 upload HEAD size verification failed");
  return { key, url: isPublic ? storage.publicObjectUrl(key) : null, head };
}
function createMediaUploadUrl(sourceBucket, path, expiresIn = 600) {
  if (!PUBLIC_BUCKETS.has(sourceBucket)) throw new Error("Browser direct-upload faqat public media uchun ruxsat etilgan");
  const storage = getR2Storage(sourceBucket);
  const key = objectKey(sourceBucket, path);
  return { uploadUrl: storage.presign("PUT", key, expiresIn), publicUrl: storage.publicObjectUrl(key), key };
}
function createPrivateReadUrl(sourceBucket, path, expiresIn = 300) {
  if (!PRIVATE_BUCKETS.has(sourceBucket)) throw new Error("Private read faqat private media uchun ruxsat etilgan");
  return getR2Storage(sourceBucket).signedReadUrl(objectKey(sourceBucket, path), expiresIn);
}
async function readPrivateMedia(sourceBucket, path, expiresIn = 300) {
  const url = createPrivateReadUrl(sourceBucket, path, expiresIn);
  const response = await fetch(url);
  if (!response.ok) throw new Error("R2 private media read failed (HTTP " + response.status + ")");
  return { response, buffer: Buffer.from(await response.arrayBuffer()) };
}
async function deleteMedia(sourceBucket, path) {
  const storage = getR2Storage(sourceBucket);
  const key = objectKey(sourceBucket, path);
  const response = await fetch(storage.presign("DELETE", key, 60), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error("R2 media delete failed (HTTP " + response.status + ")");
  return true;
}
function isR2MediaUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const base = clean(process.env.R2_PUBLIC_URL);
    return Boolean(base && url.origin === new URL(base).origin && url.pathname.startsWith(new URL(base).pathname.replace(/\/$/, "") + "/"));
  } catch { return false; }
}
function extractR2Key(sourceBucket, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https:\/\//i.test(raw)) return raw.replace(/^\/+/, "");
  try {
    const url = new URL(raw);
    const base = clean(process.env.R2_PUBLIC_URL);
    if (!base || url.origin !== new URL(base).origin) return "";
    const prefix = new URL(base).pathname.replace(/\/$/, "") + "/";
    if (!url.pathname.startsWith(prefix)) return "";
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return key.startsWith(sourceBucket + "/") ? key.slice(sourceBucket.length + 1) : "";
  } catch { return ""; }
}

module.exports = {
  PUBLIC_BUCKETS, PRIVATE_BUCKETS, getR2Storage, uploadMedia,
  createMediaUploadUrl, createPrivateReadUrl, readPrivateMedia,
  deleteMedia, isR2MediaUrl, extractR2Key, objectKey,
};
