const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { listProducts, getProduct, toProduct } = require("./catalog");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;
const ADMIN_TOKEN_TTL = 8 * 60 * 60 * 1000;

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
function productPayload(body) { return { name: String(body.name || "").trim(), category: String(body.category || "Boshqa").trim(), description: String(body.description || ""), price: Number(body.price) || 0, old_price: body.old_price == null || body.old_price === "" ? null : Number(body.old_price), image: String(body.image || ""), images: Array.isArray(body.images) ? body.images : [], sizes: Array.isArray(body.sizes) ? body.sizes : [], colors: Array.isArray(body.colors) ? body.colors : [], rating: Number(body.rating) || 0, reviews: Number(body.reviews) || 0, stock: Math.max(0, Number(body.stock) || 0), featured: Boolean(body.featured), active: body.active !== false, sort_order: Number(body.sort_order) || 0, updated_at: new Date().toISOString() }; }

app.get("/", (req, res) => res.json({ success: true, message: "GULI Premium API ishlayapti 🌷" }));
app.get("/api/health", (req, res) => res.json({ success: true, status: "online" }));

app.get("/api/products", async (req, res) => {
  try { const data = await listProducts({ category: req.query.category, search: req.query.search, featured: req.query.featured === undefined ? undefined : req.query.featured === "true", limit: req.query.limit }); res.json({ success: true, data }); }
  catch (error) { console.error("Products API error:", error); res.status(500).json({ success: false, message: "Mahsulotlarni yuklashda xatolik" }); }
});

app.get("/api/orders", async (req, res) => {
  try { const telegramId = req.query.telegram_id; if (!telegramId) return res.status(400).json({ success: false, message: "telegram_id kerak" }); const { data, error } = await supabase.from("orders").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(100); if (error) throw error; res.json({ success: true, data: data || [] }); }
  catch (error) { console.error("Orders API error:", error); res.status(500).json({ success: false, message: "Buyurtmalarni yuklashda xatolik" }); }
});

app.get("/api/telegram-user", async (req, res) => {
  try { const telegramId = req.query.telegram_id; if (!telegramId) return res.status(400).json({ success: false, message: "telegram_id kerak" }); const { data, error } = await supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone").eq("telegram_id", telegramId).maybeSingle(); if (error) throw error; res.json({ success: true, data: data || null }); }
  catch (error) { console.error("Telegram user API error:", error); res.status(500).json({ success: false, message: "Telegram foydalanuvchisini olishda xatolik" }); }
});

app.get("/api/reverse-geocode", async (req, res) => {
  try { const lat = Number(req.query.lat); const lon = Number(req.query.lon); if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ success: false, message: "Koordinatalar noto'g'ri" }); const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`, { headers: { "User-Agent": "GULI-Premium-Telegram-Mini-App/2.0" } }); if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`); const result = await response.json(); const a = result.address || {}; res.json({ success: true, data: { region: a.state || a.region || a.province || "", district: a.city_district || a.district || a.county || a.city || "", street: a.road || a.pedestrian || a.street || "", display_name: result.display_name || "" } }); }
  catch (error) { console.error("Reverse geocode error:", error); res.status(502).json({ success: false, message: "Manzilni avtomatik aniqlab bo'lmadi" }); }
});

app.get("/api/products/:id", async (req, res) => {
  try { const data = await getProduct(req.params.id); if (!data) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" }); res.json({ success: true, data }); }
  catch (error) { console.error("Product detail API error:", error); res.status(500).json({ success: false, message: "Mahsulotni yuklashda xatolik" }); }
});

app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const message = req.body?.message;
    const contact = message?.contact;
    if (contact?.user_id && contact?.phone_number) {
      const telegramUser = message.from || {};
      const { error } = await supabase.from("telegram_users").upsert({ telegram_id: contact.user_id, username: telegramUser.username || null, first_name: telegramUser.first_name || null, last_name: telegramUser.last_name || null, telegram_phone: contact.phone_number, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
      if (error) console.error("Telegram kontaktini saqlash xatosi:", error);
    }
    res.sendStatus(200);
  } catch (error) { console.error("Telegram webhook xatosi:", error); res.sendStatus(200); }
});

