const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const mountGuliAiAgent = require("./guliAiAgent");

// Temporary compatibility bridge for the current patch-heavy backend.
// The long-term target is to register this route directly in index.js after
// the backend patch stack is consolidated.
if (!global.__GULI_AI_AGENT_LISTEN_PATCH__) {
  global.__GULI_AI_AGENT_LISTEN_PATCH__ = true;

  const originalListen = express.application.listen;
  express.application.listen = function guliAiListen(...args) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
      const adminSecret = String(process.env.ADMIN_SECRET || "").trim();

      const safeEqual = (a, b) => {
        const left = Buffer.from(String(a || ""));
        const right = Buffer.from(String(b || ""));
        return left.length === right.length && crypto.timingSafeEqual(left, right);
      };

      const requireAdmin = (req, res, next) => {
        try {
          const header = String(req.headers.authorization || "");
          const token = header.startsWith("Bearer ") ? header.slice(7) : "";
          if (!adminSecret || !token) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
          const [body, signature] = token.split(".");
          if (!body || !signature) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
          const expected = crypto.createHmac("sha256", adminSecret).update(body).digest("base64url");
          if (!safeEqual(signature, expected)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
          const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
          if (payload.role !== "admin" || Number(payload.exp) <= Date.now()) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
          next();
        } catch {
          return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
        }
      };

      mountGuliAiAgent({ app: this, supabase, requireAdmin });
      console.log("[GULI AI] agent routes mounted");
    } catch (error) {
      console.error("[GULI AI] route mount failed:", error);
    }
    return originalListen.apply(this, args);
  };
}
