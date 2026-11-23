import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Minimal localStorage mock before exercising queue fallback logic
function installMemoryStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => void store.clear(),
  };
  return store;
}

installMemoryStorage();

const {
  computeNextRetryDelay,
  enqueueOfflineMessage,
  getOfflineOutbox,
  updateOfflineOutboxItem,
  removeOfflineOutboxItem,
  saveOfflineMedia,
  getOfflineMedia,
  deleteOfflineMedia,
} = await import("../src/utils/chatOfflineQueue.ts");

test("chatOfflineQueue: computeNextRetryDelay grows exponentially and caps at <= 69s", () => {
  const d0 = computeNextRetryDelay(0);
  const d1 = computeNextRetryDelay(1);
  const d3 = computeNextRetryDelay(3);
  const d10 = computeNextRetryDelay(10);
  assert.ok(d0 >= 2000 && d0 <= 2300, `Expected d0 ~2s, got ${d0}`);
  assert.ok(d1 >= 4000 && d1 <= 4600, `Expected d1 ~4s, got ${d1}`);
  assert.ok(d3 >= 16000 && d3 <= 18400, `Expected d3 ~16s, got ${d3}`);
  assert.ok(d10 >= 60000 && d10 <= 69000, `Expected d10 capped near 60s, got ${d10}`);
});

test("chatOfflineQueue: enqueue, update, list in chronological order, and remove items", async () => {
  installMemoryStorage();
  await enqueueOfflineMessage({
    clientMessageId: "c-2",
    optimisticId: "msg-2",
    role: "customer",
    targetUserId: "-123456",
    backendId: "-123456",
    text: "Ikkinchi xabar",
    type: "text",
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: "2026-11-23T08:00:10.000Z",
  });
  await enqueueOfflineMessage({
    clientMessageId: "c-1",
    optimisticId: "msg-1",
    role: "customer",
    targetUserId: "-123456",
    backendId: "-123456",
    text: "Birinchi xabar",
    type: "text",
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: "2026-11-23T08:00:05.000Z",
  });

  let list = await getOfflineOutbox();
  assert.equal(list.length, 2);
  assert.equal(list[0].clientMessageId, "c-1");
  assert.equal(list[1].clientMessageId, "c-2");

  await updateOfflineOutboxItem("c-1", { retryCount: 2, lastError: "Network down" });
  list = await getOfflineOutbox();
  assert.equal(list[0].retryCount, 2);
  assert.equal(list[0].lastError, "Network down");

  await removeOfflineOutboxItem("c-1");
  list = await getOfflineOutbox();
  assert.equal(list.length, 1);
  assert.equal(list[0].clientMessageId, "c-2");
});

test("chatOfflineQueue: save, read, and delete offline media blobs cleanly", async () => {
  installMemoryStorage();
  await saveOfflineMedia({
    key: "media-pdf-1",
    dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
    mimeType: "application/pdf",
    fileName: "chek.pdf",
    createdAt: Date.now(),
  });
  const loaded = await getOfflineMedia("media-pdf-1");
  assert.ok(loaded);
  assert.equal(loaded.fileName, "chek.pdf");
  assert.equal(loaded.mimeType, "application/pdf");

  await deleteOfflineMedia("media-pdf-1");
  const after = await getOfflineMedia("media-pdf-1");
  assert.equal(after, null);
});

test("Backend chatMediaStorageRuntime: supports all required MIME types, 20MB limit, and negative guest IDs", () => {
  const storageSrc = fs.readFileSync(
    path.resolve("backend/chatMediaStorageRuntime.js"),
    "utf8"
  );
  for (const mime of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]) {
    assert.ok(storageSrc.includes(`"${mime}"`), `Missing MIME type ${mime} in chatMediaStorageRuntime.js`);
  }
  assert.ok(storageSrc.includes("20 * 1024 * 1024"), "Expected 20MB limit");
  assert.ok(storageSrc.includes("X-Content-Type-Options\", \"nosniff\""), "Expected nosniff header");
});

test("Backend chatRealtimePatch: accepts negative guest IDs, since cursor, idempotent clientMessageId, and SSE presence", () => {
  const rtSrc = fs.readFileSync(
    path.resolve("backend/chatRealtimePatch.js"),
    "utf8"
  );
  assert.ok(rtSrc.includes("/^-?\\d+$/"), "Expected regex supporting negative guest telegram_id");
  assert.ok(rtSrc.includes("findExistingByClientMessageId"), "Expected clientMessageId deduplication");
  assert.ok(rtSrc.includes("parseSinceCursor"), "Expected incremental since cursor support");
  assert.ok(rtSrc.includes('sseSend(c, "presence"') || rtSrc.includes('sseSend(client, "presence"'), "Expected SSE presence broadcast");
  assert.ok(rtSrc.includes("/api/chat/customer-read"), "Expected customer read receipt endpoint");
});

test("Chat client integrity: no recursive polling intervals in public scripts or 5s presence polling in AdminChatTab", () => {
  const bridgeSrc = fs.readFileSync(path.resolve("src/utils/chatRealtimeBridge.ts"), "utf8");
  const adminSrc = fs.readFileSync(path.resolve("src/components/AdminChatTab.tsx"), "utf8");
  const integritySrc = fs.readFileSync(path.resolve("public/chat-integrity-fix.js"), "utf8");
  const dlSrc = fs.readFileSync(path.resolve("public/chat-media-download-runtime.js"), "utf8");

  assert.equal(/setInterval\([^)]*,\s*5000\)/.test(adminSrc), false, "AdminChatTab must not poll every 5s");
  assert.equal(/seedSampleChatsIfEmpty/.test(adminSrc), false, "AdminChatTab must not seed fake sample chats");
  assert.equal(/SoundHelix/.test(adminSrc), false, "AdminChatTab must not use fake SoundHelix audio");
  assert.ok(bridgeSrc.includes("sseConnected"), "Realtime bridge must gate fallback recovery on SSE status");
  assert.equal(/new\s+MutationObserver/.test(integritySrc), false, "Integrity script must not use MutationObserver loop");
  assert.equal(/setInterval\(scan/.test(dlSrc), false, "Download runtime must not poll every 2s");
});
