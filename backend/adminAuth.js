const crypto = require("crypto");

// Single source of truth for admin session verification used by patch modules.
// Keep this algorithm compatible with backend/index.js so existing sessions remain valid.
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim().replace(/^['"]|['"]$/g, "");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyAdminToken(token) {
  try {
    if (!ADMIN_SECRET || !token) return false;
    const parts = String(token).split(".");
    if (parts.length !== 2) return false;
    const [body, signature] = parts;
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  }
  next();
}

module.exports = { verifyAdminToken, requireAdmin };
