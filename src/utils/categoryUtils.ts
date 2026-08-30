import type { Product } from "../components/ProductImageGallery";

export interface CategoryInfo {
  name: string;
  icon?: string;
}

export const FIXED_CATEGORIES = [
  "Penyuar",
  "Pijama",
  "Byusgalter",
  "Mayka",
  "Tursik"
] as const;

export type FixedCategory = typeof FIXED_CATEGORIES[number];

/**
 * Normalizes any legacy or typo'd category string to one of the 5 official categories.
 */
export function normalizeCategory(catName?: string): string {
  if (!catName) return "Byusgalter";
  const trimmed = String(catName).trim();
  const lower = trimmed.toLowerCase();

  if (lower === "penyuar" || lower.includes("penyuar") || lower.includes("pinyuar") || lower.includes("bodi") || lower.includes("sexy")) {
    return "Penyuar";
  }
  if (lower === "pijama" || lower.includes("pijama") || lower.includes("sleepwear") || lower.includes("xalat")) {
    return "Pijama";
  }
  if (lower === "byusgalter" || lower.includes("byus") || lower.includes("bezg") || lower.includes("bra") || lower.includes("push") || lower.includes("komplekt")) {
    return "Byusgalter";
  }
  if (lower === "mayka" || lower.includes("mayka") || lower.includes("top")) {
    return "Mayka";
  }
  if (lower === "tursik" || lower.includes("tursik") || lower.includes("trusik") || lower.includes("choksiz")) {
    return "Tursik";
  }

  // Exact match from FIXED_CATEGORIES
  const match = FIXED_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (match) return match;

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function getSynchronizedCategories(products?: Product[]): CategoryInfo[] {
  const map = new Map<string, string>();
  FIXED_CATEGORIES.forEach((cat) => {
    map.set(cat, "🌸");
  });

  try {
    const saved = localStorage.getItem("guli_admin_categories");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: any) => {
          if (c?.name && c?.active !== false) {
            const norm = normalizeCategory(c.name);
            map.set(norm, c.icon || "🌸");
          }
        });
      }
    }
  } catch {}

  if (products && Array.isArray(products)) {
    products.forEach((p) => {
      if (p.category && typeof p.category === "string" && p.active !== false) {
        const norm = normalizeCategory(p.category);
        if (!map.has(norm)) {
          map.set(norm, "🌸");
        }
      }
    });
  }

  return [
    { name: "Barchasi", icon: "✨" },
    ...Array.from(map.entries()).map(([name, icon]) => ({ name, icon }))
  ];
}

