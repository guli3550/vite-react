import { extractPromoFromQr } from "./promoHelpers.ts";

export interface ValidatedPromoResult {
  ok: boolean;
  code: string;
  discount: number;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  max_discount_amount?: number | null;
  is_limit_applied?: boolean;
  promo_kind?: "promo" | "qr";
  message?: string;
}

export function extractAndNormalizePromoCode(rawInput: string): string {
  const extracted = extractPromoFromQr(String(rawInput || ""));
  return (extracted || String(rawInput || "")).trim().toUpperCase();
}

export async function validateScannedPromoCode(
  rawInput: string,
  options: {
    apiBase: string;
    subtotal?: number;
    source?: "qr" | "manual" | "auto";
    fetchImpl?: typeof fetch;
  },
): Promise<ValidatedPromoResult> {
  const code = extractAndNormalizePromoCode(rawInput);
  if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return {
      ok: false,
      code,
      discount: 0,
      message: "QR koddan yaroqli promokod aniqlanmadi",
    };
  }

  const doFetch = options.fetchImpl || fetch;
  const apiBase = String(options.apiBase || "").replace(/\/$/, "");
  const subtotal = Math.max(0, Number(options.subtotal ?? 0) || 0);
  const requestedSource = options.source || "qr";

  const callValidate = async (source: "qr" | "manual") => {
    const response = await doFetch(`${apiBase}/api/promo/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal, source }),
    });
    const json = await response.json().catch(() => ({}));
    return { response, json };
  };

  const initialSource: "qr" | "manual" = requestedSource === "manual" ? "manual" : "qr";
  let { response, json } = await callValidate(initialSource);

  // In Admin verification ("auto") mode, seamlessly fall back to manual channel
  // when verifying a standard promo code via QR image/camera.
  if (
    requestedSource === "auto" &&
    (!response.ok || !json?.success) &&
    /oddiy promokod/i.test(String(json?.message || ""))
  ) {
    ({ response, json } = await callValidate("manual"));
  }

  if (!response.ok || !json?.success) {
    return {
      ok: false,
      code,
      discount: 0,
      message: json?.message || "Promo kodni tekshirishda xatolik",
    };
  }

  const data = json.data || {};
  return {
    ok: true,
    code: String(data.code || code).trim().toUpperCase(),
    discount: Number(data.discount || 0),
    discount_type: data.discount_type === "fixed" ? "fixed" : "percent",
    discount_value: Number(data.discount_value || 0),
    max_discount_amount:
      data.max_discount_amount != null ? Number(data.max_discount_amount) : null,
    is_limit_applied: Boolean(data.is_limit_applied),
    promo_kind: data.promo_kind === "qr" ? "qr" : "promo",
  };
}
