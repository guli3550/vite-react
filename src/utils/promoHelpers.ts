/**
 * Helper to parse and extract a clean promo code from various QR code payloads:
 * - Direct strings: "GULI20", "SUMMER"
 * - Store URLs: "https://gulii.uz/checkout?promo=GULI20"
 * - Telegram Bot Deep Links: "https://t.me/guli_market_bot?start=promo_GULI20"
 * - JSON data: '{"promo": "GULI20"}'
 * - Prefixed strings: "PROMO: GULI20"
 */
export function extractPromoFromQr(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // 1. Check if it's a URL
  try {
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("tg://")
    ) {
      const parsed = new URL(trimmed.replace(/^tg:\/\//i, "https://t.me/"));
      const promoParam =
        parsed.searchParams.get("promo") ||
        parsed.searchParams.get("code") ||
        parsed.searchParams.get("coupon") ||
        parsed.searchParams.get("discount");
      if (promoParam) return promoParam.trim().toUpperCase();

      const startParam = parsed.searchParams.get("start");
      if (startParam) {
        const cleaned = startParam.replace(/^(promo_|coupon_)/i, "");
        if (cleaned) return cleaned.trim().toUpperCase();
      }

      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const promoIdx = pathParts.findIndex((p) =>
        ["promo", "promokod", "coupon", "voucher"].includes(p.toLowerCase())
      );
      if (promoIdx !== -1 && pathParts[promoIdx + 1]) {
        return pathParts[promoIdx + 1].trim().toUpperCase();
      }
    }
  } catch {}

  // 2. Check if JSON format
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const code =
        parsed.promo ||
        parsed.promo_code ||
        parsed.code ||
        parsed.coupon ||
        parsed.discount;
      if (code && typeof code === "string") return code.trim().toUpperCase();
    } catch {}
  }

  // 3. Check prefixed strings like "PROMO: CODE", "PROMO=CODE"
  const prefixMatch = trimmed.match(
    /^(?:promo(?:code)?|coupon|kod)[\s:=_-]+([a-zA-Z0-9_-]+)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim().toUpperCase();
  }

  // 4. Default plain text (strip quotes, symbols, uppercase)
  return trimmed.replace(/^["']|["']$/g, "").trim().toUpperCase();
}
