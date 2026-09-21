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
  const keys = ["conversationId","clientMessageId","client_message_id","type","mediaUrl","fileName","audioDuration","replyToId","replyToText","replyToSender","reactions","pollQuestion","pollOptions","userVotedOption","location","userName","userPhoto"];
  const metadata = {};
  for (const key of keys) if (body?.[key] !== undefined) metadata[key] = body[key];
  if (body?.metadata && typeof body.metadata === "object") Object.assign(metadata, body.metadata);
  return metadata;
}

const originalPost = express.application.post;
express.application.post = function patchedPost(path, ...handlers) {
  if (path === "/api/chat/messages" && handlers.length) {
    const i = handlers.length - 1;
    const handler = handlers[i];
    handlers[i] = async (req, res, next) => {
      // Capture the base handler's response body WITHOUT sending it yet.
      // This lets us finish the metadata write (and merge it into the
      // body) before anything downstream (including chatRealtimePatch's
      // own res.json interception, which drives the realtime/SSE
      // publish) ever sees the response. See commit message for why the
      // previous "update after res.json()" ordering was Root Cause A of
      // browser image realtime failures.
      let captured;
      let captureCalled = false;
      const originalJson = res.json.bind(res);
      res.json = (body) => { captured = body; captureCalled = true; return res; };

      const result = await handler(req, res, next);

      if (!captureCalled) return result;
      let body = captured;
      const metadata = metadataFromBody(req.body || {});
      const id = body?.data?.id;
      if (id && Object.keys(metadata).length && supabase) {
        try {
          const { data: updated, error } = await supabase
            .from("chat_messages")
            .update({ metadata })
            .eq("id", id)
            .select("*")
            .single();
          if (error) {
            console.warn("[Chat persistence] metadata update skipped:", error.message);
          } else if (updated) {
            body = { ...body, data: { ...updated } };
            // Canonical flattened fields for frontend consumers that read
            // top-level type/mediaUrl instead of message.metadata.*.
            if (metadata.type !== undefined) body.data.type = metadata.type;
            if (metadata.mediaUrl !== undefined) body.data.mediaUrl = metadata.mediaUrl;
            if (metadata.fileName !== undefined) body.data.fileName = metadata.fileName;
            if (metadata.mimeType !== undefined) body.data.mimeType = metadata.mimeType;
          }
        } catch (e) {
          console.warn("[Chat persistence] metadata update failed:", e.message);
        }
      }
      originalJson(body);
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
