const crypto = require("crypto");

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 900 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseDataUrl(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(String(value || ""));
  if (!match) throw new Error("Review rasmi JPG, PNG yoki WEBP bo‘lishi kerak");
  const contentType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!ALLOWED_PHOTO_TYPES.has(contentType)) throw new Error("Review rasmi formati qo‘llab-quvvatlanmaydi");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) throw new Error("Review rasmi 900 KB dan kichik bo‘lishi kerak");
  return { contentType, buffer };
}

function sanitizeText(value, max) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

function orderContainsProduct(order, productId, productCode) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.some((item) => {
    const product = item?.product || {};
    const idMatch = productId && String(product.id || item.product_id || "") === String(productId);
    const codeMatch = productCode && String(product.product_code || item.product_code || "") === String(productCode);
    return idMatch || codeMatch;
  });
}

function registerReviewRoutes(app, { supabase, requireTelegramUser }) {
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,product_code")
        .eq("id", req.params.id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });

      const { data, error } = await supabase
        .from("product_reviews")
        .select("id,product_id,product_code,telegram_id,username,first_name,rating,comment,photos,verified_purchase,order_number,created_at")
        .eq("product_id", product.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = data || [];
      const count = rows.length;
      const average = count ? Number((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / count).toFixed(1)) : 0;
      res.json({ success: true, data: { reviews: rows, count, average } });
    } catch (error) {
      console.error("Reviews GET error:", error);
      res.status(500).json({ success: false, message: "Sharhlarni yuklashda xatolik" });
    }
  });

  app.get("/api/products/:id/reviews/eligibility", requireTelegramUser, async (req, res) => {
    try {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,product_code")
        .eq("id", req.params.id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });

      const { data: orders, error } = await supabase
        .from("orders")
        .select("order_number,status,items,created_at")
        .eq("telegram_id", req.telegramUser.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const eligibleOrder = (orders || []).find((order) =>
        ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi"].includes(order.status) &&
        orderContainsProduct(order, product.id, product.product_code)
      );
      if (!eligibleOrder) return res.json({ success: true, data: { eligible: false, order_number: null } });

      const { data: existing, error: existingError } = await supabase
        .from("product_reviews")
        .select("id")
        .eq("product_id", product.id)
        .eq("telegram_id", req.telegramUser.id)
        .eq("order_number", eligibleOrder.order_number)
        .maybeSingle();
      if (existingError && existingError.code !== "PGRST116") throw existingError;

      res.json({ success: true, data: { eligible: !existing, order_number: eligibleOrder.order_number } });
    } catch (error) {
      console.error("Review eligibility error:", error);
      res.status(500).json({ success: false, message: "Sharh berish huquqini tekshirishda xatolik" });
    }
  });

  app.post("/api/products/:id/reviews", requireTelegramUser, async (req, res) => {
    try {
      const rating = Number(req.body?.rating);
      const comment = sanitizeText(req.body?.comment, 1200);
      const requestedPhotos = Array.isArray(req.body?.photos) ? req.body.photos.slice(0, MAX_PHOTOS) : [];
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: "1–5 oralig‘ida baho tanlang" });
      if (comment.length < 3) return res.status(400).json({ success: false, message: "Sharh kamida 3 ta belgidan iborat bo‘lsin" });

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,product_code,name")
        .eq("id", req.params.id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });

      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select("order_number,status,items")
        .eq("telegram_id", req.telegramUser.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (orderError) throw orderError;
      const eligibleOrder = (orders || []).find((order) =>
        ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi"].includes(order.status) &&
        orderContainsProduct(order, product.id, product.product_code)
      );
      if (!eligibleOrder) return res.status(403).json({ success: false, message: "Faqat xarid qilingan mahsulotga sharh qoldirish mumkin" });

      const photos = [];
      for (const photo of requestedPhotos) {
        const parsed = parseDataUrl(photo);
        const extension = parsed.contentType.split("/")[1].replace("jpeg", "jpg");
        const path = `${req.telegramUser.id}/${String(product.id)}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("review-images").upload(path, parsed.buffer, {
          contentType: parsed.contentType,
          upsert: false,
          cacheControl: "31536000",
        });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from("review-images").getPublicUrl(path);
        photos.push(publicUrl.publicUrl);
      }

      const row = {
        product_id: product.id,
        product_code: product.product_code || "",
        telegram_id: req.telegramUser.id,
        username: req.telegramUser.username || null,
        first_name: req.telegramUser.first_name || null,
        rating,
        comment,
        photos,
        verified_purchase: true,
        order_number: eligibleOrder.order_number,
        status: "approved",
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("product_reviews").insert([row]).select().single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, message: "Siz bu buyurtma bo‘yicha allaqachon sharh qoldirgansiz" });
        throw error;
      }
      res.status(201).json({ success: true, message: "Sharhingiz qabul qilindi ✓", data });
    } catch (error) {
      console.error("Reviews POST error:", error);
      res.status(500).json({ success: false, message: error.message || "Sharhni saqlashda xatolik" });
    }
  });
}

module.exports = { registerReviewRoutes };
