// GULI Click SHOP API integration.
// This patch is injected before the legacy /api/orders route by customerServer.js.
// No card number/CVV is ever stored by GULI; Click hosts the payment form.

(() => {
  const CLICK_SERVICE_ID = String(process.env.CLICK_SERVICE_ID || "").trim();
  const CLICK_MERCHANT_ID = String(process.env.CLICK_MERCHANT_ID || "").trim();
  const CLICK_SECRET_KEY = String(process.env.CLICK_SECRET_KEY || "").trim();
  const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://en-inky-10.vercel.app").replace(/\/$/, "");
  const CLICK_RETURN_URL = String(process.env.CLICK_RETURN_URL || `${FRONTEND_URL}/?payment=click`).trim();
  const CLICK_READY = Boolean(CLICK_SERVICE_ID && CLICK_MERCHANT_ID && CLICK_SECRET_KEY);

  const CLICK_ERRORS = Object.freeze({
    SUCCESS: 0,
    SIGN_CHECK_FAILED: -1,
    INCORRECT_AMOUNT: -2,
    ACTION_NOT_FOUND: -3,
    ALREADY_PAID: -4,
    ORDER_NOT_FOUND: -5,
    TRANSACTION_NOT_FOUND: -6,
    FAILED_TO_UPDATE: -7,
    ERROR_IN_REQUEST: -8,
    TRANSACTION_CANCELLED: -9
  });

  const fail = (code, note, extra = {}) => ({ ...extra, error: code, error_note: note });
  const asNumber = (value, fallback = 0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
  const sixDigitOrderNumber = () => `GULI-${Math.floor(100000 + Math.random() * 900000)}`;
  const prepareIdFor = (merchantTransId) => {
    const digest = crypto.createHash("sha256").update(String(merchantTransId)).digest();
    const id = digest.readUInt32BE(0) & 0x7fffffff;
    return id || 1;
  };
  const verifySign = (params, complete = false) => {
    const base = complete
      ? `${params.click_trans_id}${params.service_id}${CLICK_SECRET_KEY}${params.merchant_trans_id}${params.merchant_prepare_id}${params.amount}${params.action}${params.sign_time}`
      : `${params.click_trans_id}${params.service_id}${CLICK_SECRET_KEY}${params.merchant_trans_id}${params.amount}${params.action}${params.sign_time}`;
    const expected = crypto.createHash("md5").update(base).digest("hex");
    return safeEqual(expected, params.sign_string);
  };

  async function normalizeOrder(body, telegramUser, paymentValue) {
    const phone = String(body?.phone || "").trim();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!phone) throw Object.assign(new Error("Telefon raqami kiritilmagan"), { status: 400 });
    if (!items.length || items.length > 100) throw Object.assign(new Error("Buyurtma mahsulotlari noto‘g‘ri"), { status: 400 });

    const ids = [...new Set(items.map(item => item?.product?.id ?? item?.product_id).filter(v => v !== null && v !== undefined && v !== ""))];
    const codes = [...new Set(items.map(item => String(item?.product?.product_code || item?.product_code || "").trim()).filter(v => /^\d{6}$/.test(v)))];
    if (!ids.length && !codes.length) throw Object.assign(new Error("Mahsulot kodi yoki identifikatori topilmadi"), { status: 400 });

    const [byId, byCode] = await Promise.all([
      ids.length ? supabase.from("products").select("id,product_code,name,title,price,old_price,stock,active").in("id", ids) : Promise.resolve({ data: [], error: null }),
      codes.length ? supabase.from("products").select("id,product_code,name,title,price,old_price,stock,active").in("product_code", codes) : Promise.resolve({ data: [], error: null })
    ]);
    if (byId.error) throw byId.error;
    if (byCode.error) throw byCode.error;

    const products = new Map();
    [...(byId.data || []), ...(byCode.data || [])].forEach(p => {
      products.set(String(p.id), p);
      if (p.product_code) products.set(`code:${p.product_code}`, p);
    });

    let subtotal = 0;
    const normalizedItems = items.map(item => {
      const id = item?.product?.id ?? item?.product_id;
      const code = String(item?.product?.product_code || item?.product_code || "").trim();
      const product = (id != null ? products.get(String(id)) : null) || (code ? products.get(`code:${code}`) : null);
      if (!product) throw Object.assign(new Error(`Mahsulot topilmadi: ${code || id || "noma’lum"}`), { status: 400 });
      if (product.active === false) throw Object.assign(new Error(`${product.name || product.title || "Mahsulot"} hozir sotuvda emas`), { status: 409 });
      const quantity = Math.floor(asNumber(item?.quantity ?? item?.qty, 1));
      if (quantity < 1 || quantity > 99) throw Object.assign(new Error("Mahsulot miqdori noto‘g‘ri"), { status: 400 });
      if (Number(product.stock || 0) < quantity) throw Object.assign(new Error(`${product.name || product.title || "Mahsulot"} uchun omborda yetarli qoldiq yo‘q`), { status: 409 });
      const unitPrice = Math.max(0, Math.round(asNumber(product.price)));
      subtotal += unitPrice * quantity;
      return {
        ...item,
        quantity,
        product_id: product.id,
        product_code: product.product_code || code || null,
        product: { ...(item.product || {}), id: product.id, product_code: product.product_code || code || null, name: product.name || product.title || item.product?.name || "Mahsulot", price: unitPrice, old_price: product.old_price ?? null, stock: product.stock }
      };
    });

    const promoCode = String(body?.promo_code || "").trim().toUpperCase();
    let discount = 0;
    let promoMeta = null;
    if (promoCode) {
      const { data, error } = await supabase.from("promo_codes").select("code,discount_type,discount_value,min_order_amount,usage_limit,used_count,starts_at,expires_at,active").eq("code", promoCode).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Promo kod topilmadi yoki faol emas"), { status: 400 });
      const now = Date.now();
      if (data.starts_at && new Date(data.starts_at).getTime() > now) throw Object.assign(new Error("Promo kod hali kuchga kirmagan"), { status: 400 });
      if (data.expires_at && new Date(data.expires_at).getTime() < now) throw Object.assign(new Error("Promo kod muddati tugagan"), { status: 400 });
      if (data.usage_limit != null && Number(data.used_count || 0) >= Number(data.usage_limit)) throw Object.assign(new Error("Promo koddan foydalanish limiti tugagan"), { status: 400 });
      if (subtotal < Number(data.min_order_amount || 0)) throw Object.assign(new Error(`Minimal buyurtma ${Number(data.min_order_amount || 0).toLocaleString("uz-UZ")} so‘m`), { status: 400 });
      discount = data.discount_type === "percent" ? Math.min(subtotal, Math.round(subtotal * Number(data.discount_value || 0) / 100)) : Math.min(subtotal, Math.max(0, Math.round(Number(data.discount_value || 0))));
      promoMeta = data;
    }

    const delivery = subtotal >= 300000 ? 0 : 20000;
    const total = Math.max(0, subtotal + delivery - discount);
    const orderNumber = sixDigitOrderNumber();
    const order = {
      order_number: orderNumber,
      telegram_id: telegramUser.id,
      username: telegramUser.username || null,
      first_name: telegramUser.first_name || null,
      phone,
      items: normalizedItems,
      subtotal,
      delivery,
      discount,
      total,
      address: body?.address || null,
      payment: paymentValue,
      status: "Qabul qilindi",
      promo_code: promoMeta?.code || null,
      promo_discount_type: promoMeta?.discount_type || null,
      promo_discount_value: promoMeta ? Number(promoMeta.discount_value) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return { order, normalizedItems, total };
  }

  async function insertOrder(order) {
    const { data, error } = await supabase.from("orders").insert([order]).select("*").single();
    if (error) throw error;
    return data;
  }

  async function findOrder(merchantTransId) {
    const { data, error } = await supabase.from("orders").select("*").eq("order_number", String(merchantTransId)).maybeSingle();
    if (error) throw error;
    return data;
  }

  if (!CLICK_READY) {
    console.warn("Click integration disabled: CLICK_SERVICE_ID, CLICK_MERCHANT_ID va CLICK_SECRET_KEY sozlanmagan.");
  }

  // Direct order route fixes the current UUID=BIGINT RPC mismatch and keeps all
  // totals server-calculated. The original route remains below as a legacy fallback.
  app.post("/api/orders", requireTelegramUser, async (req, res) => {
    try {
      const payment = String(req.body?.payment || "cash");
      const prepared = await normalizeOrder(req.body, req.telegramUser, payment);
      const data = await insertOrder(prepared.order);
      res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data });
    } catch (error) {
      console.error("Direct secure order error:", error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || "Buyurtmani saqlashda xatolik" });
    }
  });

  app.post("/api/payments/click/create", requireTelegramUser, async (req, res) => {
    try {
      if (!CLICK_READY) return res.status(503).json({ success: false, message: "Click integratsiyasi hali sozlanmagan. Merchant ma’lumotlari kerak." });
      const prepared = await normalizeOrder(req.body, req.telegramUser, "click_pending");
      const order = await insertOrder(prepared.order);
      const url = new URL("https://my.click.uz/services/pay");
      url.searchParams.set("service_id", CLICK_SERVICE_ID);
      url.searchParams.set("merchant_id", CLICK_MERCHANT_ID);
      url.searchParams.set("amount", String(Math.round(prepared.total)));
      url.searchParams.set("transaction_param", String(order.order_number));
      url.searchParams.set("return_url", CLICK_RETURN_URL);
      res.status(201).json({ success: true, data: { order_number: order.order_number, amount: prepared.total, payment_url: url.toString() } });
    } catch (error) {
      console.error("Click payment create error:", error);
      res.status(error.status || 500).json({ success: false, message: error.message || "Click to‘lovini boshlashda xatolik" });
    }
  });

  const clickCallback = async (req, res) => {
    const p = req.body || {};
    const clickTransId = String(p.click_trans_id || "");
    const serviceId = String(p.service_id || "");
    const merchantTransId = String(p.merchant_trans_id || "");
    const amountRaw = String(p.amount || "");
    const action = Number(p.action);
    if (!clickTransId || !serviceId || !merchantTransId || !amountRaw || !String(p.sign_time || "") || !String(p.sign_string || "")) {
      return res.json(fail(CLICK_ERRORS.ERROR_IN_REQUEST, "Error in request from click"));
    }
    if (!CLICK_READY || serviceId !== CLICK_SERVICE_ID) return res.json(fail(CLICK_ERRORS.SIGN_CHECK_FAILED, "SIGN CHECK FAILED"));
    const complete = action === 1;
    if (action !== 0 && action !== 1) return res.json(fail(CLICK_ERRORS.ACTION_NOT_FOUND, "Action not found", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));
    if (!verifySign(p, complete)) return res.json(fail(CLICK_ERRORS.SIGN_CHECK_FAILED, "SIGN CHECK FAILED", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));

    try {
      const order = await findOrder(merchantTransId);
      if (!order) return res.json(fail(CLICK_ERRORS.ORDER_NOT_FOUND, "User does not exist", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));
      const expectedAmount = Math.round(Number(order.total || 0));
      const clickAmount = Math.round(Number(amountRaw));
      if (!Number.isFinite(clickAmount) || clickAmount !== expectedAmount) return res.json(fail(CLICK_ERRORS.INCORRECT_AMOUNT, "Incorrect parameter amount", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));

      const prepareId = prepareIdFor(merchantTransId);
      if (!complete) {
        if (String(order.payment) === "click_paid") return res.json(fail(CLICK_ERRORS.ALREADY_PAID, "Already paid", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_prepare_id: prepareId }));
        if (!String(order.payment).startsWith("click_")) return res.json(fail(CLICK_ERRORS.TRANSACTION_CANCELLED, "Transaction cancelled", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_prepare_id: prepareId }));
        return res.json({ click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_prepare_id: prepareId, error: 0, error_note: "Success" });
      }

      const suppliedPrepareId = Number(p.merchant_prepare_id);
      if (!Number.isInteger(suppliedPrepareId) || suppliedPrepareId !== prepareId) return res.json(fail(CLICK_ERRORS.TRANSACTION_NOT_FOUND, "Transaction does not exist", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));
      if (String(order.payment) === "click_paid") return res.json(fail(CLICK_ERRORS.ALREADY_PAID, "Already paid", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_confirm_id: prepareId }));
      if (Number(p.error) < 0) {
        await supabase.from("orders").update({ payment: "click_failed", updated_at: new Date().toISOString() }).eq("order_number", merchantTransId);
        return res.json(fail(CLICK_ERRORS.TRANSACTION_CANCELLED, "Transaction cancelled", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_confirm_id: prepareId }));
      }
      const { error: updateError } = await supabase.from("orders").update({ payment: "click_paid", updated_at: new Date().toISOString() }).eq("order_number", merchantTransId);
      if (updateError) throw updateError;
      return res.json({ click_trans_id: clickTransId, merchant_trans_id: merchantTransId, merchant_confirm_id: prepareId, error: 0, error_note: "Success" });
    } catch (error) {
      console.error("Click callback error:", error);
      return res.json(fail(CLICK_ERRORS.FAILED_TO_UPDATE, "Failed to update user", { click_trans_id: clickTransId, merchant_trans_id: merchantTransId }));
    }
  };

  // Click sends application/x-www-form-urlencoded. customerServer injects
  // express.urlencoded() before this route, while JSON remains supported.
  app.post("/api/payments/click/prepare", clickCallback);
  app.post("/api/payments/click/complete", clickCallback);
  app.post("/api/payments/click", clickCallback);

  app.get("/api/payments/click/status/:orderNumber", requireTelegramUser, async (req, res) => {
    try {
      const order = await findOrder(req.params.orderNumber);
      if (!order || Number(order.telegram_id) !== Number(req.telegramUser.id)) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });
      res.json({ success: true, data: { order_number: order.order_number, payment: order.payment, status: order.status, total: Number(order.total || 0) } });
    } catch (error) { res.status(500).json({ success: false, message: "To‘lov holatini olishda xatolik" }); }
  });
})();
