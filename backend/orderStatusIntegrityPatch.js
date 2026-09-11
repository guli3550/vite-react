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

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,status,payment,payment_status")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ success: false, message: "Buyurtma topilmadi" });

    const paymentValue = String(order.payment || "").trim().toLowerCase();
    const isCardPayment = CARD_PAYMENT_VALUES.has(paymentValue);
    const paymentStatus = String(order.payment_status || "pending").toLowerCase();

    if (isCardPayment && requestedStatus === "Qabul qilindi" && paymentStatus !== "verified") {
      return res.status(409).json({ success: false, message: "Karta to‘lovi tasdiqlanmasdan buyurtmani qabul qilib bo‘lmaydi" });
    }
    if (isCardPayment && requestedStatus === "Yetkazildi" && paymentStatus !== "verified") {
      return res.status(409).json({ success: false, message: "Tasdiqlanmagan karta to‘lovi bilan buyurtmani yetkazilgan deb belgilab bo‘lmaydi" });
    }
    if (isCardPayment && requestedStatus === "Bekor qilindi" && paymentStatus === "verified") {
      return res.status(409).json({ success: false, message: "Tasdiqlangan karta to‘lovi bor buyurtmani oddiy status orqali bekor qilib bo‘lmaydi" });
    }
    next();
  } catch (error) {
    console.error("Order status integrity guard error:", error);
    return res.status(500).json({ success: false, message: "Buyurtma holatini tekshirishda xatolik" });
  }
});
