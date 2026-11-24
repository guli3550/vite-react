const crypto = require("node:crypto");

function encodeSegment(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

function encodePath(path) {
  return String(path).split("/").map(encodeSegment).join("/");
}

function validateObjectKey(value) {
  const key = String(value || "");
  if (!key || key.length > 1024 || key.startsWith("/") || key.includes("\\") || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new Error("R2 object key noto‘g‘ri");
  }
  const segments = key.split("/");
  if (segments.some((part) => !part || part === "." || part === "..")) {
    throw new Error("R2 object key path segment noto‘g‘ri");
  }
  return key;
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalQuery(params) {
  return Object.entries(params)
    .map(([key, value]) => [encodeSegment(key), encodeSegment(value)])
    .sort(([aKey, aValue], [bKey, bValue]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : aValue < bValue ? -1 : aValue > bValue ? 1 : 0))
    .map(([key, value]) => key + "=" + value)
    .join("&");
}

function loadConfig(env = process.env, overrides = {}) {
  const endpointValue = String(overrides.endpoint || env.R2_ENDPOINT || "").trim().replace(/\/+$/, "");
  const bucket = String(overrides.bucket || env.R2_BUCKET_NAME || "").trim();
  const accessKeyId = String(overrides.accessKeyId || env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(overrides.secretAccessKey || env.R2_SECRET_ACCESS_KEY || "").trim();
  const publicBase = String(overrides.publicBase ?? env.R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (!endpointValue || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID va R2_SECRET_ACCESS_KEY talab qilinadi");
  }
  const endpoint = new URL(endpointValue);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/") {
    throw new Error("R2_ENDPOINT HTTPS origin bo‘lishi kerak (bucket/path qo‘shilmaydi)");
  }
  if (publicBase) {
    const parsedPublic = new URL(publicBase);
    if (parsedPublic.protocol !== "https:" || parsedPublic.username || parsedPublic.password) {
      throw new Error("R2_PUBLIC_URL HTTPS manzil bo‘lishi kerak");
    }
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, publicBase };
}

function createR2MediaStorage(options = {}) {
  const env = options.env || process.env;
  const config = loadConfig(env, options.config || {});
  const now = options.now || (() => new Date());
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("fetch funksiyasi mavjud emas");

  function objectPath(key) {
    return "/" + encodeSegment(config.bucket) + "/" + encodePath(validateObjectKey(key));
  }

  function presign(method, key, expiresIn = 600) {
    const safeMethod = String(method || "").toUpperCase();
    if (!["GET", "PUT", "HEAD"].includes(safeMethod)) throw new Error("R2 HTTP method ruxsat etilmagan");
    const ttl = Number(expiresIn);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 3600) throw new Error("R2 signed URL muddati 1–3600 soniya bo‘lishi kerak");

    const date = now().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = date.slice(0, 8);
    const scope = dateStamp + "/auto/s3/aws4_request";
    const query = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": config.accessKeyId + "/" + scope,
      "X-Amz-Date": date,
      "X-Amz-Expires": String(ttl),
      "X-Amz-SignedHeaders": "host",
    };
    const queryString = canonicalQuery(query);
    const canonicalHeaders = "host:" + config.endpoint.host + "\n";
    const canonicalRequest = [
      safeMethod,
      objectPath(key),
      queryString,
      canonicalHeaders,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      date,
      scope,
      sha256(canonicalRequest),
    ].join("\n");
    const kDate = hmac("AWS4" + config.secretAccessKey, dateStamp);
    const kRegion = hmac(kDate, "auto");
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = hmac(kSigning, stringToSign, "hex");
    return config.endpoint.origin + objectPath(key) + "?" + queryString + "&X-Amz-Signature=" + signature;
  }

  function publicObjectUrl(key) {
    if (!config.publicBase) throw new Error("Ushbu R2 bucket uchun R2_PUBLIC_URL sozlanmagan");
    return config.publicBase + "/" + encodePath(validateObjectKey(key));
  }

  async function headObject(key) {
    const response = await fetchImpl(presign("HEAD", key, 60), { method: "HEAD" });
    if (!response.ok) {
      const error = new Error("R2 HEAD so‘rovi muvaffaqiyatsiz (HTTP " + response.status + ")");
      error.status = response.status;
      throw error;
    }
    return {
      contentLength: Number(response.headers.get("content-length") || 0),
      contentType: response.headers.get("content-type") || "",
      etag: response.headers.get("etag") || "",
    };
  }

  async function uploadObject(key, body, options = {}) {
    if (body == null) throw new Error("R2 upload body bo‘sh");
    const headers = {};
    if (options.contentType) headers["Content-Type"] = String(options.contentType);
    if (options.cacheControl) headers["Cache-Control"] = String(options.cacheControl);
    const response = await fetchImpl(presign("PUT", key, options.expiresIn || 600), {
      method: "PUT",
      headers,
      body,
    });
    if (!response.ok) {
      const error = new Error("R2 PUT so‘rovi muvaffaqiyatsiz (HTTP " + response.status + ")");
      error.status = response.status;
      throw error;
    }
    return { etag: response.headers.get("etag") || "" };
  }

  function signedReadUrl(key, expiresIn = 300) {
    return presign("GET", key, expiresIn);
  }

  return Object.freeze({ presign, publicObjectUrl, signedReadUrl, headObject, uploadObject });
}

module.exports = { createR2MediaStorage, validateObjectKey, loadConfig };
