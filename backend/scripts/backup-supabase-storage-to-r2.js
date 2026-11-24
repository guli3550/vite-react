#!/usr/bin/env node
"use strict";

// One-way, non-destructive Supabase Storage backup to a private Cloudflare R2 bucket.
// Dry-run is the default. Pass --execute only after backup credentials are configured.
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const SOURCE_BUCKETS = [
  "reels-media",
  "video-ads",
  "chat-media",
  "payment-receipts",
  "product-images",
  "review-images",
];
const EXPECTED_BACKUP_BUCKET = "guli-market-backup";
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}
function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}
function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}
function makePresignedUrl(method, endpoint, bucket, key, accessKeyId, secretAccessKey, expiresIn = 900) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/auto/s3/aws4_request";
  const path = "/" + [bucket, ...key.split("/")].map(awsEncode).join("/");
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": accessKeyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query).sort()
    .map((name) => awsEncode(name) + "=" + awsEncode(query[name])).join("&");
  const canonicalHeaders = "host:" + endpoint.host + "\n";
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  return endpoint.origin + path + "?" + canonicalQuery + "&X-Amz-Signature=" + signature;
}
async function requestObject(config, method, key, body, contentType) {
  const url = makePresignedUrl(
    method, config.endpoint, config.bucket, key, config.accessKeyId, config.secretAccessKey
  );
  const response = await fetch(url, {
    method,
    headers: method === "PUT" ? { "Content-Type": contentType || "application/octet-stream" } : undefined,
    body: method === "PUT" ? body : undefined,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error("R2 " + method + " failed (" + response.status + ") for " + key + ": " + detail);
  }
  return response;
}
async function putObject(config, key, body, contentType) {
  await requestObject(config, "PUT", key, body, contentType);
}
async function verifyObject(config, key, expectedBuffer, expectedSha256) {
  const response = await requestObject(config, "GET", key);
  const actual = Buffer.from(await response.arrayBuffer());
  const actualHash = crypto.createHash("sha256").update(actual).digest("hex");
  if (actual.length !== expectedBuffer.length || actualHash !== expectedSha256) {
    throw new Error("R2 verification mismatch for " + key);
  }
}
async function listAllFiles(storage, bucket) {
  const files = [];
  async function walk(prefix) {
    let offset = 0;
    while (true) {
      const { data, error } = await storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("Supabase list failed for " + bucket + "/" + prefix + ": " + error.message);
      const rows = data || [];
      for (const item of rows) {
        if (!item || !item.name || item.name === "." || item.name === "..") continue;
        const path = prefix ? prefix + "/" + item.name : item.name;
        if (item.id === null || item.id === undefined) {
          await walk(path);
        } else {
          files.push({
            path,
            id: item.id,
            created_at: item.created_at || null,
            updated_at: item.updated_at || null,
            last_accessed_at: item.last_accessed_at || null,
            metadata: item.metadata || {},
          });
        }
      }
      if (rows.length < 100) break;
      offset += rows.length;
    }
  }
  await walk("");
  return files;
}
async function main() {
  const execute = process.argv.includes("--execute");
  const supabaseUrl = required("SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let r2 = null;
  if (execute) {
    const accountId = required("CLOUDFLARE_ACCOUNT_ID");
    const endpointRaw = process.env.R2_BACKUP_ENDPOINT ||
      ("https://" + accountId + ".r2.cloudflarestorage.com");
    const endpoint = new URL(endpointRaw);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
      throw new Error("R2_BACKUP_ENDPOINT must be an HTTPS S3 endpoint origin");
    }
    const bucket = required("R2_BACKUP_BUCKET");
    if (bucket !== EXPECTED_BACKUP_BUCKET) {
      throw new Error("R2_BACKUP_BUCKET must be exactly " + EXPECTED_BACKUP_BUCKET);
    }
    r2 = {
      endpoint,
      bucket,
      accessKeyId: required("R2_BACKUP_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_BACKUP_SECRET_ACCESS_KEY"),
    };
  }

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) throw bucketError;
  const existing = new Set((buckets || []).map((b) => b.name));
  const missing = SOURCE_BUCKETS.filter((name) => !existing.has(name));
  if (missing.length) throw new Error("Expected source buckets missing: " + missing.join(", "));

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const manifest = {
    format: "guli-supabase-storage-backup-v1",
    run_id: runId,
    created_at: new Date().toISOString(),
    source_project_url: supabaseUrl,
    destination_bucket: execute ? r2.bucket : EXPECTED_BACKUP_BUCKET,
    mode: execute ? "EXECUTE" : "DRY_RUN",
    files: [],
    totals: { files: 0, bytes: 0 },
  };

  for (const bucket of SOURCE_BUCKETS) {
    const files = await listAllFiles(supabase.storage, bucket);
    process.stdout.write("Scanned " + bucket + ": " + files.length + " objects\n");
    for (const file of files) {
      const declaredSize = Number(file.metadata && file.metadata.size);
      if (!Number.isFinite(declaredSize) || declaredSize < 0) {
        throw new Error("Missing/invalid size metadata: " + bucket + "/" + file.path);
      }
      manifest.totals.files += 1;
      manifest.totals.bytes += declaredSize;
      if (manifest.totals.bytes > MAX_TOTAL_BYTES) {
        throw new Error("Safety limit exceeded: source total is over 1 GiB");
      }
      if (!execute) {
        manifest.files.push({
          bucket,
          path: file.path,
          bytes: declaredSize,
          content_type: file.metadata.mimetype || "application/octet-stream",
          created_at: file.created_at,
        });
        continue;
      }

      const { data, error } = await supabase.storage.from(bucket).download(file.path);
      if (error) throw new Error("Supabase download failed for " + bucket + "/" + file.path + ": " + error.message);
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length !== declaredSize) {
        throw new Error("Size mismatch for " + bucket + "/" + file.path +
          ": expected " + declaredSize + ", got " + buffer.length);
      }
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      const contentType = file.metadata.mimetype || "application/octet-stream";
      const destinationKey = "supabase-storage-backup/" + runId + "/" + bucket + "/" + file.path;
      await putObject(r2, destinationKey, buffer, contentType);
      await verifyObject(r2, destinationKey, buffer, sha256);
      manifest.files.push({
        bucket,
        path: file.path,
        destination_key: destinationKey,
        bytes: buffer.length,
        sha256,
        verified: true,
        content_type: contentType,
        created_at: file.created_at,
        updated_at: file.updated_at,
      });
      process.stdout.write("Backed up " + bucket + "/" + file.path + " (" + buffer.length + " bytes)\n");
    }
  }

  if (execute) {
    const manifestKey = "supabase-storage-backup/" + runId + "/manifest.json";
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    await putObject(r2, manifestKey, manifestBuffer, "application/json");
    process.stdout.write("Manifest uploaded: " + manifestKey + "\n");
  }

  process.stdout.write(JSON.stringify(manifest.totals) + "\n");
  process.stdout.write(execute
    ? "BACKUP_UPLOAD_COMPLETE. Source objects were not modified or deleted.\n"
    : "DRY_RUN_COMPLETE. No files were downloaded or uploaded. Re-run with --execute to create the backup.\n");
}
main().catch((error) => {
  console.error("BACKUP_FAILED:", error.message);
  process.exitCode = 1;
});
