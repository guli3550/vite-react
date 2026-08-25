const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { listProducts, getProduct } = require("./catalog");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "4mb" }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const ADMIN_TOKEN_TTL = 8 * 60 * 60 * 1000;
const TELEGRAM_INITDATA_TTL = 24 * 60 * 60;
const ADMIN_STATUSES = ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi", "Bekor qilindi"];

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || "Telegram API xatosi");
  return result.result;
}

async function setupTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN) return console.warn("TELEGRAM_BOT_TOKEN topilmadi; webhook o'rnatilmadi.");
  try { const webhookUrl = `${BASE_URL}/api/telegram/webhook`; await telegramApi("setWebhook", { url: webhookUrl }); console.log(`Telegram webhook set: ${webhookUrl}`); }
  catch (error) { console.error("Telegram webhook o'rnatilmadi:", error.message); }
}

function safeEqual(a, b) { const left = Buffer.from(String(a)); const right = Buffer.from(String(b)); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function signAdminToken(payload) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url"); return `${body}.${signature}`; }
function verifyAdminToken(token) { try { if (!ADMIN_SECRET || !token) return false; const [body, signature] = String(token).split("."); if (!body || !signature) return false; const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url"); if (!safeEqual(signature, expected)) return false; const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return payload.role === "admin" && Number(payload.exp) > Date.now(); } catch { return false; } }
function requireAdmin(req, res, next) { const header = req.headers.authorization || ""; const token = header.startsWith("Bearer ") ? header.slice(7) : ""; if (!verifyAdminToken(token)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" }); next(); }

function verifyTelegramInitData(initData) {
  if (!TELEGRAM_BOT_TOKEN || !initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    const authDate = Number(params.get("auth_date"));
    if (!hash || !Number.isFinite(authDate)) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > TELEGRAM_INITDATA_TTL) return null;
    const pairs = [];
    params.forEach((value, key) => { if (key !== "hash") pairs.push(`${key}=${value}`); });
    pairs.sort();
    const dataCheckString = pairs.join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (!safeEqual(calculatedHash, hash)) return null;
    const rawUser = params.get("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (!user?.id) return null;
    return { id: Number(user.id), username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null };
  } catch { return null; }
}
function requireTelegramUser(req, res, next) {
  const initData = req.headers["x-telegram-init-data"] || "";
  const user = verifyTelegramInitData(initData);
  if (!user) return res.status(401).json({ success: false, message: "Telegram sessiyasi tasdiqlanmadi. Mini App'ni Telegram ichidan oching." });
  req.telegramUser = user;
  next();
}
function productPayload(body) {
  const name = String(body.name || body.title || "").trim();
  return {
    title: String(body.title || name).trim(), name, category: String(body.category || "Boshqa").trim(), description: String(body.description || ""),
    price: Number(body.price) || 0, old_price: body.old_price == null || body.old_price === "" ? null : Number(body.old_price), image: String(body.image || ""),
    images: Array.isArray(body.images) ? body.images : [], sizes: Array.isArray(body.sizes) ? body.sizes : [], colors: Array.isArray(body.colors) ? body.colors : [],
    rating: Number(body.rating) || 0, reviews: Number(body.reviews) || 0, stock: Math.max(0, Number(body.stock) || 0), featured: Boolean(body.featured), active: body.active !== false,
    sort_order: Number(body.sort_order) || 0, product_code: /^\d{6}$/.test(String(body.product_code || "")) ? String(body.product_code) : "", updated_at: new Date().toISOString()
  };
}
async function generateSixDigitCode(table, column, prefix = "") {
  for (let i = 0; i < 40; i++) { const code = String(Math.floor(100000 + Math.random() * 900000)); const { data, error } = await supabase.from(table).select(column).eq(column, prefix + code).maybeSingle(); if (error && !/column|schema cache/i.test(error.message || "")) throw error; if (!data) return prefix + code; }
  throw new Error("6 xonali kod yaratilmadi");
}
async function ensureProductCode(payload) { if (/^\d{6}$/.test(String(payload.product_code || ""))) return payload.product_code; return generateSixDigitCode("products", "product_code"); }

app.get("/", (req, res) => res.json({ success: true, message: "GULI Premium API ishlayapti 🌷" }));
app.get("/api/health", (req, res) => res.json({ success: true, status: "online" }));
app.get("/api/products", async (req, res) => { try { const data = await listProducts({ category: req.query.category, search: req.query.search, featured: req.query.featured === undefined ? undefined : req.query.featured === "true", limit: req.query.limit }); res.json({ success: true, data }); } catch (error) { console.error("Products API error:", error); res.status(500).json({ success: false, message: "Mahsulotlarni yuklashda xatolik" }); } });
app.get("/api/orders", requireTelegramUser, async (req, res) => { try { const { data, error } = await supabase.from("orders").select("*").eq("telegram_id", req.telegramUser.id).order("created_at", { ascending: false }).limit(100); if (error) throw error; res.json({ success: true, data: data || [] }); } catch (error) { console.error("Orders API error:", error); res.status(500).json({ success: false, message: "Buyurtmalarni yuklashda xatolik" }); } });
app.get("/api/telegram-user", requireTelegramUser, async (req, res) => { try { const { data, error } = await supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone").eq("telegram_id", req.telegramUser.id).maybeSingle(); if (error) throw error; res.json({ success: true, data: data || null }); } catch (error) { console.error("Telegram user API error:", error); res.status(500).json({ success: false, message: "Telegram foydalanuvchisini olishda xatolik" }); } });
app.get("/api/reverse-geocode", async (req, res) => { try { const lat = Number(req.query.lat); const lon = Number(req.query.lon); if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ success: false, message: "Koordinatalar noto'g'ri" }); const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`, { headers: { "User-Agent": "GULI-Premium-Telegram-Mini-App/2.0" } }); if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`); const result = await response.json(); const a = result.address || {}; res.json({ success: true, data: { region: a.state || a.region || a.province || "", district: a.city_district || a.district || a.county || a.city || "", street: a.road || a.pedestrian || a.street || "", display_name: result.display_name || "" } }); } catch (error) { console.error("Reverse geocode error:", error); res.status(502).json({ success: false, message: "Manzilni avtomatik aniqlab bo'lmadi" }); } });
app.get("/api/products/:id", async (req, res) => { try { const data = await getProduct(req.params.id); if (!data) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" }); res.json({ success: true, data }); } catch (error) { console.error("Product detail API error:", error); res.status(500).json({ success: false, message: "Mahsulotni yuklashda xatolik" }); } });
app.post("/api/telegram/webhook", async (req, res) => { try { const contact = req.body?.message?.contact; if (contact?.user_id && contact?.phone_number) { const telegramUser = req.body.message.from || {}; const { error } = await supabase.from("telegram_users").upsert({ telegram_id: contact.user_id, username: telegramUser.username || null, first_name: telegramUser.first_name || null, last_name: telegramUser.last_name || null, telegram_phone: contact.phone_number, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" }); if (error) console.error("Telegram kontaktini saqlash xatosi:", error); } res.sendStatus(200); } catch (error) { console.error("Telegram webhook xatosi:", error); res.sendStatus(200); } });
app.post("/api/save-address", requireTelegramUser, async (req, res) => { try { const { username, phone, latitude, longitude, region, district, street, house, apartment, landmark } = req.body; if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ success: false, message: "Lokatsiya koordinatalari topilmadi" }); const row = { telegram_id: req.telegramUser.id, username: username || req.telegramUser.username || null, phone: phone || null, latitude: Number(latitude), longitude: Number(longitude), region: region || null, district: district || null, street: street || null, house: house || null, apartment: apartment || null, landmark: landmark || null }; const { data, error } = await supabase.from("saved_addresses").insert([row]).select().single(); if (error) throw error; res.json({ success: true, message: "Manzil muvaffaqiyatli saqlandi", data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Manzilni saqlashda xatolik" }); } });
app.post("/api/orders", requireTelegramUser, async (req, res) => { try { const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body; const sixDigitOrderNumber = /^GULI-\d{6}$/.test(String(order_number || "")) ? String(order_number) : `GULI-${await generateSixDigitCode("orders", "order_number")}`; if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "Buyurtma mahsulotlari topilmadi" }); const normalizedItems = await Promise.all(items.map(async (item) => { const raw = item?.product || {}; let code = raw.product_code || item?.product_code || ""; if (!/^\d{6}$/.test(String(code)) && raw.id) { const found = await supabase.from("products").select("product_code").eq("id", raw.id).maybeSingle(); code = found.data?.product_code || ""; } const copy = { ...item, product_code: code || null }; if (copy.product) copy.product = { ...copy.product, product_code: code || null, name: code ? `${copy.product.name || "Mahsulot"} • GULI-${code}` : copy.product.name }; return copy; })); if (!phone?.trim()) return res.status(400).json({ success: false, message: "Telefon raqami kiritilmagan" }); let telegram_phone = null; const { data: userRow } = await supabase.from("telegram_users").select("telegram_phone").eq("telegram_id", req.telegramUser.id).maybeSingle(); telegram_phone = userRow?.telegram_phone || null; const order = { order_number: sixDigitOrderNumber, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, telegram_phone, phone: phone.trim(), items: normalizedItems, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", status: status || "Qabul qilindi", created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() }; const { data, error } = await supabase.from("orders").insert([order]).select().single(); if (error) { if (error.code === "23505" && order_number) { const existing = await supabase.from("orders").select("*").eq("order_number", order_number).eq("telegram_id", req.telegramUser.id).maybeSingle(); if (existing.data) return res.status(200).json({ success: true, message: "Buyurtma allaqachon saqlangan", data: existing.data, duplicate: true }); } console.error(error); return res.status(500).json({ success: false, message: "Buyurtmani saqlashda xatolik", error: error.message }); } res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Server xatosi" }); } });

app.post("/api/promo/validate", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const subtotal = Number(req.body?.subtotal) || 0;
    if (!code) return res.status(400).json({ success: false, message: "Promo kodini kiriting" });
    const { data, error } = await supabase.from("promo_codes").select("code,discount_type,discount_value,min_order_amount,usage_limit,used_count,starts_at,expires_at,active").eq("code", code).eq("active", true).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Promo kod topilmadi yoki faol emas" });
    const now = Date.now();
    if (data.starts_at && new Date(data.starts_at).getTime() > now) return res.status(400).json({ success: false, message: "Promo kod hali kuchga kirmagan" });
    if (data.expires_at && new Date(data.expires_at).getTime() < now) return res.status(400).json({ success: false, message: "Promo kod muddati tugagan" });
    if (data.usage_limit != null && Number(data.used_count || 0) >= Number(data.usage_limit)) return res.status(400).json({ success: false, message: "Promo koddan foydalanish limiti tugagan" });
    if (subtotal < Number(data.min_order_amount || 0)) return res.status(400).json({ success: false, message: `Minimal buyurtma ${Number(data.min_order_amount || 0).toLocaleString("uz-UZ")} so‘m` });
    const discount = data.discount_type === "percent" ? Math.round(subtotal * Number(data.discount_value) / 100) : Math.min(subtotal, Number(data.discount_value));
    res.json({ success: true, data: { code: data.code, discount, discount_type: data.discount_type, discount_value: Number(data.discount_value) } });
  } catch (error) { console.error("Promo validation error:", error); res.status(500).json({ success: false, message: "Promo kodni tekshirishda xatolik" }); }
});

app.post("/api/admin/upload-image", requireAdmin, async (req, res) => { try { const { data, mimeType, extension } = req.body || {}; if (!data || typeof data !== "string") return res.status(400).json({ success: false, message: "Rasm ma'lumoti topilmadi" }); if (!String(mimeType || "").startsWith("image/")) return res.status(400).json({ success: false, message: "Faqat rasm fayli yuklash mumkin" }); if (data.length > 3200000) return res.status(413).json({ success: false, message: "Rasm hajmi juda katta" }); const bucket = "product-images"; const existing = await supabase.storage.getBucket(bucket); if (existing.error) { const created = await supabase.storage.createBucket(bucket, { public: true, allowedMimeTypes: ["image/*"], fileSizeLimit: "3MB" }); if (created.error && !/already exists|duplicate/i.test(created.error.message || "")) throw created.error; } const cleanExt = String(extension || "webp").replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp"; const path = `products/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${cleanExt}`; const buffer = Buffer.from(data, "base64"); const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: mimeType, cacheControl: "31536000", upsert: false }); if (error) throw error; const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path); res.json({ success: true, data: { path, url: publicData.publicUrl } }); } catch (error) { console.error("Admin image upload error:", error); res.status(500).json({ success: false, message: "Rasmni yuklashda xatolik" }); } });
app.post("/api/admin/login", (req, res) => { if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_SECRET) return res.status(503).json({ success: false, message: "Admin environment sozlanmagan: ADMIN_USERNAME, ADMIN_PASSWORD va ADMIN_SECRET kerak" }); const username = String(req.body?.username || ""); const password = String(req.body?.password || ""); if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) return res.status(401).json({ success: false, message: "Login yoki parol noto‘g‘ri" }); const token = signAdminToken({ role: "admin", sub: username, iat: Date.now(), exp: Date.now() + ADMIN_TOKEN_TTL }); res.json({ success: true, token, expiresIn: ADMIN_TOKEN_TTL }); });
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => { try { const [{ count: productsCount }, { count: ordersCount }, { count: usersCount }, revenueResult, todayResult, statusResult, lowStockResult, recentResult] = await Promise.all([supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),supabase.from("orders").select("id", { count: "exact", head: true }),supabase.from("telegram_users").select("telegram_id", { count: "exact", head: true }),supabase.from("orders").select("total"),supabase.from("orders").select("total").gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString()),supabase.from("orders").select("status"),supabase.from("products").select("id,name,stock").eq("active", true).lt("stock", 5).order("stock", { ascending: true }).limit(10),supabase.from("orders").select("id,order_number,first_name,username,total,status,created_at").order("created_at", { ascending: false }).limit(8)]); const sum=rows=>(rows||[]).reduce((n,r)=>n+Number(r.total||0),0); const statusCounts=(statusResult.data||[]).reduce((a,r)=>{a[r.status||"Noma’lum"]=(a[r.status||"Noma’lum"]||0)+1;return a},{}); res.json({success:true,data:{productsCount:productsCount||0,ordersCount:ordersCount||0,usersCount:usersCount||0,revenue:sum(revenueResult.data),todayRevenue:sum(todayResult.data),statusCounts,lowStock:lowStockResult.data||[],recentOrders:recentResult.data||[]}}); } catch(error){console.error("Admin dashboard error:",error);res.status(500).json({success:false,message:"Dashboardni yuklashda xatolik"})} });
app.get("/api/admin/products", requireAdmin, async (req,res)=>{try{const {data,error}=await supabase.from("products").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:false}).limit(Math.min(Number(req.query.limit)||200,500));if(error)throw error;res.json({success:true,data:data||[]})}catch(error){res.status(500).json({success:false,message:"Admin mahsulotlarini yuklashda xatolik"})}});
app.post("/api/admin/products",requireAdmin,async(req,res)=>{try{const payload=productPayload(req.body);payload.product_code=await ensureProductCode(payload);if(!payload.name||payload.price<0)return res.status(400).json({success:false,message:"Mahsulot nomi va narxi noto‘g‘ri"});const {data,error}=await supabase.from("products").insert([payload]).select("*").single();if(error)throw error;res.status(201).json({success:true,data})}catch(error){console.error(error);res.status(500).json({success:false,message:"Mahsulot yaratishda xatolik"})}});
app.put("/api/admin/products/:id",requireAdmin,async(req,res)=>{try{const payload=productPayload(req.body);payload.product_code=await ensureProductCode(payload);const {data,error}=await supabase.from("products").update(payload).eq("id",req.params.id).select("*").single();if(error)throw error;res.json({success:true,data})}catch(error){console.error(error);res.status(500).json({success:false,message:"Mahsulotni yangilashda xatolik"})}});
app.delete("/api/admin/products/:id",requireAdmin,async(req,res)=>{try{const {data,error}=await supabase.from("products").update({active:false,updated_at:new Date().toISOString()}).eq("id",req.params.id).select("*").single();if(error)throw error;res.json({success:true,data})}catch(error){res.status(500).json({success:false,message:"Mahsulotni yashirishda xatolik"})}});
app.get("/api/admin/orders",requireAdmin,async(req,res)=>{try{const {data,error}=await supabase.from("orders").select("*").order("created_at",{ascending:false}).limit(Math.min(Number(req.query.limit)||200,500));if(error)throw error;res.json({success:true,data:data||[]})}catch(error){res.status(500).json({success:false,message:"Admin buyurtmalarini yuklashda xatolik"})}});
app.put("/api/admin/orders/:id",requireAdmin,async(req,res)=>{try{const status=ADMIN_STATUSES.includes(String(req.body?.status))?String(req.body.status):"Qabul qilindi";const {data,error}=await supabase.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",req.params.id).select("*").single();if(error)throw error;res.json({success:true,data})}catch(error){res.status(500).json({success:false,message:"Buyurtma statusini yangilashda xatolik"})}});
app.get("/api/admin/users",requireAdmin,async(req,res)=>{try{const {data,error}=await supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,updated_at").order("updated_at",{ascending:false}).limit(Math.min(Number(req.query.limit)||200,500));if(error)throw error;res.json({success:true,data:data||[]})}catch(error){res.status(500).json({success:false,message:"Mijozlarni yuklashda xatolik"})}});

app.get("/api/admin/promos", requireAdmin, async (req,res) => {
  try {
    const { data, error } = await supabase.from("promo_codes").select("*").order("created_at",{ascending:false}).limit(Math.min(Number(req.query.limit)||200,500));
    if(error) throw error;
    res.json({success:true,data:data||[]});
  } catch(error) {
    console.error("Admin promos list error:", error);
    res.status(500).json({success:false,message:"Promo kodlarni yuklashda xatolik",detail:error.message});
  }
});

function promoPayload(body) {
  const code = String(body?.code || "").trim().toUpperCase();
  const discountType = body?.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(body?.discount_value);
  const minOrderAmount = Number(body?.min_order_amount || 0);
  const usageLimit = body?.usage_limit == null || body.usage_limit === "" ? null : Number(body.usage_limit);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw Object.assign(new Error("Promo kodi 3–40 belgidan iborat bo‘lsin: harf, raqam, _ yoki -"),{status:400});
  if (!Number.isFinite(discountValue) || discountValue <= 0) throw Object.assign(new Error("Chegirma qiymati 0 dan katta bo‘lishi kerak"),{status:400});
  if (discountType === "percent" && discountValue > 100) throw Object.assign(new Error("Foizli chegirma 100% dan oshmasin"),{status:400});
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) throw Object.assign(new Error("Minimal buyurtma 0 yoki undan katta bo‘lishi kerak"),{status:400});
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw Object.assign(new Error("Limit kamida 1 bo‘lishi kerak yoki bo‘sh qoldiring"),{status:400});
  return {code,discount_type:discountType,discount_value:discountValue,min_order_amount:minOrderAmount,usage_limit:usageLimit,active:body?.active!==false};
}

app.post("/api/admin/promos", requireAdmin, async (req,res) => {
  try {
    const payload=promoPayload(req.body);
    const {data,error}=await supabase.from("promo_codes").insert([payload]).select("*").single();
    if(error){
      console.error("Promo create DB error:",error);
      if(error.code==="23505") return res.status(409).json({success:false,message:`${payload.code} promo kodi allaqachon mavjud`});
      if(/relation .*promo_codes.*does not exist|schema cache/i.test(error.message||"")) return res.status(503).json({success:false,message:"promo_codes jadvali Supabase'da hali tayyor emas. Repair SQL'ni bir marta ishga tushiring."});
      return res.status(500).json({success:false,message:"Promo kod yaratishda xatolik",detail:error.message});
    }
    res.status(201).json({success:true,data});
  } catch(error) {
    const status=error.status||400; console.error("Promo create error:",error); res.status(status).json({success:false,message:error.message||"Promo kod yaratishda xatolik"});
  }
});

app.put("/api/admin/promos/:id", requireAdmin, async (req,res) => {
  try {
    const payload=promoPayload(req.body);
    const {data,error}=await supabase.from("promo_codes").update(payload).eq("id",req.params.id).select("*").single();
    if(error){
      console.error("Promo update DB error:",error);
      if(error.code==="23505") return res.status(409).json({success:false,message:`${payload.code} promo kodi allaqachon mavjud`});
      return res.status(500).json({success:false,message:"Promo kodni yangilashda xatolik",detail:error.message});
    }
    res.json({success:true,data});
  } catch(error) { const status=error.status||400; res.status(status).json({success:false,message:error.message||"Promo ma’lumotlari noto‘g‘ri"}); }
});
app.delete("/api/admin/promos/:id",requireAdmin,async(req,res)=>{try{const {error}=await supabase.from("promo_codes").delete().eq("id",req.params.id);if(error)throw error;res.json({success:true})}catch(error){res.status(500).json({success:false,message:"Promo kodni o‘chirishda xatolik"})}});

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>{console.log(`GULI API running on port ${PORT}`);setupTelegramWebhook();});
