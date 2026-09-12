const express = require("express");

const RECEIPT_PATH_RE = /^\/api\/admin\/orders\/[^/]+\/payment-receipt\/?$/;
const originalGet = express.application.get;

if (!express.application.__guliReceiptPaymentsOnlyPatched) {
  express.application.get = function patchedGet(path, ...handlers) {
    if (typeof path === "string" && RECEIPT_PATH_RE.test(path)) {
      const guard = (req, res, next) => {
        const ctx = req.get("X-Guli-Payment-Context");
        const auth = String(req.headers.authorization || "");
        if (ctx === "payments" || ctx === "orders" || ctx === "admin" || auth.startsWith("Bearer ")) {
          return next();
        }
        return res.status(403).json({ success: false, message: "Chek faqat to‘lov yoki buyurtma bo‘limida ko‘riladi" });
      };
      return originalGet.call(this, path, guard, ...handlers);
    }
    return originalGet.call(this, path, ...handlers);
  };
  express.application.__guliReceiptPaymentsOnlyPatched = true;
}
