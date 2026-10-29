const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAdmin } = require("./adminAuth");

let client;
function db() {
  if (client) return client;
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !key) throw new Error("Reels API Supabase server credentials are not configured");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
function fail(res, error, status = 500) {
  console.error("[Reels API]", error?.message || error);
  return res.status(status).json({ success: false, message: status === 500 ? "Reels server xatoligi. Ma'lumotlar bazasi migratsiyasini tekshiring." : String(error?.message || error) });
}
function normalizeReel(row, comments = []) {
  const author = row.author && typeof row.author === "object" ? row.author : {};
  return {
    id: String(row.id),
    videoUrl: row.video_url || "",
    posterUrl: row.poster_url || "",
    caption: row.caption || "",
    musicTitle: row.music_title || undefined,
    author: {
      name: author.name || "Guli Market",
      username: author.username || "gulii.uz",
      avatar: author.avatar || "/guli-logo.png",
      verified: Boolean(author.verified),
    },
    productId: row.product_id || undefined,
    productName: row.product_name || undefined,
    productPrice: row.product_price == null ? undefined : Number(row.product_price),
    productImage: row.product_image || undefined,
    likesCount: Number(row.likes_count || 0),
    displayLikesCount: Number(row.display_likes_count || 0),
    commentsCount: comments.length,
    sharesCount: Number(row.shares_count || 0),
    viewsCount: Number(row.views_count || 0),
    isLiked: false,
    status: row.status || "draft",
    createdAt: row.created_at || new Date().toISOString(),
    comments: comments.map((comment) => ({
      id: String(comment.id),
      authorName: comment.author_name || "Mehmon",
      authorAvatar: comment.author_avatar || "/guli-logo.png",
      text: comment.body || "",
      createdAt: comment.created_at || "",
      likesCount: Number(comment.likes_count || 0),
      isLiked: false,
    })),
  };
}
function toRow(input, existing = {}) {
  const status = ["active", "draft", "inactive"].includes(input.status) ? input.status : (existing.status || "draft");
  return {
    id: String(input.id || existing.id || ""),
    video_url: String(input.videoUrl ?? existing.video_url ?? "").trim(),
    poster_url: String(input.posterUrl ?? existing.poster_url ?? "").trim(),
    caption: String(input.caption ?? existing.caption ?? "").trim().slice(0, 2200),
    music_title: String(input.musicTitle ?? existing.music_title ?? "").trim().slice(0, 200) || null,
    author: input.author && typeof input.author === "object" ? input.author : (existing.author || { name: "Guli Market", username: "gulii.uz", avatar: "/guli-logo.png", verified: true }),
    product_id: input.productId == null ? (existing.product_id || null) : String(input.productId),
    product_name: input.productName ?? existing.product_name ?? null,
    product_price: input.productPrice == null ? (existing.product_price ?? null) : Number(input.productPrice),
    product_image: input.productImage ?? existing.product_image ?? null,
    status,
    likes_count: Number(existing.likes_count || 0),
    display_likes_count: Math.max(0, Math.min(5000, Math.round(Number(input.displayLikesCount ?? existing.display_likes_count ?? 100) || 0))),
    shares_count: Number(existing.shares_count || 0),
    views_count: Number(existing.views_count || 0),
    updated_at: new Date().toISOString(),
  };
}
async function fetchReels(status) {
  let query = db().from("reels").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(100);
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const result = await db().from("reel_comments").select("*").in("reel_id", ids).order("created_at", { ascending: false }).limit(2000);
  if (result.error) throw result.error;
  const grouped = new Map();
  for (const comment of result.data || []) {
    const list = grouped.get(comment.reel_id) || [];
    list.push(comment);
    grouped.set(comment.reel_id, list);
  }
  return rows.map((row) => normalizeReel(row, grouped.get(row.id) || []));
}

