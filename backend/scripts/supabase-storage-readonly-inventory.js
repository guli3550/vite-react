#!/usr/bin/env node
"use strict";

// Read-only Supabase Storage inventory. Lists object metadata only; it never
// downloads, uploads, updates, or deletes an object.
const { createClient } = require("@supabase/supabase-js");

const TARGET_BUCKETS = [
  "reels-media",
  "video-ads",
  "chat-media",
  "payment-receipts",
  "product-images",
  "review-images",
];
const PAGE_SIZE = 100;
const MAX_OBJECTS_PER_BUCKET = 1_000_000;
const MAX_DIRECTORIES_PER_BUCKET = 100_000;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function isFolder(entry) {
  return entry && entry.id == null && entry.metadata == null;
}

async function inventoryBucket(storage, bucketName) {
  const totals = {
    name: bucketName,
    object_count: 0,
    total_bytes: 0,
    unknown_size_count: 0,
    content_types: {},
    extensions: {},
    newest_updated_at: null,
    oldest_created_at: null,
  };
  const pending = [""];
  const visited = new Set();

  while (pending.length) {
    const prefix = pending.pop();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    if (visited.size > MAX_DIRECTORIES_PER_BUCKET) {
      throw new Error(bucketName + ": directory safety limit exceeded");
    }

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await storage.from(bucketName).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(bucketName + "/" + prefix + ": " + error.message);
      const entries = Array.isArray(data) ? data : [];

      for (const entry of entries) {
        if (isFolder(entry)) {
          const folderName = String(entry.name || "").replace(/^\/+|\/+$/g, "");
          if (folderName && folderName !== "." && folderName !== ".." && !folderName.includes("/")) {
            pending.push(prefix ? prefix + "/" + folderName : folderName);
          }
          continue;
        }

        totals.object_count += 1;
        if (totals.object_count > MAX_OBJECTS_PER_BUCKET) {
          throw new Error(bucketName + ": object safety limit exceeded");
        }
        const metadata = entry.metadata || {};
        const size = Number(metadata.size ?? entry.size);
        if (Number.isFinite(size) && size >= 0) totals.total_bytes += size;
        else totals.unknown_size_count += 1;

        const contentType = String(metadata.mimetype || metadata.contentType || "unknown").toLowerCase();
        totals.content_types[contentType] = (totals.content_types[contentType] || 0) + 1;
        const name = String(entry.name || "");
        const ext = (name.match(/\.([a-zA-Z0-9]{1,12})$/) || [])[1]?.toLowerCase() || "(no extension)";
        totals.extensions[ext] = (totals.extensions[ext] || 0) + 1;

        const updatedAt = metadata.lastModified || entry.updated_at || null;
        const createdAt = entry.created_at || metadata.createdAt || null;
        if (updatedAt && (!totals.newest_updated_at || updatedAt > totals.newest_updated_at)) totals.newest_updated_at = updatedAt;
        if (createdAt && (!totals.oldest_created_at || createdAt < totals.oldest_created_at)) totals.oldest_created_at = createdAt;
      }

      if (entries.length < PAGE_SIZE) break;
    }
  }
  return totals;
}

async function main() {
  const projectUrl = required("SUPABASE_URL");
  const supabase = createClient(projectUrl, required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: bucketData, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw new Error("Supabase bucket listing failed: " + bucketError.message);

  const actualBuckets = (bucketData || []).map((bucket) => ({
    name: bucket.name,
    public: Boolean(bucket.public),
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
  })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  const byName = new Map(actualBuckets.map((bucket) => [bucket.name, bucket]));
  const reports = [];
  for (const name of TARGET_BUCKETS) {
    const bucket = byName.get(name);
    if (!bucket) {
      reports.push({ name, missing: true, object_count: null, total_bytes: null });
      continue;
    }
    reports.push({
      ...bucket,
      ...(await inventoryBucket(supabase.storage, name)),
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: "READ_ONLY_OBJECT_METADATA_INVENTORY",
    project_host: new URL(projectUrl).host,
    target_bucket_count: TARGET_BUCKETS.length,
    actual_bucket_count: actualBuckets.length,
    unplanned_bucket_names: actualBuckets.map((b) => b.name).filter((name) => !TARGET_BUCKETS.includes(name)),
    buckets: reports,
    totals: {
      object_count: reports.reduce((sum, bucket) => sum + (bucket.object_count || 0), 0),
      total_bytes: reports.reduce((sum, bucket) => sum + (bucket.total_bytes || 0), 0),
      missing_buckets: reports.filter((bucket) => bucket.missing).map((bucket) => bucket.name),
    },
    safety: {
      object_metadata_listed: true,
      object_names_emitted: false,
      file_contents_downloaded: false,
      files_uploaded: false,
      files_updated: false,
      files_deleted: false,
      buckets_created_or_updated: false,
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "# GULI MARKET — Supabase Storage read-only object inventory",
      "",
      "- Generated: " + report.generated_at,
      "- Target buckets: " + report.target_bucket_count,
      "- Objects: " + report.totals.object_count,
      "- Total bytes: " + report.totals.total_bytes,
      "- Missing buckets: " + (report.totals.missing_buckets.join(", ") || "none"),
      "- Unplanned buckets: " + (report.unplanned_bucket_names.join(", ") || "none"),
      "",
      "| Bucket | Public | Objects | Total bytes | Unknown sizes |",
      "|---|---:|---:|---:|---:|",
      ...reports.map((b) => "| " + b.name + " | " + (b.public ?? "—") + " | " + (b.object_count ?? "missing") + " | " + (b.total_bytes ?? "—") + " | " + (b.unknown_size_count ?? "—") + " |"),
      "",
      "Read-only: no object names or file contents were emitted, downloaded, uploaded, modified, or deleted.",
    ];
    require("node:fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }
}

main().catch((error) => {
  process.stderr.write("READ_ONLY_INVENTORY_FAILED: " + error.message + "\n");
  process.exitCode = 1;
});
