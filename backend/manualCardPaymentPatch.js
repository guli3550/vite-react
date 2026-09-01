// GULI manual card payment: HUMO / UZCARD card-to-card + receipt verification.
(() => {
  const CARD_NUMBER = String(process.env.CARD_PAYMENT_NUMBER || "").replace(/\D/g, "");
  const CARD_HOLDER = String(process.env.CARD_PAYMENT_NAME || "").trim();
  const RECEIPT_BUCKET = "payment-receipts";
  const GUEST_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
  const initials = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).map((part) => `${part.slice(0, 2)}...`).join(" ");
  const normalizePath = (value) => String(value || "").replace(/^\/+/, "");
  const signGuestToken = (guestId, expiresAt) => {
    const payload = Buffer.from(JSON.stringify({ guestId: Number(guestId), exp: Number(expiresAt) })).toString("base64url");
    const signature = crypto.createHmac("sha256", String(process.env.ADMIN_SECRET || "")).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  };
  const verifyGuestToken = (token) => {
    try {
      const [payload, signature] = String(token || "").split(".");
      if (!payload || !signature || !process.env.ADMIN_SECRET) return null;
      const expected = crypto.createHmac("sha256", String(process.env.ADMIN_SECRET)).update(payload).digest("base64url");
      if (!safeEqual(signature, expected)) return null;
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!Number.isSafeInteger(Number(data.guestId)) || Number(data.guestId) >= 0 || Number(data.exp) < Date.now()) return null;
      return { id: Number(data.guestId), username: null, first_name: null, last_name: null };
    } catch { return null; }
  };
  const requireCustomerUser = (req, res, next) => {
    const initData = req.headers["x-telegram-init-data"] || "";
    const telegramUser = verifyTelegramInitData(initData);
    if (telegramUser) { req.customerUser = telegramUser; return next(); }
    const guestUser = verifyGuestToken(req.headers["x-guli-guest-token"] || "");
    if (guestUser) { req.customerUser = guestUser; return next(); }
    return res.status(401).json({ success: false, message: "Mijoz sessiyasi topilmadi. Telegram Mini App yoki brauzer sessiyasini yangilang." });
  };
  async function ensureReceiptBucket() {
    const existing = await supabase.storage.getBucket(RECEIPT_BUCKET);
    if (!existing.error) return;
    const created = await supabase.storage.createBucket(RECEIPT_BUCKET, { public: false, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"], fileSizeLimit: "6MB" });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || "")) throw created.error;
  }

  app.post("/api/guest-session", (req, res) => {
    if (!process.env.ADMIN_SECRET) return res.status(503).json({ success: false, message: "Brauzer sessiyasi backend secret bilan sozlanmagan." });
    const random = BigInt(`0x${crypto.randomBytes(7).toString("hex")}`);
    const guestId = -Number((random % 900000000000n) + 100000000000n);
    const expiresAt = Date.now() + GUEST_TOKEN_TTL;
    res.json({ success: true, data: { token: signGuestToken(guestId, expiresAt), expires_at: new Date(expiresAt).toISOString() } });
  });

  app.get("/api/payment/card-info", requireCustomerUser, async (req, res) => {
    if (!/^\d{16}$/.test(CARD_NUMBER) || !CARD_HOLDER) return res.status(503).json({ success: false, message: "Karta to‘lovi rekvizitlari backend environment'da sozlanmagan." });
    res.json({ success: true, data: { card_number: CARD_NUMBER, holder_initials: initials(CARD_HOLDER) } });
  });

  app.post("/api/guest/orders", requireCustomerUser, async (req, res) => {
    try {
      if (req.customerUser.id > 0) return res.status(400).json({ success: false, message: "Telegram sessiyasi uchun asosiy checkout ishlatiladi." });
      const { phone, items, address, payment, status, promo_code } = req.body || {};
      if (!String(phone || "").trim()) return res.status(400).json({ success: false, message: "Telefon raqami kiritilmagan" });
      if (!Array.isArray(items) || !items.length || items.length > 100) return res.status(400).json({ success: false, message: "Buyurtma mahsulotlari noto‘g‘ri" });
      const orderInput = { order_number: null, username: null, first_name: null, phone: String(phone).trim(), items, address: address || null, payment: payment || "card_manual", status: status || "Qabul qilindi", promo_code: promo_code ? String(promo_code).trim().toUpperCase() : "" };
      const { data, error } = await supabase.rpc("create_secure_order", { p_order: orderInput, p_telegram_id: req.customerUser.id });
      if (error) throw error;
      res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data });
    } catch (error) {
      console.error("Guest secure checkout error:", error);
      const statusCode = /telefon|mahsulot|omborda|promo|minimal buyurtma|sotuvda|miqdori/i.test(error.message || "") ? 400 : 500;
      res.status(statusCode).json({ success: false, message: error.message || "Buyurtmani saqlashda xatolik" });
    }
  });

  app.post("/api/orders/:orderNumber/receipt", requireCustomerUser, async (req, res) => {
    try {
      const orderNumber = String(req.params.orderNumber || "").trim();
      const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,total,telegram_id,payment,payment_status").eq("order_number", orderNumber).eq("telegram_id", req.customerUser.id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });
      if (String(order.payment || "") !== "card_manual") return res.status(400).json({ success: false, message: "Bu buyurtma karta orqali to‘lov uchun yaratilmagan" });
      const { data, mimeType, extension } = req.body || {};
      if (!data || typeof data !== "string") return res.status(400).json({ success: false, message: "Chek rasmi topilmadi" });
      if (!/^image\/(jpeg|png|webp)$/.test(String(mimeType || "")) && mimeType !== "application/pdf") return res.status(400).json({ success: false, message: "Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin" });
      if (data.length > 8200000) return res.status(413).json({ success: false, message: "Chek hajmi juda katta" });
      await ensureReceiptBucket();
      const cleanExt = String(extension || (mimeType === "application/pdf" ? "pdf" : "jpg")).replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${cleanExt}`;
      const buffer = Buffer.from(data, "base64");
      const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, buffer, { contentType: mimeType, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data: updated, error: updateError } = await supabase.from("orders").update({ payment_receipt_path: path, payment_status: "receipt_uploaded", payment_receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).eq("telegram_id", req.customerUser.id).select("id,order_number,total,payment_status,payment_receipt_path").single();
      if (updateError) throw updateError;
      res.json({ success: true, message: "Chek muvaffaqiyatli yuborildi. Admin tekshiradi.", data: updated });
    } catch (error) {
      console.error("Receipt upload error:", error);
      if (/payment_receipt_path|payment_status|payment_receipt_uploaded_at/i.test(error.message || "")) return res.status(503).json({ success: false, message: "To‘lov chek ustunlari bazada hali tayyor emas. SQL migration'ni bir marta ishga tushiring." });
      res.status(500).json({ success: false, message: "Chekni yuborishda xatolik" });
    }
  });

  app.get("/api/admin/orders/:id/payment-receipt", requireAdmin, async (req, res) => {
    try {
      const { data: order, error } = await supabase.from("orders").select("id,order_number,total,payment,payment_status,payment_receipt_path,payment_receipt_uploaded_at,payment_verified_at").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });
      if (!order.payment_receipt_path) return res.status(404).json({ success: false, message: "Bu buyurtmaga chek yuborilmagan" });
      await ensureReceiptBucket();
      const { data: signed, error: signedError } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(normalizePath(order.payment_receipt_path), 900);
      if (signedError) throw signedError;
      res.json({ success: true, data: { ...order, receipt_url: signed.signedUrl } });
    } catch (error) { console.error("Admin receipt view error:", error); res.status(500).json({ success: false, message: "Chekni ochishda xatolik" }); }
  });

  // Admin can replace/attach a receipt and keep it in the same private Supabase bucket.
  app.post("/api/admin/orders/:id/payment-receipt", requireAdmin, async (req, res) => {
    try {
      const { data, mimeType, extension } = req.body || {};
      if (!data || typeof data !== "string") return res.status(400).json({ success: false, message: "Chek rasmi topilmadi" });
      if (!/^image\/(jpeg|png|webp)$/.test(String(mimeType || "")) && mimeType !== "application/pdf") return res.status(400).json({ success: false, message: "Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin" });
      if (data.length > 8200000) return res.status(413).json({ success: false, message: "Chek hajmi juda katta" });
      const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,payment,payment_status").eq("id", req.params.id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });
      await ensureReceiptBucket();
      const cleanExt = String(extension || (mimeType === "application/pdf" ? "pdf" : "jpg")).replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const path = `receipts/${order.id}/admin-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${cleanExt}`;
      const buffer = Buffer.from(data, "base64");
      const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, buffer, { contentType: mimeType, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data: updated, error: updateError } = await supabase.from("orders").update({ payment_receipt_path: path, payment_status: "receipt_uploaded", payment_receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).select("id,order_number,payment,payment_status,payment_receipt_path,payment_receipt_uploaded_at").single();
      if (updateError) throw updateError;
      const { data: signed, error: signedError } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 900);
      if (signedError) throw signedError;
      res.json({ success: true, message: "Chek admin tomonidan saqlandi", data: { ...updated, receipt_url: signed.signedUrl } });
    } catch (error) {
      console.error("Admin receipt upload error:", error);
      if (/payment_receipt_path|payment_status|payment_receipt_uploaded_at/i.test(error.message || "")) return res.status(503).json({ success: false, message: "To‘lov chek ustunlari bazada hali tayyor emas." });
      res.status(500).json({ success: false, message: "Chekni saqlashda xatolik" });
    }
  });

  app.put("/api/admin/orders/:id/payment", requireAdmin, async (req, res) => {
    try {
      const paymentStatus = ["pending", "receipt_uploaded", "verified", "rejected"].includes(String(req.body?.payment_status)) ? String(req.body.payment_status) : null;
      if (!paymentStatus) return res.status(400).json({ success: false, message: "To‘lov holati noto‘g‘ri" });
      const patch = { payment_status: paymentStatus, payment_verified_at: paymentStatus === "verified" ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("orders").update(patch).eq("id", req.params.id).select("*").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Admin payment status error:", error);
      if (/payment_status|payment_verified_at/i.test(error.message || "")) return res.status(503).json({ success: false, message: "To‘lov ustunlari bazada hali tayyor emas. SQL migration'ni ishga tushiring." });
      res.status(500).json({ success: false, message: "To‘lov holatini yangilashda xatolik" });
    }
  });
})();