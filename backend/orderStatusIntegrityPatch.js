const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAgentAdmin } = require("./agentCorePatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const CARD_PAYMENT_VALUES = new Set(["card_manual", "card", "karta (uzcard / humo)"]);

// This guard runs before the legacy admin order-update handler. It does not
// replace the handler; it prevents known integrity-breaking transitions.
install("put", "/api/admin/orders/:id", requireAgentAdmin, async (req, res, next) => {
  try {
    const requestedStatus = String(req.body?.status || "").trim();
    if (!requestedStatus) return next();

    let { data: order, error } = await supabase
      .from("orders")
      .select("id,status,payment,payment_status")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!order) {
      const byNum = await supabase
        .from("orders")
        .select("id,status,payment,payment_status")
        .eq("order_number", req.params.id)
        .maybeSingle();
      order = byNum.data;
    }

    if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });

    // When admin approves order, automatically mark card payment as verified
    if (requestedStatus === "Qabul qilindi") {
      await supabase
        .from("orders")
        .update({
          payment_status: "verified",
          payment_verified_at: new Date().toISOString(),
          status: "Qabul qilindi",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    next();
  } catch (error) {
    console.error("Order status integrity guard error:", error);
    return res.status(500).json({ success: false, message: "Buyurtma holatini tekshirishda xatolik" });
  }
});
