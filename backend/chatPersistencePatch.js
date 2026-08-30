// Extended chat persistence. Loaded after chatRealtimePatch and before backend/index.js.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

function isAdmin(req) {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ") || !process.env.ADMIN_SECRET) return false;
  try {
    const [body, sig] = h.slice(7).split(".");
    const crypto = require("crypto");
    const expected = crypto.createHmac("sha256", process.env.ADMIN_SECRET).update(body).digest("base64url");
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return sig === expected && p.role === "admin" && Number(p.exp) > Date.now();
  } catch { return false; }
}

function metadataFromBody(body) {
  const keys = ["conversationId","type","mediaUrl","fileName","audioDuration","replyToId","replyToText","replyToSender","reactions","pollQuestion","pollOptions","userVotedOption","location","userName","userPhoto"];
  const metadata = {};
  for (const key of keys) if (body?.[key] !== undefined) metadata[key] = body[key];
  return metadata;
}

const originalPost = express.application.post;
express.application.post = function patchedPost(path, ...handlers) {
  if (path === "/api/chat/messages" && handlers.length) {
    const i = handlers.length - 1;
    const handler = handlers[i];
    handlers[i] = async (req, res, next) => {
      let payload = null;
      const originalJson = res.json.bind(res);
      res.json = body => { payload = body; return originalJson(body); };
      const result = await handler(req, res, next);
      const metadata = metadataFromBody(req.body || {});
      const id = payload?.data?.id;
      if (id && Object.keys(metadata).length && supabase) {
        const { error } = await supabase.from("chat_messages").update({ metadata }).eq("id", id);
        if (error) console.warn("[Chat persistence] metadata update skipped:", error.message);
      }
      return result;
    };
  }
  return originalPost.call(this, path, ...handlers);
};

const originalPatch = express.application.patch;
express.application.patch = function patchedPatch(path, ...handlers) {
  if (path === "/api/chat/messages/:id") {
    return originalPatch.call(this, path, async (req, res) => {
      if (!isAdmin(req)) return res.status(401).json({ success: false, message: "Admin sessiyasi tasdiqlanmadi" });
      if (!supabase) return res.status(503).json({ success: false, message: "Chat bazasi sozlanmagan" });
      const metadata = metadataFromBody(req.body || {});
      const patch = {};
      if (Object.keys(metadata).length) patch.metadata = metadata;
      if (req.body?.editedAt) patch.edited_at = req.body.editedAt;
      if (req.body?.deletedAt) patch.deleted_at = req.body.deletedAt;
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: "Yangilanish ma'lumoti yo'q" });
      const { data, error } = await supabase.from("chat_messages").update(patch).eq("id", req.params.id).select("*").single();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, data });
    });
  }
  return originalPatch.call(this, path, ...handlers);
};
