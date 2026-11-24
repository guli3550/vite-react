const { createR2MediaStorage } = require("./r2MediaStorage.js");

const PUBLIC_BUCKETS = new Set(["reels-media", "video-ads", "product-images", "review-images"]);
const PRIVATE_BUCKETS = new Set(["chat-media", "payment-receipts"]);
const instances = new Map();

function clean(value) { return String(value || "").trim(); }

function storageFor(sourceBucket) {
  const bucket = clean(sourceBucket);
  const isPublic = PUBLIC_BUCKETS.has(bucket);
  if (!isPublic && !PRIVATE_BUCKETS.has(bucket)) throw new Error("R2 storage bucket ruxsat etilmagan");
  const targetBucket = clean(isPublic ? process.env.R2_PUBLIC_BUCKET_NAME : process.env.R2_PRIVATE_BUCKET_NAME);
  const endpoint = clean(process.env.R2_ENDPOINT);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  if (!targetBucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY va public/private bucket nomlari talab qilinadi");
  }
  if (isPublic && !clean(process.env.R2_PUBLIC_URL)) {
    throw new Error("R2_PUBLIC_URL public media uchun sozlanmagan");
  }
  const cacheKey = [bucket, targetBucket, endpoint, accessKeyId].join("|");
  if (instances.has(cacheKey)) return instances.get(cacheKey);
  const storage = createR2MediaStorage({
    config: {
      endpoint,
      bucket: targetBucket,
      accessKeyId,
      secretAccessKey,
      publicBase: isPublic ? clean(process.env.R2_PUBLIC_URL) : "",
    },
  });
  instances.set(cacheKey, storage);
  return storage;
}

function objectKey(sourceBucket, path) {
  const cleanPath = clean(path).replace(/^\/+/, "");
  if (!cleanPath || cleanPath.split("/").some((part) => !part || part === "." || part === "..") || cleanPath.includes("\\")) {
    throw new Error("Storage object path noto‘g‘ri");
  }
  return clean(sourceBucket) + "/" + cleanPath;
}

async function uploadObject(sourceBucket, path, body, options = {}) {
  const storage = storageFor(sourceBucket);
  const key = objectKey(sourceBucket, path);
  await storage.uploadObject(key, body, {
    contentType: options.contentType,
    cacheControl: options.cacheControl || (PRIVATE_BUCKETS.has(sourceBucket) ? "private, no-store" : "public, max-age=31536000, immutable"),
  });
  return { key, url: PUBLIC_BUCKETS.has(sourceBucket) ? storage.publicObjectUrl(key) : null };
}

function publicUrl(sourceBucket, path) {
  if (!PUBLIC_BUCKETS.has(sourceBucket)) throw new Error("Private media uchun public URL taqiqlangan");
  return storageFor(sourceBucket).publicObjectUrl(objectKey(sourceBucket, path));
}

function signedReadUrl(sourceBucket, path, expiresIn = 300) {
  if (!PRIVATE_BUCKETS.has(sourceBucket)) throw new Error("Signed private URL faqat private bucketlar uchun");
  return storageFor(sourceBucket).signedReadUrl(objectKey(sourceBucket, path), expiresIn);
}

function signedUploadUrl(sourceBucket, path, expiresIn = 600) {
  if (!PUBLIC_BUCKETS.has(sourceBucket) && !PRIVATE_BUCKETS.has(sourceBucket)) throw new Error("R2 storage bucket ruxsat etilmagan");
  const storage = storageFor(sourceBucket);
  const key = objectKey(sourceBucket, path);
  return { url: storage.presign("PUT", key, expiresIn), key, publicUrl: PUBLIC_BUCKETS.has(sourceBucket) ? storage.publicObjectUrl(key) : null };
}

async function deleteObject(sourceBucket, path) {
  return storageFor(sourceBucket).deleteObject(objectKey(sourceBucket, path));
}

function resolvePublicUrl(value, expectedBucket) {
  const input = clean(value);
  if (!input) return input;
  try {
    const parsed = new URL(input);
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return input;
    const sourceBucket = decodeURIComponent(match[1]);
    if (expectedBucket && sourceBucket !== expectedBucket) return input;
    return publicUrl(sourceBucket, decodeURIComponent(match[2]));
  } catch {
    return input;
  }
}

module.exports = { PUBLIC_BUCKETS, PRIVATE_BUCKETS, storageFor, objectKey, uploadObject, publicUrl, signedReadUrl, signedUploadUrl, deleteObject, resolvePublicUrl };
