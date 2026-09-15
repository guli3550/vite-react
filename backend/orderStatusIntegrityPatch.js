const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAgentAdmin } = require("./agentCorePatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// Guard the legacy admin status route without allowing it to mutate payment state.
// Payment verification/rejection is exclusively handled by admin_payment_decision RPC.
install("put", "/api/admin/orders/:id", requireAgentAdmin, async (req, res, next) => {
  try {
    const requestedStatus = String(req.body?.status || "").trim();
    if (!requestedStatus) return next();

    let { data: order, error } = await supabase
      .from("orders")
      .select("id,status,payment,payment_status")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;

    if (!order) {
      const byNum = await supabase
        .from("orders")
        .select("id,status,payment,payment_status")
        .eq("order_number", req.params.id)
        .maybeSingle();
      if (byNum.error) throw byNum.error;
      order = byNum.data;
    }

    if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });

    // Never let a generic status update silently certify a payment.
    // The dedicated atomic RPC remains the sole payment decision path.
    if (requestedStatus === "Qabul qilindi" && String(order.payment_status || "pending") !== "verified") {
      return res.status(409).json({
        success: false,
        message: "To‘lov tasdiqlanmasdan buyurtmani ‘Qabul qilindi’ holatiga o‘tkazib bo‘lmaydi. Avval to‘lov qarorini tasdiqlang.",
      });
    }

    return next();
  } catch (error) {
    console.error("Order status integrity guard error:", error);
    return res.status(500).json({ success: false, message: "Buyurtma holatini tekshirishda xatolik" });
  }
});
