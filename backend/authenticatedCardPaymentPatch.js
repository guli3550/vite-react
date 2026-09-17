// Authenticated browser card checkout bridge.
// Canonical browser identity is GULI JWT -> public.users.id.
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const { verifyAccessToken } = require("./guliCustomAuth.js");
const { install } = require("./routeRegistry.js");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const BUCKET = "payment-receipts";
const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;
const fail = (res, code, message) => res.status(code).json({ success: false, message });
async function customer(req) {
  if (!supabase) return null;
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  let claims = null;
  try { claims = verifyAccessToken(token); } catch { return null; }
  if (!claims?.sub) return null;
  const { data } = await supabase.from("users").select("id,phone_number,telegram_id,full_name").eq("id", String(claims.sub)).maybeSingle();
  return data ? { id: data.id, phone: data.phone_number, telegram_id: data.telegram_id, user_metadata: { full_name: data.full_name } } : null;
}
function decodeReceipt(data, mimeType) {
  const raw = String(data || "");
  if (!raw || raw.length > 8500000 || raw.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new Error("Chek fayli noto‘g‘ri kodlangan");
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > MAX_RECEIPT_BYTES) throw new Error("Chek hajmi 6 MB dan oshmasligi kerak");
  const h = buffer.subarray(0, 12);
  const valid = (mimeType === "image/jpeg" && h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) || (mimeType === "image/png" && h.toString("hex", 0, 8) === "89504e470d0a1a0a") || (mimeType === "image/webp" && h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WEBP") || (mimeType === "application/pdf" && h.toString("ascii", 0, 5) === "%PDF-");
  if (!valid) throw new Error("Chek fayli e’lon qilingan formatga mos emas");
  return buffer;
}
function ext(mimeType) { return mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; }
async function ensureBucket() {
  if (!supabase) throw new Error("Supabase sozlanmagan");
  const existing = await supabase.storage.getBucket(BUCKET);
  if (!existing.error) return;
  const created = await supabase.storage.createBucket(BUCKET, { public: false, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"], fileSizeLimit: `${MAX_RECEIPT_BYTES}B` });
  if (created.error && !/already exists|duplicate/i.test(created.error.message || "")) throw created.error;
}
// /api/auth/orders is canonically handled with unified security in orderCreationIntegrityPatch.js

install("post", "/api/auth/orders/:orderNumber/receipt", async (req, res) => {
  const user = await customer(req);
  if (!user) return fail(res, 401, "Mijoz sessiyasi topilmadi. Telegram orqali qayta kiring.");
  try {
    if (!supabase) return fail(res, 503, "Supabase serverda sozlanmagan.");
    const orderNumber = String(req.params.orderNumber || "").trim();
    const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,total,auth_user_id,payment,payment_status").eq("order_number", orderNumber).eq("auth_user_id", user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return fail(res, 404, "Buyurtma topilmadi");
    if (String(order.payment || "") !== "card_manual") return fail(res, 400, "Bu buyurtma karta orqali to‘lov uchun yaratilmagan");
    const { data, mimeType } = req.body || {};
    if (!data || typeof data !== "string") return fail(res, 400, "Chek rasmi topilmadi");
    if (!/^image\/(jpeg|png|webp)$/.test(String(mimeType || "")) && mimeType !== "application/pdf") return fail(res, 400, "Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin");
    const buffer = decodeReceipt(data, mimeType);
    await ensureBucket();
    const path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext(mimeType)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { data: updated, error: updateError } = await supabase.from("orders").update({ payment_receipt_path: path, payment_status: "receipt_uploaded", payment_receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).eq("auth_user_id", user.id).select("id,order_number,total,payment_status,payment_receipt_path").single();
    if (updateError) throw updateError;
    return res.json({ success: true, message: "Chek muvaffaqiyatli yuborildi. Admin tekshiradi.", data: updated });
  } catch (error) { console.error("Authenticated receipt upload error:", error); const schema = /payment_receipt_path|payment_status|payment_receipt_uploaded_at/i.test(error.message || ""); const bad = /Chek fayli|Chek hajmi/i.test(error.message || ""); return fail(res, schema ? 503 : bad ? 400 : 500, schema ? "To‘lov chek ustunlari bazada hali tayyor emas." : bad ? error.message : "Chekni yuborishda xatolik"); }
});
install("get", "/api/auth/payment/card-info", async (req, res) => {
  const user = await customer(req);
  if (!user) return fail(res, 401, "Mijoz sessiyasi topilmadi. Telegram orqali qayta kiring.");
  const cardNumber = String(process.env.CARD_PAYMENT_NUMBER || "").replace(/\D/g, "");
  const holder = String(process.env.CARD_PAYMENT_NAME || "").trim();
  if (!/^\d{16}$/.test(cardNumber) || !holder) return fail(res, 503, "Karta to‘lovi rekvizitlari backend environment'da sozlanmagan.");
  const holderInitials = holder.split(/\s+/).filter(Boolean).map((part) => part.slice(0, 2).toUpperCase()).join(" ");
  return res.json({ success: true, data: { card_number: cardNumber, holder_initials: holderInitials } });
});
console.log("[GULI Payment] Authenticated browser card checkout routes registered with canonical auth_user_id.");
