const express = require("express");

const RECEIPT_PATH_RE = /^\/api\/admin\/orders\/[^/]+\/payment-receipt\/?$/;
const originalGet = express.application.get;

if (!express.application.__guliReceiptPaymentsOnlyPatched) {
  express.application.get = function patchedGet(path, ...handlers) {
    if (typeof path === "string" && RECEIPT_PATH_RE.test(path)) {
      const guard = (req, res, next) => {
        if (req.get("X-Guli-Payment-Context") !== "payments") {
          return res.status(403).json({ success: false, message: "Chek faqat To'lovlar bo'limida ko'riladi" });
        }
        return next();
      };
      return originalGet.call(this, path, guard, ...handlers);
    }
    return originalGet.call(this, path, ...handlers);
  };
  express.application.__guliReceiptPaymentsOnlyPatched = true;
}
