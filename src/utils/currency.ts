export type Currency = "UZS" | "USD" | "RUB";

export function formatCurrencyPrice(
  amountInUzs: number,
  currency: Currency = "UZS",
  lang: string = "uz"
): string {
  const num = Number(amountInUzs) || 0;

  if (currency === "USD") {
    const usd = num / 12800;
    return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (currency === "RUB") {
    const rub = Math.round(num / 140);
    return `${rub.toLocaleString("ru-RU")} ₽`;
  }

  // UZS (Default)
  const formatted = Math.round(num).toLocaleString(
    lang === "en" ? "en-US" : lang === "ru" ? "ru-RU" : "uz-UZ"
  );
  if (lang === "en") return `${formatted} UZS`;
  if (lang === "ru") return `${formatted} сум`;
  return `${formatted} so'm`;
}
