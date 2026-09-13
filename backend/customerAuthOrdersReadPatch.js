// Authenticated browser order-list bridge.
// /api/orders supports Telegram users and authenticated Supabase users.
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry.js");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function authUser(req) {
  const h = String(req.headers.authorization || "");
  if (!db || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data?.user?.id ? null : data.user;
}

install("get", "/api/orders", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ success: false, message: "Supabase serverda sozlanmagan." });
    const tgId = Number(req.telegramUser?.id || 0);
    if (tgId) {
      const { data, error } = await db.from("orders").select("*").eq("telegram_id", tgId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return res.json({ success: true, data: data || [] });
    }
    const user = await authUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Mijoz sessiyasi topilmadi. Email yoki Google orqali qayta kiring." });
    const { data, error } = await db.from("orders").select("*").eq("auth_user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Customer orders read error:", error);
    return res.status(500).json({ success: false, message: "Buyurtmalarni yuklashda xatolik" });
  }
});

console.log("[GULI Orders] authenticated browser order-list bridge registered.");
