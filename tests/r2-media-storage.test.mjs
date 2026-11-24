import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createR2MediaStorage, validateObjectKey, loadConfig } = require("../backend/r2MediaStorage.js");

const config = {
  endpoint: "https://abc123.r2.cloudflarestorage.com",
  bucket: "guli-market-media",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  publicBase: "https://media.example.test",
};

const fixedNow = () => new Date("2026-11-24T09:10:11.000Z");

test("validates object keys and rejects traversal or ambiguous paths", () => {
  assert.equal(validateObjectKey("products/item 1.webp"), "products/item 1.webp");
  for (const key of ["", "/leading.jpg", "../secret", "a/../secret", "a//b", "a\\b", "a\u0000b"]) {
    assert.throws(() => validateObjectKey(key));
  }
});

test("requires HTTPS R2 endpoint and all credential fields", () => {
  assert.throws(() => loadConfig({}, {}), /R2_ENDPOINT/);
  assert.throws(() => loadConfig({}, { ...config, endpoint: "http://r2.example.test" }), /HTTPS/);
  assert.throws(() => loadConfig({}, { ...config, endpoint: "https://r2.example.test/bucket" }), /origin/);
});

test("creates deterministic, method-specific SigV4 presigned URLs", () => {
  const storage = createR2MediaStorage({ config, now: fixedNow, fetch: async () => { throw new Error("network should not be called"); } });
  const put = new URL(storage.presign("PUT", "reels/video 1.mp4", 600));
  const get = new URL(storage.signedReadUrl("reels/video 1.mp4", 300));
  assert.equal(put.hostname, "abc123.r2.cloudflarestorage.com");
  assert.equal(put.pathname, "/guli-market-media/reels/video%201.mp4");
  assert.equal(put.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(put.searchParams.get("X-Amz-Date"), "20261124T091011Z");
  assert.equal(put.searchParams.get("X-Amz-Expires"), "600");
  assert.match(put.searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
  assert.notEqual(put.searchParams.get("X-Amz-Signature"), get.searchParams.get("X-Amz-Signature"));
  assert.equal(get.searchParams.get("X-Amz-Expires"), "300");
  assert.throws(() => storage.presign("DELETE", "reels/video.mp4"));
  assert.throws(() => storage.presign("GET", "reels/video.mp4", 3601));
});

test("public URL encodes key segments and requires an explicit public base", () => {
  const storage = createR2MediaStorage({ config, now: fixedNow });
  assert.equal(storage.publicObjectUrl("products/a b.webp"), "https://media.example.test/products/a%20b.webp");
  const privateStorage = createR2MediaStorage({ config: { ...config, publicBase: "" }, now: fixedNow });
  assert.throws(() => privateStorage.publicObjectUrl("receipts/one.pdf"), /R2_PUBLIC_URL/);
  assert.match(privateStorage.signedReadUrl("receipts/one.pdf"), /^https:\/\//);
});

test("HEAD and PUT use signed URLs and return bounded metadata", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        "content-length": "1234",
        "content-type": "image/webp",
        etag: '"etag-value"',
      }),
    };
  };
  const storage = createR2MediaStorage({ config, now: fixedNow, fetch });
  const head = await storage.headObject("products/a.webp");
  assert.deepEqual(head, { contentLength: 1234, contentType: "image/webp", etag: '"etag-value"' });
  const put = await storage.uploadObject("products/b.webp", Buffer.from("image"), {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });
  assert.deepEqual(put, { etag: '"etag-value"' });
  assert.equal(calls[0].init.method, "HEAD");
  assert.equal(calls[1].init.method, "PUT");
  assert.equal(calls[1].init.headers["Content-Type"], "image/webp");
  assert.equal(calls[1].init.headers["Cache-Control"], "public, max-age=31536000, immutable");
});

test("HEAD and PUT surface non-success HTTP responses without false success", async () => {
  const fetch = async () => ({ ok: false, status: 403, headers: new Headers() });
  const storage = createR2MediaStorage({ config, now: fixedNow, fetch });
  await assert.rejects(storage.headObject("products/a.webp"), /HTTP 403/);
  await assert.rejects(storage.uploadObject("products/a.webp", Buffer.from("x")), /HTTP 403/);
});
