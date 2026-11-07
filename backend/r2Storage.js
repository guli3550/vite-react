const crypto = require("crypto");

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`R2 sozlamasi topilmadi: ${name}`);
  return value;
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function getConfig() {
  const endpoint = requiredEnv("R2_ENDPOINT").replace(/\/+$/, "");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const publicBase = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:") throw new Error("R2_ENDPOINT HTTPS bo‘lishi kerak");
  return { endpoint: parsed, bucket, accessKeyId, secretAccessKey, publicBase };
}

function publicObjectUrl(key) {
  const { publicBase } = getConfig();
  return publicBase + "/" + String(key).split("/").map(awsEncode).join("/");
}

function createPresignedPutUrl(key, expiresIn = 600) {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = getConfig();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const path = "/" + [bucket, ...String(key).split("/")].map(awsEncode).join("/");
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(60, Math.min(3600, Number(expiresIn) || 600))),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query).sort().map((name) => `${awsEncode(name)}=${awsEncode(query[name])}`).join("&");
  const canonicalHeaders = `host:${endpoint.host}\n`;
  const canonicalRequest = ["PUT", path, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  return `${endpoint.origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

module.exports = { createPresignedPutUrl, publicObjectUrl, getConfig };
