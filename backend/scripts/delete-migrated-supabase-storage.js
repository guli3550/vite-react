#!/usr/bin/env node
"use strict";

// Destructive cleanup: removes only the six approved Supabase Storage buckets' objects.
// It never deletes buckets, database rows, Auth users, Realtime data, or R2 objects.
const { createClient } = require("@supabase/supabase-js");

const EXPECTED = {
  "reels-media": { objects: 74, bytes: 176725828 },
  "video-ads": { objects: 38, bytes: 53233835 },
  "product-images": { objects: 271, bytes: 25976422 },
  "review-images": { objects: 4, bytes: 177495 },
  "chat-media": { objects: 101, bytes: 45994297 },
  "payment-receipts": { objects: 97, bytes: 35851394 },
};
const PAGE_SIZE = 100;
const DELETE_BATCH_SIZE = 500;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}
function isFolder(entry) {
  return entry && entry.id == null && entry.metadata == null;
}
async function listBucket(storage, bucketName) {
  const objects = [];
  const pending = [""];
  const visited = new Set();
  while (pending.length) {
    const prefix = pending.pop();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    if (visited.size > 100000) throw new Error(bucketName + ": folder safety limit exceeded");
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await storage.from(bucketName).list(prefix, {
        limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(bucketName + " inventory failed: " + error.message);
      const entries = Array.isArray(data) ? data : [];
      for (const entry of entries) {
        if (isFolder(entry)) {
          const folder = String(entry.name || "").replace(/^\/+|\/+$/g, "");
          if (folder && folder !== "." && folder !== ".." && !folder.includes("/")) {
            pending.push(prefix ? prefix + "/" + folder : folder);
          }
          continue;
        }
        const name = String(entry.name || "");
        if (!name || name === "." || name === ".." || name.includes("\\") || /[\u0000-\u001f\u007f]/.test(name)) {
          throw new Error(bucketName + ": unsafe object path encountered");
        }
        objects.push({
          key: prefix ? prefix + "/" + name : name,
          size: Number(entry.metadata?.size ?? entry.metadata?.contentLength),
        });
      }
      if (entries.length < PAGE_SIZE) break;
    }
  }
  return objects;
}
async function main() {
  if (String(process.env.CONFIRM_DELETE_SUPABASE_STORAGE || "").toLowerCase() !== "true") {
    throw new Error("Refusing destructive action: CONFIRM_DELETE_SUPABASE_STORAGE must be true");
  }
  const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Complete preflight across ALL six buckets before deleting anything.
  const inventories = {};
  let allCount = 0, allBytes = 0;
  for (const [bucket, expected] of Object.entries(EXPECTED)) {
    const objects = await listBucket(supabase.storage, bucket);
    const unknownSizes = objects.filter((o) => !Number.isFinite(o.size) || o.size < 0).length;
    const bytes = objects.reduce((sum, o) => sum + (Number.isFinite(o.size) && o.size >= 0 ? o.size : 0), 0);
    if (unknownSizes || objects.length !== expected.objects || bytes !== expected.bytes) {
      throw new Error("PREFLIGHT_ABORT: " + bucket + " expected " + expected.objects + "/" + expected.bytes +
        " bytes; found " + objects.length + "/" + bytes + " bytes; unknown sizes=" + unknownSizes +
        ". No objects have been deleted.");
    }
    inventories[bucket] = objects;
    allCount += objects.length;
    allBytes += bytes;
  }
  if (allCount !== 585 || allBytes !== 337959271) {
    throw new Error("PREFLIGHT_ABORT: aggregate inventory mismatch. No objects have been deleted.");
  }

  process.stdout.write("PREFLIGHT_OK: all 585 expected objects / 337959271 bytes inventoried across six approved buckets. Starting deletion.\n");
  const deleted = [];
  for (const [bucket, objects] of Object.entries(inventories)) {
    const keys = objects.map((o) => o.key);
    let bucketDeleted = 0;
    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) throw new Error("DELETE_FAILED in " + bucket + " after " + bucketDeleted + " objects: " + error.message);
      bucketDeleted += batch.length;
    }
    const remaining = await listBucket(supabase.storage, bucket);
    if (remaining.length !== 0) {
      throw new Error("VERIFY_DELETE_FAILED: " + bucket + " still contains " + remaining.length + " objects");
    }
    deleted.push({ bucket, deleted: bucketDeleted, remaining: 0 });
    process.stdout.write(JSON.stringify(deleted[deleted.length - 1]) + "\n");
  }

  const final = {
    status: "SUCCESS",
    deleted_objects: deleted.reduce((n, item) => n + item.deleted, 0),
    source_bytes: allBytes,
    buckets: deleted,
    scope: "Storage objects only; buckets/config/database/Auth/Realtime/R2 were not deleted or modified",
  };
  process.stdout.write(JSON.stringify(final, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "# GULI MARKET — Supabase Storage cleanup",
      "",
      "- Status: " + final.status,
      "- Objects deleted: " + final.deleted_objects,
      "- Original bytes: " + allBytes,
      "",
      "| Bucket | Deleted | Remaining |",
      "|---|---:|---:|",
      ...deleted.map((item) => "| " + item.bucket + " | " + item.deleted + " | " + item.remaining + " |"),
      "",
      "Only Storage objects in the six explicitly approved buckets were deleted. Buckets and all non-Storage Supabase services remain untouched.",
    ];
    require("node:fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }
}
main().catch((error) => {
  process.stderr.write("SUPABASE_STORAGE_DELETE_FAILED: " + error.message + "\n");
  process.exitCode = 1;
});
