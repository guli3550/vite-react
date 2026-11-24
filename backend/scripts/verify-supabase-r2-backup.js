#!/usr/bin/env node
"use strict";

// Independent, read-only audit of a completed Supabase Storage -> private R2 backup.
// Reads the manifest and objects from R2 only. It never accesses or changes Supabase.
const crypto = require("node:crypto");

const EXPECTED_BUCKET = "guli-market-backup";
const EXPECTED_PREFIX = "supabase-storage-backup/2026-11-24T07-03-47-483Z/";

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
function canonicalQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([key, value]) => key + "=" + value)
    .join("&");
}
function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}
function signedUrl(method, endpoint, bucket, key, accessKeyId, secretAccessKey, extraQuery = {}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/auto/s3/aws4_request";
  const encodedKey = key ? "/" + key.split("/").map(awsEncode).join("/") : "";
  const path = "/" + awsEncode(bucket) + encodedKey;
  const query = {
    ...extraQuery,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": accessKeyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": "host",
  };
  const queryString = canonicalQuery(query);
  const canonicalRequest = [method, path, queryString, "host:" + endpoint.host + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
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
  return endpoint.origin + path + "?" + queryString + "&X-Amz-Signature=" + signature;
}
async function getObject(config, key, query = {}) {
  const url = signedUrl("GET", config.endpoint, config.bucket, key, config.accessKeyId, config.secretAccessKey, query);
  const response = await fetch(url);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error("R2 GET failed (" + response.status + ") for " + (key || "bucket listing") + ": " + detail);
  }
  return response;
}
function xmlText(xml, tag) {
  const match = xml.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">"));
  if (!match) return "";
  return match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
async function listPrefix(config, prefix) {
  const objects = [];
  let continuationToken = "";
  do {
    const query = { "list-type": "2", prefix };
    if (continuationToken) query["continuation-token"] = continuationToken;
    const response = await getObject(config, "", query);
    const xml = await response.text();
    const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    for (const item of contents) {
      const key = xmlText(item, "Key");
      const size = Number(xmlText(item, "Size"));
      if (key) objects.push({ key, size });
    }
    const truncated = xmlText(xml, "IsTruncated") === "true";
    continuationToken = truncated ? xmlText(xml, "NextContinuationToken") : "";
    if (truncated && !continuationToken) throw new Error("R2 listing says truncated but has no continuation token");
  } while (continuationToken);
  return objects;
}
async function main() {
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = required("R2_BACKUP_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_BACKUP_SECRET_ACCESS_KEY");
  const bucket = process.env.R2_BACKUP_BUCKET || EXPECTED_BUCKET;
  const prefix = process.env.BACKUP_PREFIX || EXPECTED_PREFIX;
  if (bucket !== EXPECTED_BUCKET) throw new Error("Refusing to inspect unexpected bucket: " + bucket);
  if (prefix !== EXPECTED_PREFIX) throw new Error("Refusing to inspect unexpected backup prefix: " + prefix);
  const endpoint = new URL(process.env.R2_BACKUP_ENDPOINT || ("https://" + accountId + ".r2.cloudflarestorage.com"));
  if (endpoint.protocol !== "https:" || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
    throw new Error("R2_BACKUP_ENDPOINT must be an HTTPS S3 endpoint origin");
  }
  const config = { endpoint, bucket, accessKeyId, secretAccessKey };
  const manifestKey = prefix + "manifest.json";
  const manifestResponse = await getObject(config, manifestKey);
  const manifest = JSON.parse(await manifestResponse.text());
  if (manifest.format !== "guli-supabase-storage-backup-v1" || manifest.mode !== "EXECUTE") {
    throw new Error("Manifest format or mode is not a completed EXECUTE backup");
  }
  if (!Array.isArray(manifest.files) || !manifest.totals) throw new Error("Manifest is missing files/totals");

  const listed = await listPrefix(config, prefix);
  const listedByKey = new Map(listed.map((item) => [item.key, item]));
  const manifestFileKeys = new Set(manifest.files.map((file) => file.destination_key));
  if (manifestFileKeys.size !== manifest.files.length) throw new Error("Manifest contains duplicate destination keys");
  if (listed.length !== manifest.files.length + 1 || !listedByKey.has(manifestKey)) {
    throw new Error("R2 object count does not match manifest: listed " + listed.length +
      ", expected " + (manifest.files.length + 1) + " including manifest");
  }

  let totalBytes = 0;
  for (let i = 0; i < manifest.files.length; i += 1) {
    const file = manifest.files[i];
    if (!file.verified || !file.destination_key || !/^[a-f0-9]{64}$/.test(file.sha256 || "")) {
      throw new Error("Manifest entry lacks verified SHA-256 metadata at index " + i);
    }
    const listedObject = listedByKey.get(file.destination_key);
    if (!listedObject) throw new Error("Manifest object missing from R2 listing: " + file.destination_key);
    if (listedObject.size !== file.bytes) throw new Error("R2 listed size mismatch: " + file.destination_key);
    const response = await getObject(config, file.destination_key);
    const buffer = Buffer.from(await response.arrayBuffer());
    const digest = crypto.createHash("sha256").update(buffer).digest("hex");
    if (buffer.length !== file.bytes || digest !== file.sha256) {
      throw new Error("Independent SHA-256 verification failed: " + file.destination_key);
    }
    totalBytes += buffer.length;
    if ((i + 1) % 50 === 0 || i + 1 === manifest.files.length) {
      process.stdout.write("Verified " + (i + 1) + "/" + manifest.files.length + " objects\n");
    }
  }

  if (manifest.totals.files !== manifest.files.length || manifest.totals.bytes !== totalBytes) {
    throw new Error("Manifest totals mismatch: manifest " + JSON.stringify(manifest.totals) +
      ", verified files=" + manifest.files.length + " bytes=" + totalBytes);
  }
  process.stdout.write(JSON.stringify({
    result: "R2_BACKUP_INDEPENDENT_VERIFICATION_SUCCESS",
    bucket,
    prefix,
    objectsIncludingManifest: listed.length,
    verifiedFiles: manifest.files.length,
    verifiedBytes: totalBytes,
    manifestBytes: listedByKey.get(manifestKey).size,
    supabaseTouched: false,
    sourceObjectsModified: false,
  }, null, 2) + "\n");
}
main().catch((error) => {
  console.error("R2_BACKUP_VERIFICATION_FAILED:", error.message);
  process.exitCode = 1;
});