// Public feed: only active records are exposed.
install("get", "/api/reels", async (_req, res) => {
  try {
    return res.json({ success: true, data: await fetchReels("active") });
  } catch (error) { return fail(res, error); }
});
install("get", "/api/reels/:id/comments", async (req, res) => {
  try {
    const { data, error } = await db().from("reel_comments").select("*").eq("reel_id", String(req.params.id)).order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    return res.json({ success: true, data: (data || []).map((c) => ({ id: c.id, authorName: c.author_name, authorAvatar: c.author_avatar, text: c.body, createdAt: c.created_at, likesCount: Number(c.likes_count || 0) })) });
  } catch (error) { return fail(res, error); }
});
install("post", "/api/reels/:id/comments", async (req, res) => {
  try {
    const reelId = String(req.params.id || "").slice(0, 120);
    const body = String(req.body?.text || "").trim().slice(0, 300);
    if (!body) return fail(res, new Error("Izoh matni bo'sh"), 400);
    const exists = await db().from("reels").select("id").eq("id", reelId).eq("status", "active").maybeSingle();
    if (exists.error) throw exists.error;
    if (!exists.data) return fail(res, new Error("Reels topilmadi"), 404);
    const row = { id: "comment-" + require("crypto").randomUUID(), reel_id: reelId, author_name: "Siz (Mehmon)", author_avatar: "/guli-logo.png", body };
    const { data, error } = await db().from("reel_comments").insert(row).select("*").single();
    if (error) throw error;
    return res.status(201).json({ success: true, data: { id: data.id, authorName: data.author_name, authorAvatar: data.author_avatar, text: data.body, createdAt: data.created_at, likesCount: 0 } });
  } catch (error) { return fail(res, error); }
});
install("post", "/api/reels/:id/like", async (req, res) => {
  try {
    const reelId = String(req.params.id || "").slice(0, 120);
    const viewerKey = String(req.body?.viewerKey || "").trim().slice(0, 128);
    if (!/^[a-zA-Z0-9_-]{12,128}$/.test(viewerKey)) return fail(res, new Error("Viewer kaliti noto'g'ri"), 400);
    const exists = await db().from("reels").select("id,likes_count").eq("id", reelId).eq("status", "active").maybeSingle();
    if (exists.error) throw exists.error;
    if (!exists.data) return fail(res, new Error("Reels topilmadi"), 404);
    const current = await db().from("reel_likes").select("reel_id").eq("reel_id", reelId).eq("viewer_key", viewerKey).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) {
      const removed = await db().from("reel_likes").delete().eq("reel_id", reelId).eq("viewer_key", viewerKey);
      if (removed.error) throw removed.error;
    } else {
      const added = await db().from("reel_likes").insert({ reel_id: reelId, viewer_key: viewerKey });
      if (added.error) throw added.error;
    }
    const countResult = await db().from("reel_likes").select("reel_id", { count: "exact", head: true }).eq("reel_id", reelId);
    if (countResult.error) throw countResult.error;
    const likesCount = Number(countResult.count || 0);
    const updated = await db().from("reels").update({ likes_count: likesCount }).eq("id", reelId);
    if (updated.error) throw updated.error;
    return res.json({ success: true, data: { isLiked: !current.data, likesCount } });
  } catch (error) { return fail(res, error); }
});
install("post", "/api/reels/:id/view", async (req, res) => {
  try {
    const reelId = String(req.params.id || "").slice(0, 120);
    const { data, error } = await db().from("reels").select("views_count").eq("id", reelId).eq("status", "active").maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, new Error("Reels topilmadi"), 404);
    const viewsCount = Number(data.views_count || 0) + 1;
    const updated = await db().from("reels").update({ views_count: viewsCount }).eq("id", reelId);
    if (updated.error) throw updated.error;
    return res.json({ success: true, data: { viewsCount } });
  } catch (error) { return fail(res, error); }
});

// Admin receives a short-lived signed upload token; large media bypasses the JSON API.
install("post", "/api/admin/reels/upload-url", requireAdmin, async (req, res) => {
  try {
    const fileName = String(req.body?.fileName || "media").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const contentType = String(req.body?.contentType || "").toLowerCase();
    const allowed = new Set(["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowed.has(contentType)) return fail(res, new Error("Bu fayl formati qo'llab-quvvatlanmaydi"), 400);
    const isVideo = contentType.startsWith("video/");
    const ext = (fileName.match(/\.([a-zA-Z0-9]{2,5})$/) || [])[1] || (isVideo ? "mp4" : "webp");
    const path = `${isVideo ? "videos" : "posters"}/${require("crypto").randomUUID()}.${ext.toLowerCase()}`;
    const bucket = "reels-media";
    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw error;
    const publicUrl = db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return res.json({ success: true, data: { path, token: data.token, publicUrl, bucket } });
  } catch (error) { return fail(res, error); }
});

// Direct binary upload avoids dependence on a browser Supabase anon key.
install("post", "/api/admin/reels/upload", requireAdmin, require("express").raw({ type: () => true, limit: "100mb" }), async (req, res) => {
  try {
    const contentType = String(req.headers["content-type"] || "").toLowerCase().split(";")[0].trim();
    const allowed = new Set(["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowed.has(contentType)) return fail(res, new Error("Unsupported media type"), 400);
    if (!Buffer.isBuffer(req.body) || !req.body.length) return fail(res, new Error("Uploaded file is empty"), 400);
    const isVideo = contentType.startsWith("video/");
    const extensionByType = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
    const path = (isVideo ? "videos/" : "posters/") + require("crypto").randomUUID() + "." + extensionByType[contentType];
    const bucket = "reels-media";
    const { data, error } = await db().storage.from(bucket).upload(path, req.body, { contentType, upsert: false });
    if (error) throw error;
    const publicUrl = db().storage.from(bucket).getPublicUrl(data.path || path).data.publicUrl;
    return res.status(201).json({ success: true, data: { path: data.path || path, publicUrl, bucket } });
  } catch (error) { return fail(res, error, error?.statusCode === 413 ? 413 : 500); }
});

// Admin endpoints all require the same signed admin session as the existing panel.
install("get", "/api/admin/reels", requireAdmin, async (_req, res) => {
  try { return res.json({ success: true, data: await fetchReels(null) }); }
  catch (error) { return fail(res, error); }
});
install("post", "/api/admin/reels", requireAdmin, async (req, res) => {
  try {
    const row = toRow(req.body || {});
    if (!row.id || !row.video_url || !row.caption) return fail(res, new Error("Caption va video URL majburiy"), 400);
    const { data, error } = await db().from("reels").insert(row).select("*").single();
    if (error) throw error;
    return res.status(201).json({ success: true, data: normalizeReel(data) });
  } catch (error) { return fail(res, error); }
});
install("put", "/api/admin/reels/:id", requireAdmin, async (req, res) => {
  try {
    const current = await db().from("reels").select("*").eq("id", String(req.params.id)).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return fail(res, new Error("Reels topilmadi"), 404);
    const row = toRow({ ...(req.body || {}), id: String(req.params.id) }, current.data);
    if (!row.video_url || !row.caption) return fail(res, new Error("Caption va video URL majburiy"), 400);
    const { data, error } = await db().from("reels").update(row).eq("id", row.id).select("*").single();
    if (error) throw error;
    return res.json({ success: true, data: normalizeReel(data) });
  } catch (error) { return fail(res, error); }
});
install("delete", "/api/admin/reels/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await db().from("reels").delete().eq("id", String(req.params.id));
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
});

module.exports = { fetchReels };
