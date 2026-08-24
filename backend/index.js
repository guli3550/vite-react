const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { listProducts, getProduct } = require("./catalog");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com";

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || "Telegram API xatosi");
  return result.result;
}

async function setupTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN) return console.warn("TELEGRAM_BOT_TOKEN topilmadi; webhook o'rnatilmadi.");
  try {
    const webhookUrl = `${BASE_URL}/api/telegram/webhook`;
    await telegramApi("setWebhook", { url: webhookUrl });
    console.log(`Telegram webhook set: ${webhookUrl}`);
  } catch (error) {
    console.error("Telegram webhook o'rnatilmadi:", error.message);
  }
}

app.get("/", (req, res) => res.json({ success: true, message: "GULI LINGERIE API ishlayapti 🌷" }));
app.get("/api/health", (req, res) => res.json({ success: true, status: "online" }));

app.get("/api/products", async (req, res) => {
  try {
    const data = await listProducts({
      category: req.query.category,
      search: req.query.search,
      featured: req.query.featured === undefined ? undefined : req.query.featured === "true",
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Products API error:", error);
    res.status(500).json({ success: false, message: "Mahsulotlarni yuklashda xatolik" });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const telegramId = req.query.telegram_id;
    if (!telegramId) return res.status(400).json({ success: false, message: "telegram_id kerak" });
    const { data, error } = await supabase.from("orders").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Orders API error:", error);
    res.status(500).json({ success: false, message: "Buyurtmalarni yuklashda xatolik" });
  }
});

app.get("/api/reverse-geocode", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ success: false, message: "Koordinatalar noto'g'ri" });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`, { headers: { "User-Agent": "GULI-Lingerie-Telegram-Mini-App/1.0" } });
    if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
    const result = await response.json();
    const a = result.address || {};
    res.json({ success: true, data: { region: a.state || a.region || a.province || "", district: a.city_district || a.district || a.county || a.city || "", street: a.road || a.pedestrian || a.street || "", display_name: result.display_name || "" } });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    res.status(502).json({ success: false, message: "Manzilni avtomatik aniqlab bo'lmadi" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const data = await getProduct(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Product detail API error:", error);
    res.status(500).json({ success: false, message: "Mahsulotni yuklashda xatolik" });
  }
});

app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const message = req.body?.message;
    const contact = message?.contact;
    if (contact?.user_id && contact?.phone_number) {
      const telegramUser = message.from || {};
      const { error } = await supabase.from("telegram_users").upsert({
        telegram_id: contact.user_id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null,
        telegram_phone: contact.phone_number,
        updated_at: new Date().toISOString(),
      }, { onConflict: "telegram_id" });
      if (error) console.error("Telegram kontaktini saqlash xatosi:", error);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram webhook xatosi:", error);
    res.sendStatus(200);
  }
});

app.post("/api/save-address", async (req, res) => {
  try {
    const { telegram_id, username, phone, latitude, longitude, region, district, street, house, apartment, landmark } = req.body;
    if (latitude == null || longitude == null) return res.status(400).json({ success: false, message: "Lokatsiya koordinatalari topilmadi" });
    const { data, error } = await supabase.from("saved_addresses").insert([{
      telegram_id, username, phone, latitude, longitude, region, district, street, house, apartment, landmark,
    }]).select().single();
    if (error) throw error;
    res.json({ success: true, message: "Manzil muvaffaqiyatli saqlandi", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Manzilni saqlashda xatolik" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { order_number, telegram_id, username, first_name, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "Buyurtma mahsulotlari topilmadi" });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Telefon raqami kiritilmagan" });

    let telegram_phone = null;
    if (telegram_id != null) {
      const { data } = await supabase.from("telegram_users").select("telegram_phone").eq("telegram_id", telegram_id).maybeSingle();
      telegram_phone = data?.telegram_phone || null;
    }

    const order = {
      order_number: order_number || null,
      telegram_id: telegram_id || null,
      username: username || null,
      first_name: first_name || null,
      telegram_phone,
      phone: phone.trim(),
      items,
      subtotal: Number(subtotal) || 0,
      delivery: Number(delivery) || 0,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      address: address || null,
      payment: payment || "cash",
      status: status || "Qabul qilindi",
      created_at: created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("orders").insert([order]).select().single();
    if (error) {
      if (error.code === "23505" && order_number) {
        const existing = await supabase.from("orders").select("*").eq("order_number", order_number).maybeSingle();
        if (existing.data) return res.status(200).json({ success: true, message: "Buyurtma allaqachon saqlangan", data: existing.data, duplicate: true });
      }
      console.error(error);
      return res.status(500).json({ success: false, message: "Buyurtmani saqlashda xatolik", error: error.message });
    }
    res.status(201).json({ success: true, message: "Buyurtma muvaffaqiyatli saqlandi", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server xatosi" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`GULI API running on port ${PORT}`);
  setupTelegramWebhook();
});