app.post("/api/save-address", async (req, res) => {
  try {
    const { telegram_id, username, phone, latitude, longitude, region, district, street, house, apartment, landmark } = req.body;
    if (!telegram_id) return res.status(400).json({ success: false, message: "telegram_id kerak" });
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ success: false, message: "Lokatsiya koordinatalari topilmadi" });
    const row = { telegram_id, username: username || null, phone: phone || null, latitude: Number(latitude), longitude: Number(longitude), region: region || null, district: district || null, street: street || null, house: house || null, apartment: apartment || null, landmark: landmark || null };
    const { data, error } = await supabase.from("saved_addresses").insert([row]).select().single();
    if (error) throw error;
    res.json({ success: true, message: "Manzil muvaffaqiyatli saqlandi", data });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Manzilni saqlashda xatolik" }); }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { order_number, telegram_id, username, first_name, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "Buyurtma mahsulotlari topilmadi" });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Telefon raqami kiritilmagan" });
    let telegram_phone = null;
    if (telegram_id != null) { const { data } = await supabase.from("telegram_users").select("telegram_phone").eq("telegram_id", telegram_id).maybeSingle(); telegram_phone = data?.telegram_phone || null; }
    const order = { order_number: order_number || null, telegram_id: telegram_id || null, username: username || null, first_name: first_name || null, telegram_phone, phone: phone.trim(), items, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", status: status || "Qabul qilindi", created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("orders").insert([order]).select().single();
    if (error) { if (error.code === "23505" && order_number) { const existing = await supabase.from("orders").select("*").eq("order_number", order_number).maybeSingle(); if (existing.data) return res.status(200).json({ success: true, message: "Buyurtma allaqachon saqlangan", data: existing.data, duplicate: true }); } console.error(error); return res.status(500).json({ success: false, message: "Buyurtmani saqlashda xatolik", error: error.message }); }
    res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Server xatosi" }); }
});

// Secure admin authentication and management API. The secret never reaches the browser.
app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_SECRET) return res.status(503).json({ success: false, message: "Admin environment sozlanmagan" });
  const username = String(req.body?.username || ""); const password = String(req.body?.password || "");
  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) return res.status(401).json({ success: false, message: "Login yoki parol noto‘g‘ri" });
  const token = signAdminToken({ role: "admin", sub: username, iat: Date.now(), exp: Date.now() + ADMIN_TOKEN_TTL });
  res.json({ success: true, token, expiresIn: ADMIN_TOKEN_TTL });
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const [{ count: productsCount }, { count: ordersCount }, { count: usersCount }, revenueResult, todayResult, statusResult, lowStockResult, recentResult] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("telegram_users").select("telegram_id", { count: "exact", head: true }),
      supabase.from("orders").select("total"),
      supabase.from("orders").select("total").gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from("orders").select("status"),
      supabase.from("products").select("id,name,stock").eq("active", true).lt("stock", 5).order("stock", { ascending: true }).limit(10),
      supabase.from("orders").select("id,order_number,first_name,username,total,status,created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    const sum = (rows) => (rows || []).reduce((n, r) => n + Number(r.total || 0), 0);
    const statusCounts = (statusResult.data || []).reduce((a, r) => { a[r.status || "Noma’lum"] = (a[r.status || "Noma’lum"] || 0) + 1; return a; }, {});
    res.json({ success: true, data: { productsCount: productsCount || 0, ordersCount: ordersCount || 0, usersCount: usersCount || 0, revenue: sum(revenueResult.data), todayRevenue: sum(todayResult.data), statusCounts, lowStock: lowStockResult.data || [], recentOrders: recentResult.data || [] } });
  } catch (error) { console.error("Admin dashboard error:", error); res.status(500).json({ success: false, message: "Dashboardni yuklashda xatolik" }); }
});

