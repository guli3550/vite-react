(() => {
  if (typeof app === "undefined" || typeof supabase === "undefined" || typeof requireAdmin !== "function") return;
  app.post("/api/admin/orders/:id/payment-decision", requireAdmin, async (req, res) => {
    try {
      const paymentStatus = String(req.body?.payment_status || "");
      if (!["verified", "rejected"].includes(paymentStatus)) return res.status(400).json({ success: false, message: "Invalid payment status" });
      const { data, error } = await supabase.rpc("admin_payment_decision", { p_order_id: req.params.id, p_payment_status: paymentStatus });
      if (error) return res.status(/topilmadi/i.test(error.message || "") ? 404 : 409).json({ success: false, message: error.message || "Payment decision failed" });
      return res.json({ success: true, data });
    } catch (error) {
      console.error("Atomic payment decision error:", error);
      return res.status(500).json({ success: false, message: "Payment decision failed" });
    }
  });
})();
