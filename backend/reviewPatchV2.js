// GULI product reviews v2: UUID-safe product matching, verified delivered purchases, and public aggregate stats.
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
  const match = String(value || "").match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase().replace("jpg", "jpeg");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > REVIEW_MAX_PHOTO_BYTES) return null;
  return { mime, ext: mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg", buffer };
}

function sameId(left, right) {
  if (left == null || right == null || left === "" || right === "") return false;
  return String(left) === String(right);
}

function orderContainsProduct(order, productId, productCode) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.some((item) => {
    const p = item?.product || {};
    return sameId(p.id ?? item?.product_id, productId) || String(p.product_code || item?.product_code || "") === String(productCode || "");
  });
}

async function findVerifiedReviewOrder(telegramId, productId, productCode) {
  const { data, error } = await supabase.from("orders").select("order_number,status,items,created_at").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).find((order) => String(order.status || "") === "Yetkazildi" && orderContainsProduct(order, productId, productCode)) || null;
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
    const rows = (data || []).map((row) => ({ ...row, display_name: reviewDisplayName(row), photos: Array.isArray(row.photos) ? row.photos : [] }));
    const liveCount = rows.length;
    const liveSum = rows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
    const legacyCount = Math.max(0, Number(product.reviews || 0));
    const legacyAverage = Math.max(0, Number(product.rating || 0));
    const totalCount = legacyCount + liveCount;
    const totalAverage = totalCount ? Math.round(((legacyAverage * legacyCount + liveSum) / totalCount) * 100) / 100 : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: rows.filter((row) => Number(row.rating) === star).length }));
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
    const { data: duplicate, error: duplicateError } = await supabase.from("product_reviews").select("id").eq("product_id", product.id).eq("telegram_id", req.telegramUser.id).eq("order_number", order.order_number).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return res.status(409).json({ success: false, message: "Bu buyurtma uchun sharh allaqachon qoldirilgan." });

    const inputPhotos = Array.isArray(req.body?.photos) ? req.body.photos.slice(0, REVIEW_MAX_PHOTOS) : [];
    const photoUrls = [];
    for (const input of inputPhotos) {
      const parsed = parseReviewPhoto(input);
      if (!parsed) continue;
      const path = `${req.telegramUser.id}/${product.id}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${parsed.ext}`;
      const { error: uploadError } = await supabase.storage.from("review-images").upload(path, parsed.buffer, { contentType: parsed.mime, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("review-images").getPublicUrl(path);
      if (publicData?.publicUrl) photoUrls.push(publicData.publicUrl);
    }
    const row = { product_id: product.id, product_code: code, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, rating, comment, photos: photoUrls, verified_purchase: true, order_number: order.order_number, status: "approved", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("product_reviews").insert([row]).select("id,rating,comment,photos,username,first_name,created_at,verified_purchase,order_number").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ success: false, message: "Bu buyurtma uchun sharh allaqachon qoldirilgan." });
      throw error;
    }
    res.status(201).json({ success: true, message: "Sharhingiz e’lon qilindi ✓", data: { ...data, display_name: reviewDisplayName(data) } });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ success: false, message: "Sharhni saqlashda xatolik" });
  }
});

app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const { data: reviewRows, error: reviewError } = await supabase.from("product_reviews").select("id,product_id,product_code,telegram_id,username,first_name,rating,comment,photos,verified_purchase,order_number,status,created_at,updated_at").order("created_at", { ascending: false }).limit(500);
    if (reviewError) throw reviewError;
    const rows = reviewRows || [];
    const productIds = [...new Set(rows.map((row) => row.product_id).filter((value) => value != null && value !== ""))];
    const productCodes = [...new Set(rows.map((row) => String(row.product_code || "")).filter(Boolean))];
    const telegramIds = [...new Set(rows.map((row) => row.telegram_id).filter((value) => value != null))];
    const orderNumbers = [...new Set(rows.map((row) => String(row.order_number || "")).filter(Boolean))];

    const [productsByIdResult, productsByCodeResult, usersResult, ordersResult] = await Promise.all([
      productIds.length ? supabase.from("products").select("id,product_code,name,title,image,images,category,price,old_price,stock,active").in("id", productIds) : Promise.resolve({ data: [], error: null }),
      productCodes.length ? supabase.from("products").select("id,product_code,name,title,image,images,category,price,old_price,stock,active").in("product_code", productCodes) : Promise.resolve({ data: [], error: null }),
      telegramIds.length ? supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,updated_at").in("telegram_id", telegramIds) : Promise.resolve({ data: [], error: null }),
      orderNumbers.length ? supabase.from("orders").select("order_number,status,total,subtotal,delivery,discount,phone,address,created_at,updated_at").in("order_number", orderNumbers) : Promise.resolve({ data: [], error: null })
    ]);
    const firstError = [productsByIdResult.error, productsByCodeResult.error, usersResult.error, ordersResult.error].find(Boolean);
    if (firstError) throw firstError;

    const productMap = new Map();
    [...(productsByIdResult.data || []), ...(productsByCodeResult.data || [])].forEach((product) => productMap.set(String(product.id), product));
    const userMap = new Map((usersResult.data || []).map((user) => [String(user.telegram_id), user]));
    const orderMap = new Map((ordersResult.data || []).map((order) => [String(order.order_number), order]));

    const enriched = rows.map((row) => {
      const product = productMap.get(String(row.product_id)) || (productCodes.length ? (productsByCodeResult.data || []).find((item) => String(item.product_code) === String(row.product_code)) : null) || null;
      const user = userMap.get(String(row.telegram_id)) || null;
      const order = orderMap.get(String(row.order_number)) || null;
      return {
        ...row,
        product_name: product?.name || product?.title || null,
        product_title: product?.title || product?.name || null,
        product_image: product?.image || (Array.isArray(product?.images) ? product.images[0] : null) || null,
        product_images: Array.isArray(product?.images) ? product.images : [],
        product_category: product?.category || null,
        product_price: product?.price ?? null,
        product_old_price: product?.old_price ?? null,
        product_stock: product?.stock ?? null,
        product_active: product?.active ?? null,
        customer_username: user?.username || row.username || null,
        customer_first_name: user?.first_name || row.first_name || null,
        customer_last_name: user?.last_name || null,
        customer_phone: user?.telegram_phone || null,
        order_status: order?.status || null,
        order_total: order?.total ?? null,
        order_subtotal: order?.subtotal ?? null,
        order_delivery: order?.delivery ?? null,
        order_discount: order?.discount ?? null,
        order_phone: order?.phone || null,
        order_address: order?.address || null,
        order_created_at: order?.created_at || null,
        order_updated_at: order?.updated_at || null
      };
    });
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Admin reviews GET error:", error);
    res.status(500).json({ success: false, message: "Sharhlarni yuklashda xatolik" });
  }
});

app.patch("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "");
    if (!Number.isFinite(id) || !["approved", "hidden"].includes(status)) return res.status(400).json({ success: false, message: "Sharh holati noto‘g‘ri" });
    const { data, error } = await supabase.from("product_reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error("Admin review PATCH error:", error);
    res.status(500).json({ success: false, message: "Sharh holatini o‘zgartirishda xatolik" });
  }
});

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: "Sharh ID noto‘g‘ri" });
    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Admin review DELETE error:", error);
    res.status(500).json({ success: false, message: "Sharhni o‘chirishda xatolik" });
  }
});