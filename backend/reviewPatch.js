// GULI public product reviews: verified-purchase, transparent and Telegram-authenticated.
const REVIEW_MAX_PHOTOS = 3;
const REVIEW_MAX_PHOTO_BYTES = 220 * 1024;

function reviewDisplayName(row) {
  const first = String(row?.first_name || "").trim();
  const username = String(row?.username || "").trim();
  if (first && username) return `${first} (@${username})`;
  if (first) return first;
  if (username) return `@${username}`;
  return "GULI mijozi";
}

function parseReviewPhoto(value) {
  const raw = String(value || "");
  const match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase().replace("jpg", "jpeg");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > REVIEW_MAX_PHOTO_BYTES) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, buffer };
}

async function findVerifiedReviewOrder(telegramId, productId, productCode) {
  const { data, error } = await supabase.from("orders").select("order_number,status,items,created_at").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  for (const order of data || []) {
    if (String(order.status || "") !== "Yetkazildi") continue;
    const items = Array.isArray(order.items) ? order.items : [];
    const found = items.some(item => {
      const p = item?.product || {};
      return Number(p.id ?? item?.product_id) === Number(productId) || String(p.product_code || item?.product_code || "") === String(productCode);
    });
    if (found) return order;
  }
  return null;
}

app.get("/api/reviews", async (req, res) => {
  try {
    const code = String(req.query.product_code || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Mahsulot kodi noto‘g‘ri" });
    const { data: product, error: productError } = await supabase.from("products").select("id,product_code,rating,reviews").eq("product_code", code).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    const { data, error } = await supabase.from("product_reviews").select("id,rating,comment,photos,username,first_name,created_at,verified_purchase,order_number").eq("product_id", product.id).eq("status", "approved").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data || []).map(row => ({ ...row, display_name: reviewDisplayName(row), photos: Array.isArray(row.photos) ? row.photos : [] }));
    const distribution = [5,4,3,2,1].map(star => ({ star, count: rows.filter(r => Number(r.rating) === star).length }));
    const liveCount = rows.length;
    const liveSum = rows.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    const legacyCount = Number(product.reviews || 0);
    const legacyAverage = Number(product.rating || 0);
    const totalCount = legacyCount + liveCount;
    const totalAverage = totalCount ? Math.round(((legacyAverage * legacyCount + liveSum) / totalCount) * 100) / 100 : 0;
    res.json({ success: true, data: { reviews: rows, distribution, live_count: liveCount, live_average: liveCount ? Math.round(liveSum / liveCount * 100) / 100 : 0, legacy_count: legacyCount, legacy_average: legacyAverage, total_count: totalCount, total_average: totalAverage } });
  } catch (error) {
    console.error("Public reviews API error:", error);
    res.status(500).json({ success: false, message: "Sharhlarni yuklashda xatolik" });
  }
});

app.get("/api/reviews/can-review", requireTelegramUser, async (req, res) => {
  try {
    const code = String(req.query.product_code || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Mahsulot kodi noto‘g‘ri" });
    const { data: product, error: productError } = await supabase.from("products").select("id,product_code,name").eq("product_code", code).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    const order = await findVerifiedReviewOrder(req.telegramUser.id, product.id, code);
    if (!order) return res.json({ success: true, data: { eligible: false, reason: "Baho berish faqat yetkazilgan buyurtmadan keyin mumkin." } });
    const { data: existing, error } = await supabase.from("product_reviews").select("id,rating,comment,photos,created_at").eq("product_id", product.id).eq("telegram_id", req.telegramUser.id).eq("order_number", order.order_number).maybeSingle();
    if (error) throw error;
    res.json({ success: true, data: { eligible: true, verified_purchase: true, order_number: order.order_number, existing: existing || null } });
  } catch (error) {
    console.error("Review eligibility error:", error);
    res.status(500).json({ success: false, message: "Baho berish imkonini tekshirishda xatolik" });
  }
});

app.post("/api/reviews", requireTelegramUser, async (req, res) => {
  try {
    const code = String(req.body?.product_code || "").trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Mahsulot kodi noto‘g‘ri" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: "Baho 1 dan 5 gacha bo‘lishi kerak" });
    if (comment.length < 3 || comment.length > 1200) return res.status(400).json({ success: false, message: "Sharh 3–1200 belgi bo‘lishi kerak" });
    const { data: product, error: productError } = await supabase.from("products").select("id,product_code,name").eq("product_code", code).maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    const order = await findVerifiedReviewOrder(req.telegramUser.id, product.id, code);
    if (!order) return res.status(403).json({ success: false, message: "Faqat yetkazilgan buyurtma uchun sharh qoldirish mumkin." });
    const { data: duplicate } = await supabase.from("product_reviews").select("id").eq("product_id", product.id).eq("telegram_id", req.telegramUser.id).eq("order_number", order.order_number).maybeSingle();
    if (duplicate) return res.status(409).json({ success: false, message: "Bu buyurtma uchun sharh allaqachon qoldirilgan." });

    const inputPhotos = Array.isArray(req.body?.photos) ? req.body.photos.slice(0, REVIEW_MAX_PHOTOS) : [];
    const photoUrls = [];
    for (const input of inputPhotos) {
      const parsed = parseReviewPhoto(input);
      if (!parsed) continue;
      const path = `${req.telegramUser.id}/${product.id}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${parsed.ext}`;
      const { error: uploadError } = await supabase.storage.from("review-images").upload(path, parsed.buffer, { contentType: parsed.mime, cacheControl: "31536000", upsert: false });
      if (!uploadError) {
        const { data: publicData } = supabase.storage.from("review-images").getPublicUrl(path);
        if (publicData?.publicUrl) photoUrls.push(publicData.publicUrl);
      }
    }
    const row = { product_id: product.id, product_code: code, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, rating, comment, photos: photoUrls, verified_purchase: true, order_number: order.order_number, status: "approved", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("product_reviews").insert([row]).select("id,rating,comment,photos,username,first_name,created_at,verified_purchase,order_number").single();
    if (error) throw error;
    res.status(201).json({ success: true, message: "Sharhingiz e’lon qilindi ✓", data: { ...data, display_name: reviewDisplayName(data) } });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ success: false, message: "Sharhni saqlashda xatolik" });
  }
});

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: "Sharh ID noto‘g‘ri" });
    const { data: review, error: reviewError } = await supabase.from("product_reviews").select("product_id,photos").eq("id", id).maybeSingle();
    if (reviewError) throw reviewError;
    if (!review) return res.status(404).json({ success: false, message: "Sharh topilmadi" });
    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Sharhni o‘chirishda xatolik" });
  }
});
