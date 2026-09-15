// Canonical payment mutation boundary.
// The legacy manual-payment runtime registers PUT /api/admin/orders/:id/payment
// before the atomic payment decision route. Replace that legacy registry entry so
// every admin payment verification/rejection goes through the locked DB RPC.
const { createClient } = require("@supabase/supabase-js");
const { install, registry } = require("./routeRegistry.js");
const { requireAgentAdmin } = require("./agentCorePatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

registry.routes = registry.routes.filter(
  (route) => !(route.method === "put" && route.path === "/api/admin/orders/:id/payment")
);

install("put", "/api/admin/orders/:id/payment", requireAgentAdmin, async (req, res) => {
  try {
    const paymentStatus = String(req.body?.payment_status || "");
    if (!["verified", "rejected"].includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: "To‘lov qarori noto‘g‘ri. verified yoki rejected tanlang." });
    }

    const { data, error } = await supabase.rpc("admin_payment_decision", {
      p_order_id: req.params.id,
      p_payment_status: paymentStatus,
    });

    if (error) {
      const message = error.message || "To‘lov qarorini saqlab bo‘lmadi";
      const status = /topilmadi/i.test(message)
        ? 404
        : /talab qilinadi|manual karta|o‘zgartirib|yuklangan|qayta yuklanishi|receipt/i.test(message)
          ? 409
          : 500;
      return res.status(status).json({ success: false, message });
    }

    return res.json({
      success: true,
      message: paymentStatus === "verified"
        ? "Chek tasdiqlandi va buyurtma qabul qilindi"
        : "Chek rad etildi va buyurtma bekor qilindi",
      data,
    });
  } catch (error) {
    console.error("Canonical payment mutation error:", error);
    return res.status(500).json({ success: false, message: "To‘lov qarorini saqlashda xatolik" });
  }
});
