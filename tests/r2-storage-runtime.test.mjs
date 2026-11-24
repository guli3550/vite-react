import test from "node:test";
import assert from "node:assert/strict";

const original = {
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BUCKET_NAME: process.env.R2_PUBLIC_BUCKET_NAME,
  R2_PRIVATE_BUCKET_NAME: process.env.R2_PRIVATE_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
};

process.env.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
process.env.R2_ACCESS_KEY_ID = "test-access";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_PUBLIC_BUCKET_NAME = "guli-market-media";
process.env.R2_PRIVATE_BUCKET_NAME = "guli-market-private";
process.env.R2_PUBLIC_URL = "https://media.example.test";

const runtime = require("../backend/r2StorageRuntime.js");

test("maps legacy Supabase public URLs to bucket-prefixed R2 URLs", () => {
  const input = "https://project.supabase.co/storage/v1/object/public/reels-media/videos/clip%20one.mp4";
  assert.equal(
    runtime.resolvePublicUrl(input, "reels-media"),
    "https://media.example.test/reels-media/videos/clip%20one.mp4"
  );
});

test("does not rewrite URLs from an unexpected bucket or unrelated host path", () => {
  const input = "https://project.supabase.co/storage/v1/object/public/other/file.jpg";
  assert.equal(runtime.resolvePublicUrl(input, "reels-media"), input);
  const unrelated = "https://cdn.example.test/image.jpg";
  assert.equal(runtime.resolvePublicUrl(unrelated, "product-images"), unrelated);
});

test("builds public object URLs with the source bucket prefix", () => {
  assert.equal(
    runtime.publicUrl("product-images", "products/a.webp"),
    "https://media.example.test/product-images/products/a.webp"
  );
});

test("keeps private media on the private bucket and signs reads for at most one hour", () => {
  const signed = runtime.signedReadUrl("payment-receipts", "receipts/order/receipt.pdf", 86400);
  const parsed = new URL(signed);
  assert.match(parsed.pathname, /guli-market-private\/payment-receipts\/receipts\/order\/receipt\.pdf$/);
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "3600");
});

test("rejects path traversal and unsupported storage buckets", () => {
  assert.throws(() => runtime.objectKey("chat-media", "../private.txt"), /path noto/);
  assert.throws(() => runtime.objectKey("unknown-bucket", "file.jpg"), /Storage object path/);
});
