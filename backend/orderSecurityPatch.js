const { createClient } = require("@supabase/supabase-js");
const express = require("express");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const originalPost = express.application.post;
let installed = false;

function qtyOf(item) {
  const raw = item?.quantity ?? item?.qty ?? 1;
  const quantity = Number(raw);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99 ? quantity : 0;
}

function itemProductId(item) {
  return item?.product?.id ?? item?.product_id ?? null;
}

async function calculateOrder(body) {
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 100) {
    throw Object.assign(new Error("Buyurtma mahsulotlari noto‘g‘ri"), { status: 400 });
  }
  const ids = [...new Set(body.items.map(itemProductId).filter((id) => id !== null && id !== undefined && id !== ""))];
  const codes = [...new Set(body.items.map((item) => String(item?.product?.product_code || item?.product_code || "").trim()).filter((code) => /^\d{6}$/.test(code)))];
  if (!ids.length && !codes.length) throw Object.assign(new Error("Mahsulot identifikatori topilmadi"), { status: 400 });
  const [byId, byCode] = await Promise.all([
    ids.length ? supabase.from("products").select("id,product_code,name,title,price,old_price,stock,active").in("id", ids) : Promise.resolve({ data: [], error: null }),
    codes.length ? supabase.from("products").select("id,product_code,name,title,price,old_price,stock,active").in("product_code", codes) : Promise.resolve({ data: [], error: null })
  ]);
  if (byId.error) throw byId.error;
  if (byCode.error) throw byCode.error;
  const products = new Map();
  [...(byId.data || []), ...(byCode.data || [])].forEach((product) => {
    products.set(String(product.id), product);
    if (product.product_code) products.set(`code:${product.product_code}`, product);
  });
  let subtotal = 0;
  const normalizedItems = body.items.map((item) => {
    const id = itemProductId(item);
    const code = String(item?.product?.product_code || item?.product_code || "").trim();
    const product = (id != null ? products.get(String(id)) : null) || (code ? products.get(`code:${code}`) : null);
    if (!product) throw Object.assign(new Error(`Mahsulot topilmadi: ${code || id || "noma’lum"}`), { status: 400 });
    if (product.active === false) throw Object.assign(new Error(`${product.name || product.title || "Mahsulot"} hozir sotuvda emas`), { status: 409 });
    const quantity = qtyOf(item);
    if (!quantity) throw Object.assign(new Error("Mahsulot miqdori noto‘g‘ri"), { status: 400 });
    if (Number(product.stock || 0) < quantity) throw Object.assign(new Error(`${product.name || product.title || "Mahsulot"} uchun omborda yetarli qoldiq yo‘q`), { status: 409 });
    const unitPrice = Math.max(0, Number(product.price) || 0);
    subtotal += unitPrice * quantity;
    return { ...item, quantity, product_id: product.id, product_code: product.product_code || code || null, product: { ...(item.product || {}), id: product.id, product_code: product.product_code || code || null, name: product.name || product.title || item.product?.name || "Mahsulot", price: unitPrice, old_price: product.old_price ?? item.product?.old_price ?? null, stock: product.stock } };
  });
  const promoCode = String(body?.promo_code || "").trim().toUpperCase();
  let discount = 0;
  let promo = null;
  if (promoCode) {
    const { data, error } = await supabase.from("promo_codes").select("code,discount_type,discount_value,min_order_amount,usage_limit,used_count,starts_at,expires_at,active").eq("code", promoCode).maybeSingle();
    if (error) throw error;
    if (!data || data.active === false) throw Object.assign(new Error("Promo kod topilmadi yoki faol emas"), { status: 400 });
    const now = Date.now();
    if (data.starts_at && new Date(data.starts_at).getTime() > now) throw Object.assign(new Error("Promo kod hali kuchga kirmagan"), { status: 400 });
    if (data.expires_at && new Date(data.expires_at).getTime() < now) throw Object.assign(new Error("Promo kod muddati tugagan"), { status: 400 });
    if (data.usage_limit != null && Number(data.used_count || 0) >= Number(data.usage_limit)) throw Object.assign(new Error("Promo koddan foydalanish limiti tugagan"), { status: 400 });
    if (subtotal < Number(data.min_order_amount || 0)) throw Object.assign(new Error(`Minimal buyurtma ${Number(data.min_order_amount || 0).toLocaleString("uz-UZ")} so‘m`), { status: 400 });
    discount = data.discount_type === "percent" ? Math.min(subtotal, Math.round(subtotal * Number(data.discount_value || 0) / 100)) : Math.min(subtotal, Math.max(0, Number(data.discount_value || 0)));
    promo = data;
  }
  const delivery = Math.max(0, Number(body?.delivery) || 0);
  const total = Math.max(0, subtotal + delivery - discount);
  return { subtotal, delivery, discount, total, normalizedItems, promo };
}

async function tryAtomicOrder(req, res) {
  const { data, error } = await supabase.rpc("create_secure_order", { p_order: req.body || {}, p_telegram_id: req.telegramUser.id });
  if (!error) return res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data });
  if (!/function .*create_secure_order.*does not exist|schema cache/i.test(error.message || "")) {
    console.error("Secure order RPC error:", error);
    return res.status(400).json({ success: false, message: error.message || "Buyurtmani saqlashda xatolik" });
  }
  return null;
}

if (!installed) {
  installed = true;
  express.application.post = function patchedPost(path, ...handlers) {
    if (path === "/api/orders" && handlers.length) {
      const original = handlers[handlers.length - 1];
      handlers[handlers.length - 1] = async function patchedOrder(req, res, next) {
        try {
          if (req.telegramUser?.id) {
            const atomic = await tryAtomicOrder(req, res);
            if (atomic) return atomic;
          }
          const calculated = await calculateOrder(req.body || {});
          req.body = { ...req.body, items: calculated.normalizedItems, subtotal: calculated.subtotal, delivery: calculated.delivery, discount: calculated.discount, total: calculated.total, promo_code: calculated.promo?.code || null };
          return original.call(this, req, res, next);
        } catch (error) {
          console.error("Server-side order validation error:", error);
          return res.status(error.status || 500).json({ success: false, message: error.message || "Buyurtmani tekshirishda xatolik" });
        }
      };
    }
    return originalPost.call(this, path, ...handlers);
  };
}

module.exports = { calculateOrder };