app.get("/api/admin/products", requireAdmin, async (req, res) => { try { const { data, error } = await supabase.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(Math.min(Number(req.query.limit) || 200, 500)); if (error) throw error; res.json({ success: true, data: data || [] }); } catch (error) { res.status(500).json({ success: false, message: "Admin mahsulotlarini yuklashda xatolik" }); } });
app.post("/api/admin/products", requireAdmin, async (req, res) => { try { const payload = productPayload(req.body); if (!payload.name || payload.price < 0) return res.status(400).json({ success: false, message: "Mahsulot nomi va narxi noto‘g‘ri" }); const { data, error } = await supabase.from("products").insert([payload]).select("*").single(); if (error) throw error; res.status(201).json({ success: true, data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Mahsulot yaratishda xatolik" }); } });
app.put("/api/admin/products/:id", requireAdmin, async (req, res) => { try { const payload = productPayload(req.body); const { data, error } = await supabase.from("products").update(payload).eq("id", req.params.id).select("*").single(); if (error) throw error; res.json({ success: true, data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Mahsulotni yangilashda xatolik" }); } });
app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => { try { const { data, error } = await supabase.from("products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("*").single(); if (error) throw error; res.json({ success: true, data }); } catch (error) { res.status(500).json({ success: false, message: "Mahsulotni yashirishda xatolik" }); } });

app.get("/api/admin/orders", requireAdmin, async (req, res) => { try { const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(Math.min(Number(req.query.limit) || 200, 500)); if (error) throw error; res.json({ success: true, data: data || [] }); } catch (error) { res.status(500).json({ success: false, message: "Admin buyurtmalarini yuklashda xatolik" }); } });
app.put("/api/admin/orders/:id", requireAdmin, async (req, res) => { try { const status = statuses.includes(String(req.body?.status)) ? String(req.body.status) : "Qabul qilindi"; const { data, error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", req.params.id).select("*").single(); if (error) throw error; res.json({ success: true, data }); } catch (error) { res.status(500).json({ success: false, message: "Buyurtma statusini yangilashda xatolik" }); } });

app.get("/api/admin/users", requireAdmin, async (req, res) => { try { const { data, error } = await supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,updated_at").order("updated_at", { ascending: false }).limit(Math.min(Number(req.query.limit) || 200, 500)); if (error) throw error; res.json({ success: true, data: data || [] }); } catch (error) { res.status(500).json({ success: false, message: "Mijozlarni yuklashda xatolik" }); } });

app.get("/api/admin/promos", requireAdmin, async (req, res) => { try { const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(Math.min(Number(req.query.limit) || 200, 500)); if (error) throw error; res.json({ success: true, data: data || [] }); } catch (error) { res.status(500).json({ success: false, message: "Promo kodlarni yuklashda xatolik" }); } });
app.post("/api/admin/promos", requireAdmin, async (req, res) => { try { const payload = { code: String(req.body?.code || "").trim().toUpperCase(), discount_type: req.body?.discount_type === "fixed" ? "fixed" : "percent", discount_value: Number(req.body?.discount_value) || 0, min_order_amount: Number(req.body?.min_order_amount) || 0, usage_limit: req.body?.usage_limit == null || req.body.usage_limit === "" ? null : Number(req.body.usage_limit), active: req.body?.active !== false }; if (!payload.code || payload.discount_value <= 0) return res.status(400).json({ success: false, message: "Promo kodi va chegirma qiymatini kiriting" }); const { data, error } = await supabase.from("promo_codes").insert([payload]).select("*").single(); if (error) throw error; res.status(201).json({ success: true, data }); } catch (error) { res.status(500).json({ success: false, message: "Promo kod yaratishda xatolik" }); } });
app.put("/api/admin/promos/:id", requireAdmin, async (req, res) => { try { const payload = { code: String(req.body?.code || "").trim().toUpperCase(), discount_type: req.body?.discount_type === "fixed" ? "fixed" : "percent", discount_value: Number(req.body?.discount_value) || 0, min_order_amount: Number(req.body?.min_order_amount) || 0, usage_limit: req.body?.usage_limit == null || req.body.usage_limit === "" ? null : Number(req.body.usage_limit), active: req.body?.active !== false }; const { data, error } = await supabase.from("promo_codes").update(payload).eq("id", req.params.id).select("*").single(); if (error) throw error; res.json({ success: true, data }); } catch (error) { res.status(500).json({ success: false, message: "Promo kodni yangilashda xatolik" }); } });
app.delete("/api/admin/promos/:id", requireAdmin, async (req, res) => { try { const { error } = await supabase.from("promo_codes").delete().eq("id", req.params.id); if (error) throw error; res.json({ success: true }); } catch (error) { res.status(500).json({ success: false, message: "Promo kodni o‘chirishda xatolik" }); } });

const statuses = ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi", "Bekor qilindi"];
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`GULI API running on port ${PORT}`); setupTelegramWebhook(); });
