// GULI customer auth token layer.
// This deliberately does NOT depend on Supabase Phone Auth/SMS provider.
// The backend signs short-lived customer JWTs and stores only hashed refresh tokens.
const crypto = require("crypto");

const SECRET = String(process.env.AUTH_JWT_SECRET || "").trim();
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}
function signPart(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}
function assertSecret() {
  if (SECRET.length < 32) throw new Error("AUTH_JWT_SECRET must be configured with at least 32 characters");
}

function issueAccessToken(user) {
  assertSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    phone: user.phone_number || user.phone || null,
    telegram_id: user.telegram_id != null ? Number(user.telegram_id) : null,
    role: "customer",
    iat: now,
    exp: now + ACCESS_TTL_SEC,
    jti: crypto.randomUUID(),
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${encoded}.${signPart(encoded)}`;
}

function verifyAccessToken(token) {
  assertSecret();
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = signPart(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (h.alg !== "HS256" || h.typ !== "JWT") return null;
    if (!p.sub || p.role !== "customer" || Number(p.exp) <= Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

function hashRefreshToken(token) {
  assertSecret();
  return crypto.createHmac("sha256", SECRET).update(String(token || "")).digest("hex");
}

async function issueRefreshToken(supabase, userId) {
  assertSecret();
  const token = crypto.randomBytes(48).toString("base64url");
  const { error } = await supabase.from("auth_refresh_tokens").insert({
    user_id: String(userId),
    token_hash: hashRefreshToken(token),
    expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function rotateRefreshToken(supabase, token) {
  assertSecret();
  const tokenHash = hashRefreshToken(token);
  const { data: row, error } = await supabase
    .from("auth_refresh_tokens")
    .select("id,user_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;

  const { error: revokeError } = await supabase
    .from("auth_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("revoked_at", null);
  if (revokeError) throw revokeError;
  const next = await issueRefreshToken(supabase, row.user_id);
  return { userId: String(row.user_id), refreshToken: next };
}

module.exports = {
  issueAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
};
