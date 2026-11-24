#!/usr/bin/env node
"use strict";

// One-way, non-destructive Supabase Storage -> Cloudflare R2 copy.
// Never deletes or mutates Supabase objects. Private buckets are routed to a
// separate private R2 bucket; public buckets go to the public R2 bucket.
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { createR2MediaStorage } = require("../r2MediaStorage.js");

const PUBLIC_SOURCE_BUCKETS = ["reels-media", "video-ads", "product-images", "review-images"];
const PRIVATE_SOURCE_BUCKETS = ["chat-media", "payment-receipts"];
const PAGE_SIZE = 100;
const MAX_OBJECTS_PER_BUCKET = 1_000_000;
const MAX_DIRECTORIES_PER_BUCKET = 100_000;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
    if (visited.size > MAX_DIRECTORIES_PER_BUCKET) throw new Error(bucketName + ": directory safety limit exceeded");
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await storage.from(bucketName).list(prefix, {
        limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(bucketName + "/" + prefix + ": " + error.message);
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
          throw new Error(bucketName + ": unsafe object name encountered");
        }
        const key = prefix ? prefix + "/" + name : name;
        objects.push({ key, metadata: entry.metadata || {} });
        if (objects.length > MAX_OBJECTS_PER_BUCKET) throw new Error(bucketName + ": object safety limit exceeded");
      }
      if (entries.length < PAGE_SIZE) break;
    }
  }
  return objects;
}
async function readR2AndHash(storage, key) {
  const response = await fetch(storage.signedReadUrl(key, 300));
  if (!response.ok) throw new Error("R2 read-back failed (HTTP " + response.status + ")");
  const body = Buffer.from(await response.arrayBuffer());
  return { size: body.length, sha256: sha256(body) };
}
async function copyOne({ supabase, r2, sourceBucket, object, dryRun }) {
  const targetKey = sourceBucket + "/" + object.key;
  const sourceSize = Number(object.metadata.size ?? object.metadata.contentLength);
  const contentType = String(object.metadata.mimetype || object.metadata.contentType || "application/octet-stream");
  if (dryRun) return { size: Number.isFinite(sourceSize) ? sourceSize : 0, copied: false, verified: false };

  // Idempotent reruns: an existing target is accepted only after full read-back
  // hash comparison. A mismatching target is never overwritten automatically.
  try {
    const existing = await r2.headObject(targetKey);
    const existingRead = await readR2AndHash(r2, targetKey);
    if (existing.contentLength && existingRead.size !== existing.contentLength) {
      throw new Error("Existing R2 object HEAD/read-back size mismatch: " + targetKey);
    }
    const { data, error } = await supabase.storage.from(sourceBucket).download(object.key);
    if (error || !data) throw new Error(sourceBucket + " source download failed: " + (error?.message || "empty body"));
    const sourceBytes = Buffer.from(await data.arrayBuffer());
    const sourceHash = sha256(sourceBytes);
    if (sourceBytes.length !== existingRead.size || sourceHash !== existingRead.sha256) {
      throw new Error("Existing R2 object differs from Supabase source; refusing overwrite: " + targetKey);
    }
    return { size: sourceBytes.length, copied: false, verified: true };
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const { data, error } = await supabase.storage.from(sourceBucket).download(object.key);
  if (error || !data) throw new Error(sourceBucket + " source download failed: " + (error?.message || "empty body"));
  const sourceBytes = Buffer.from(await data.arrayBuffer());
  const sourceHash = sha256(sourceBytes);
  if (Number.isFinite(sourceSize) && sourceSize >= 0 && sourceBytes.length !== sourceSize) {
    throw new Error("Source metadata size mismatch for " + sourceBucket + " object");
  }
  await r2.uploadObject(targetKey, sourceBytes, { contentType, cacheControl: "public, max-age=31536000, immutable" });
  const head = await r2.headObject(targetKey);
  if (head.contentLength !== sourceBytes.length) throw new Error("R2 HEAD size mismatch after upload: " + targetKey);
  const readBack = await readR2AndHash(r2, targetKey);
  if (readBack.size !== sourceBytes.length || readBack.sha256 !== sourceHash) {
    throw new Error("R2 SHA-256 verification failed: " + targetKey);
  }
  return { size: sourceBytes.length, copied: true, verified: true };
}

async function main() {
  const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicBucket = required("R2_PUBLIC_BUCKET_NAME");
  const privateBucket = required("R2_PRIVATE_BUCKET_NAME");
  if (publicBucket === privateBucket) throw new Error("Public and private R2 buckets must be different");
  const common = {
    endpoint: required("R2_ENDPOINT"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  };
  const publicR2 = createR2MediaStorage({ config: { ...common, bucket: publicBucket } });
  const privateR2 = createR2MediaStorage({ config: { ...common, bucket: privateBucket } });
  const confirmed = String(process.env.MIGRATION_CONFIRM_COPY || "").toLowerCase() === "true";
  const dryRun = !confirmed;
  const results = [];
  let totalObjects = 0, totalBytes = 0, copiedObjects = 0, verifiedObjects = 0;

  for (const sourceBucket of [...PUBLIC_SOURCE_BUCKETS, ...PRIVATE_SOURCE_BUCKETS]) {
    const objects = await listBucket(supabase.storage, sourceBucket);
    const r2 = PUBLIC_SOURCE_BUCKETS.includes(sourceBucket) ? publicR2 : privateR2;
    let bucketBytes = 0, bucketCopied = 0, bucketVerified = 0;
    for (const object of objects) {
      const result = await copyOne({ supabase, r2, sourceBucket, object, dryRun });
      bucketBytes += result.size;
      if (result.copied) bucketCopied++;
      if (result.verified) bucketVerified++;
    }
    totalObjects += objects.length;
    totalBytes += bucketBytes;
    copiedObjects += bucketCopied;
    verifiedObjects += bucketVerified;
    results.push({ bucket: sourceBucket, objects: objects.length, bytes: bucketBytes, copied: bucketCopied, verified: bucketVerified, privacy: PRIVATE_SOURCE_BUCKETS.includes(sourceBucket) ? "private" : "public" });
    process.stdout.write(JSON.stringify(results[results.length - 1]) + "\n");
  }

  const report = {
    mode: dryRun ? "DRY_RUN_NO_FILE_WRITES" : "COPY_AND_READBACK_SHA256_VERIFY",
    generated_at: new Date().toISOString(),
    totals: { objects: totalObjects, bytes: totalBytes, copied: copiedObjects, verified: verifiedObjects },
    buckets: results,
    safety: {
      supabase_objects_downloaded: !dryRun,
      supabase_objects_modified: false,
      supabase_objects_deleted: false,
      supabase_buckets_modified: false,
      r2_objects_written: !dryRun,
      public_and_private_r2_buckets_separated: true,
      r2_readback_sha256_verified: !dryRun,
    },
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "# GULI MARKET — Supabase to R2 copy",
      "",
      "- Mode: " + report.mode,
      "- Objects inventoried: " + totalObjects,
      "- Bytes inventoried/copied: " + totalBytes,
      "- Objects copied this run: " + copiedObjects,
      "- Objects SHA-256 verified: " + verifiedObjects,
      "",
      "| Source bucket | Privacy | Objects | Bytes | Copied | Verified |",
      "|---|---|---:|---:|---:|---:|",
      ...results.map((r) => "| " + r.bucket + " | " + r.privacy + " | " + r.objects + " | " + r.bytes + " | " + r.copied + " | " + r.verified + " |"),
      "",
      "Supabase originals were not modified or deleted. No bucket configuration was changed.",
    ];
    require("node:fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }
}
main().catch((error) => {
  process.stderr.write("R2_COPY_FAILED: " + error.message + "\n");
  process.exitCode = 1;
});
