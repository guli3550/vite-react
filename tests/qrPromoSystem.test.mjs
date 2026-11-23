import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { extractPromoFromQr } from "../src/utils/promoHelpers.ts";
import { validateScannedPromoCode } from "../src/utils/qrPromoValidator.ts";

const require = createRequire(import.meta.url);
const {
  validatePromoChannelAccess,
  calculatePromoDiscount,
  setPromoMeta,
  getPromoMeta,
  deletePromoMeta,
  setPromoLimit,
  getPromoLimit,
  deletePromoLimit,
} = require("../backend/promoLimits.js");

const ROOT = process.cwd();

describe("QR Promo System & Channel Isolation", () => {
  it("enforces separate channels between QR vouchers and manual promo codes", () => {
    assert.deepEqual(validatePromoChannelAccess("qr", "qr"), { ok: true });
    assert.deepEqual(validatePromoChannelAccess("promo", "manual"), { ok: true });

    const qrManualAttempt = validatePromoChannelAccess("qr", "manual");
    assert.equal(qrManualAttempt.ok, false);
    assert.match(qrManualAttempt.message, /QR skaner/i);

    const promoQrAttempt = validatePromoChannelAccess("promo", "qr");
    assert.equal(promoQrAttempt.ok, false);
    assert.match(promoQrAttempt.message, /oddiy promokod/i);
  });

  it("calculates percent, fixed, max-cap, and subtotal-clamped discounts identically for QR vouchers", () => {
    const pctResult = calculatePromoDiscount(
      { code: "TESTQR1", discount_type: "percent", discount_value: 20, max_discount_amount: 50000 },
      400000
    );
    assert.equal(pctResult.discount, 50000);
    assert.equal(pctResult.is_limit_applied, true);

    const uncappedPct = calculatePromoDiscount(
      { code: "TESTQR2", discount_type: "percent", discount_value: 15, max_discount_amount: 100000 },
      200000
    );
    assert.equal(uncappedPct.discount, 30000);
    assert.equal(uncappedPct.is_limit_applied, false);

    const fixedClamped = calculatePromoDiscount(
      { code: "TESTQR3", discount_type: "fixed", discount_value: 150000 },
      90000
    );
    assert.equal(fixedClamped.discount, 90000);
  });

  it("extracts admin-generated Guli Market QR voucher URLs cleanly using https://gulii.uz", () => {
    assert.equal(
      extractPromoFromQr("https://gulii.uz/?promo=GULIQR-8F3K2A"),
      "GULIQR-8F3K2A"
    );
    assert.equal(extractPromoFromQr("guliqr-vip20"), "GULIQR-VIP20");
    assert.equal(extractPromoFromQr('{"promo":"guli_qr_50"}'), "GULI_QR_50");
  });

  it("persists and removes QR metadata and max limits cleanly without leftover state", () => {
    const tempCode = "__TEST_QR_VOUCHER_TMP__";
    try {
      setPromoLimit(tempCode, 75000);
      setPromoMeta(tempCode, {
        promo_kind: "qr",
        qr_label: "VIP QR Vaucher",
        qr_color: "#9f3654",
        starts_at: "2026-11-01T00:00:00.000Z",
        expires_at: "2026-12-01T00:00:00.000Z",
      });

      assert.equal(getPromoLimit(tempCode), 75000);
      const meta = getPromoMeta(tempCode);
      assert.equal(meta.promo_kind, "qr");
      assert.equal(meta.qr_label, "VIP QR Vaucher");
      assert.equal(meta.qr_color, "#9f3654");
    } finally {
      deletePromoLimit(tempCode);
      deletePromoMeta(tempCode);
    }

    assert.equal(getPromoLimit(tempCode), null);
    assert.equal(getPromoMeta(tempCode).promo_kind, "promo");
  });

  it("renders full-screen Guli Market QR scanner with square cutout, middle caption, and bottom torch button", () => {
    const scannerTsx = fs.readFileSync(
      path.join(ROOT, "src/components/QrCodeScannerModal.tsx"),
      "utf-8"
    );
    const appCss = fs.readFileSync(path.join(ROOT, "src/App.css"), "utf-8");

    assert.match(scannerTsx, /guliQrFullscreen/);
    assert.match(scannerTsx, /guliQrSquareBox/);
    assert.match(scannerTsx, /guliQrMiddleCaption/);
    assert.match(scannerTsx, /guliQrBottomBar/);
    assert.match(scannerTsx, /guliQrTorchBtn/);
    assert.match(scannerTsx, /toggleTorch/);
    assert.match(scannerTsx, /BarcodeDetector/);

    assert.match(appCss, /\.guliQrFullscreen\s*\{[\s\S]*?height:\s*100dvh/);
    assert.match(appCss, /\.guliQrSquareBox\s*\{[\s\S]*?box-shadow:\s*0 0 0 9999px/);
    assert.match(appCss, /\.guliQrBottomBar\s*\{[\s\S]*?bottom:\s*max\(22px,\s*env\(safe-area-inset-bottom\)\)/);
  });

  it("wires CheckoutView, AdminPro, and backend promo channel separation end-to-end", () => {
    const checkoutTsx = fs.readFileSync(
      path.join(ROOT, "src/components/CheckoutView.tsx"),
      "utf-8"
    );
    const adminProTsx = fs.readFileSync(
      path.join(ROOT, "src/admin/AdminPro.tsx"),
      "utf-8"
    );
    const adminQrModalTsx = fs.readFileSync(
      path.join(ROOT, "src/admin/components/AdminQrPromoModal.tsx"),
      "utf-8"
    );

    assert.match(checkoutTsx, /extractAndNormalizePromoCode/);
    assert.match(checkoutTsx, /setPromoSource\("qr"\)/);
    assert.match(checkoutTsx, /onApplyPromo\(cleaned,\s*"qr"\)/);
    assert.match(adminProTsx, /promoSubTab/);
    assert.match(adminProTsx, /\+ QR kod/);
    assert.match(adminProTsx, /AdminQrPreviewPanel/);
    assert.match(adminProTsx, /AdminQrScannerPanel/);
    assert.match(adminQrModalTsx, /buildQrVoucherPayload/);
    assert.match(adminQrModalTsx, /https:\/\/gulii\.uz\/\?promo=/);
    assert.doesNotMatch(adminQrModalTsx, /gulimarket\.uz/i);
    assert.match(adminQrModalTsx, /downloadQrVoucherCardPng/);
  });

  it("extracts QR voucher payloads and validates against /api/promo/validate with admin fallback", async () => {
    const calls = [];
    const mockFetch = async (_url, init) => {
      const body = JSON.parse(String(init.body));
      calls.push(body);
      if (body.code === "GULIQR-111" && body.source === "qr") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              code: "GULIQR-111",
              discount: 45000,
              discount_type: "percent",
              discount_value: 15,
              max_discount_amount: 100000,
              is_limit_applied: false,
              promo_kind: "qr",
            },
          }),
        };
      }
      if (body.code === "GULI20" && body.source === "qr") {
        return {
          ok: false,
          json: async () => ({
            success: false,
            message: "Bu oddiy promokod — uni promokod maydoniga qo‘lda kiriting",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            code: body.code,
            discount: 40000,
            discount_type: "percent",
            discount_value: 20,
            promo_kind: "promo",
          },
        }),
      };
    };

    const qrRes = await validateScannedPromoCode(
      "https://gulii.uz/?promo=guliqr-111",
      { apiBase: "https://api.test", subtotal: 300000, source: "qr", fetchImpl: mockFetch }
    );
    assert.equal(qrRes.ok, true);
    assert.equal(qrRes.code, "GULIQR-111");
    assert.equal(qrRes.discount, 45000);
    assert.equal(qrRes.promo_kind, "qr");

    const adminAutoPromoRes = await validateScannedPromoCode("GULI20", {
      apiBase: "https://api.test",
      subtotal: 200000,
      source: "auto",
      fetchImpl: mockFetch,
    });
    assert.equal(adminAutoPromoRes.ok, true);
    assert.equal(adminAutoPromoRes.code, "GULI20");
    assert.equal(adminAutoPromoRes.discount, 40000);
    assert.equal(adminAutoPromoRes.promo_kind, "promo");
    assert.equal(calls.length, 3);

    const invalidRes = await validateScannedPromoCode("   ", {
      apiBase: "https://api.test",
      subtotal: 100000,
      fetchImpl: mockFetch,
    });
    assert.equal(invalidRes.ok, false);
    assert.match(invalidRes.message, /aniqlanmadi/i);
  });
});
