import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { getR2Candidate, resolveBannerMedia } = require("../backend/bannerMedia.js");
const legacy = "https://qttwufydrvdwmhxcpgjb.supabase.co/storage/v1/object/public/product-images/banners/example-1600.webp";
const expected = "https://media.gulii.uz/product-images/banners/example-1600.webp";

test("maps only legacy public banner objects to the canonical R2 path", () => {
  assert.equal(getR2Candidate(legacy), expected);
  assert.equal(getR2Candidate("https://qttwufydrvdwmhxcpgjb.supabase.co/storage/v1/object/public/reels-media/a.mp4"), null);
  assert.equal(getR2Candidate("https://media.gulii.uz/product-images/banners/a.webp"), null);
});

test("uses R2 only after HEAD confirms the public object exists", async () => {
  const result = await resolveBannerMedia(legacy, { fetch: async (url, options) => {
    assert.equal(url, expected);
    assert.equal(options.method, "HEAD");
    return { ok: true, status: 200, headers: { get: (name) => name === "content-type" ? "image/webp" : "12345" } };
  }});
  assert.equal(result.url, expected);
  assert.equal(result.available, true);
  assert.equal(result.missing, false);
});

test("marks confirmed R2 404 as missing without fabricating a working URL", async () => {
  const result = await resolveBannerMedia(legacy, { fetch: async () => ({ ok: false, status: 404, headers: { get: () => null } }) });
  assert.equal(result.url, legacy);
  assert.equal(result.available, false);
  assert.equal(result.missing, true);
});

test("does not treat network/server errors as proof that an object is missing", async () => {
  const result = await resolveBannerMedia(legacy, { fetch: async () => ({ ok: false, status: 503, headers: { get: () => null } }) });
  assert.equal(result.url, legacy);
  assert.equal(result.available, false);
  assert.equal(result.missing, false);
});
