const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAgentAdmin } = require("./agentCorePatch");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim().replace(/^['"]|['"]$/g, "");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = getSupabaseClient();
  }
  return _supabase;
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase is not configured (SUPABASE_URL or SUPABASE_SECRET_KEY missing)");
    }
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

install("post", "/api/admin/orders/:id/payment-decision", requireAgentAdmin, async (req, res) => {
  try {
    const paymentStatus = String(req.body?.payment_status || "");
    if (!["verified", "rejected"].includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: "To‘lov qarori noto‘g‘ri" });
    }
    const { data, error } = await supabase.rpc("admin_payment_decision", {
      p_order_id: req.params.id,
      p_payment_status: paymentStatus,
    });
    if (error) {
      const message = error.message || "To‘lov qarorini saqlab bo‘lmadi";
      const status = /topilmadi/i.test(message) ? 404 : /talab qilinadi|manual karta|o‘zgartirib|yuklangan|qayta yuklanishi/i.test(message) ? 409 : 500;
      return res.status(status).json({ success: false, message });
    }
    return res.json({ success: true, message: paymentStatus === "verified" ? "Chek tasdiqlandi va buyurtma qabul qilindi" : "Chek rad etildi va buyurtma bekor qilindi", data });
  } catch (error) {
    console.error("Atomic payment decision error:", error);
    return res.status(500).json({ success: false, message: "To‘lov qarorini saqlashda xatolik" });
  }
});
