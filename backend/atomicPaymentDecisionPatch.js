const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAgentAdmin } = require("./agentCorePatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

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
