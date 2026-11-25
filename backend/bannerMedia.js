const CHECK_TTL_MS = 300000;
const checks = new Map();

function getR2Candidate(value, env = process.env) {
  const raw = String(value || "").trim();
  const base = String(env.R2_PUBLIC_URL || "https://media.gulii.uz").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/product-images\/(banners\/.+)$/);
    return match ? base + "/product-images/" + match[1] : null;
  } catch { return null; }
}

async function checkPublicObject(url, fetchImpl = globalThis.fetch) {
  const cached = checks.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  try {
    const response = await fetchImpl(url, { method: "HEAD", redirect: "follow" });
    const result = {
      available: response.ok,
      definitiveMissing: response.status === 404,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      contentLength: Number(response.headers.get("content-length") || 0),
    };
    checks.set(url, { result, expiresAt: Date.now() + (response.status === 404 ? 30000 : CHECK_TTL_MS) });
    return result;
  } catch {
    return { available: false, definitiveMissing: false, status: 0, contentType: "", contentLength: 0 };
  }
}

async function resolveBannerMedia(value, options = {}) {
  const raw = String(value || "").trim();
  if (!raw) return { url: "", available: false, missing: true };
  const candidate = getR2Candidate(raw, options.env || process.env);
  if (!candidate) return { url: raw, available: true, missing: false, checked: false };
  const result = await checkPublicObject(candidate, options.fetch || globalThis.fetch);
  if (result.available) return { url: candidate, available: true, missing: false, checked: true, ...result };
  return { url: raw, available: false, missing: result.definitiveMissing, checked: true, status: result.status };
}

module.exports = { getR2Candidate, checkPublicObject, resolveBannerMedia };
