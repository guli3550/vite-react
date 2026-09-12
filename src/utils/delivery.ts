export const FREE_DELIVERY_THRESHOLD = 600000;
export const STANDARD_DELIVERY_FEE = 20000;

export interface DeliveryEstimate {
  days: number;
  label: string;
  badge: string;
  category: "qoqon" | "toshkent_vodiy" | "voha_others";
}

/**
 * Aniq yetkazib berish muddatlari:
 * 1) Qo'qon ichida: 1 ish kuni
 * 2) Toshkent, Andijon, Namangan, Farg'onaga: 3 ish kuni
 * 3) Voha viloyatlariga (va boshqa viloyatlarga): 5 ish kuni
 */
export function getDeliveryEstimate(region?: string, district?: string): DeliveryEstimate {
  const norm = `${region || ""} ${district || ""}`.toLowerCase();

  // 1) Qo'qon ichida 1 ish kuni
  if (norm.includes("qo‘qon") || norm.includes("qo'qon") || norm.includes("qoqon")) {
    return {
      days: 1,
      label: "Qo‘qon ichida: 1 ish kuni",
      badge: "⚡ 1 ish kuni (Qo‘qon)",
      category: "qoqon",
    };
  }

  // 2) Toshkent, Andijon, Namangan, Farg'ona: 3 ish kuni
  if (
    norm.includes("toshkent") ||
    norm.includes("andijon") ||
    norm.includes("namangan") ||
    norm.includes("farg‘ona") ||
    norm.includes("farg'ona") ||
    norm.includes("fargona")
  ) {
    return {
      days: 3,
      label: "Toshkent, Andijon, Namangan, Farg‘onaga: 3 ish kuni",
      badge: "🚚 3 ish kuni (Toshkent / Vodiy)",
      category: "toshkent_vodiy",
    };
  }

  // 3) Voha viloyatlariga va boshqa viloyatlarga: 5 ish kuni
  return {
    days: 5,
    label: "Voha va boshqa viloyatlarga: 5 ish kuni",
    badge: "📦 5 ish kuni (Voha viloyatlari)",
    category: "voha_others",
  };
}

export const PAYMENT_TERMS_SUMMARY = {
  ruleText: "Click, Payme, Beepul va boshqa barcha moliyaviy platformalardan qat'i nazar, to‘lov faqat rasmiy Uzcard / Humo plastik kartasi orqali amalga oshiriladi.",
  receiptSlaHours: 2,
  receiptSlaText: "Yuborilgan to‘lov cheki 2 soat ichida admin tomonidan tasdiqlanadi.",
  delayedNotificationText: "To‘lovingiz admin tomonidan tasdiqlanishi kutilmoqda, tez orada tasdiqlanadi. Iltimos kuting yoki qo‘llab-quvvatlash markazi bilan bog‘laning.",
};

/**
 * Chek 2 soat ichida admin tomonidan tasdiqlanishini tekshirish.
 * Agar 2 soatdan oshib ketgan bo'lsa (isDelayed = true), mijozga 1 marta bildirishnoma beriladi.
 */
export function checkReceiptDelayed(createdAt?: string, status?: string, receiptUrl?: string): {
  isPending: boolean;
  isDelayed: boolean;
  elapsedMinutes: number;
  remainingMinutes: number;
} {
  if (!receiptUrl) {
    return { isPending: false, isDelayed: false, elapsedMinutes: 0, remainingMinutes: 120 };
  }

  const s = String(status || "").toLowerCase();
  const isCompletedOrCanceled =
    s.includes("qabul qilindi") ||
    s.includes("tasdiqlandi") ||
    s.includes("yetkazildi") ||
    s.includes("bekor qilindi");

  const isPending = !isCompletedOrCanceled;
  if (!isPending) {
    return { isPending: false, isDelayed: false, elapsedMinutes: 0, remainingMinutes: 0 };
  }

  const orderTime = createdAt ? new Date(createdAt).getTime() : 0;
  if (!orderTime || isNaN(orderTime)) {
    return { isPending: true, isDelayed: false, elapsedMinutes: 0, remainingMinutes: 120 };
  }

  const elapsedMs = Math.max(0, Date.now() - orderTime);
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  const remainingMinutes = Math.max(0, 120 - elapsedMinutes);
  const isDelayed = elapsedMinutes >= 120;

  return { isPending: true, isDelayed, elapsedMinutes, remainingMinutes };
}
