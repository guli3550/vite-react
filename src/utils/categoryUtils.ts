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
export function normalizeCategory(catName?: string): FixedCategory {
  if (!catName) return "Byusgalter";
  const lower = catName.trim().toLowerCase();

  if (lower.includes("penyuar") || lower.includes("pinyuar") || lower.includes("bodi") || lower.includes("sexy")) {
    return "Penyuar";
  }
  if (lower.includes("pijama") || lower.includes("sleepwear") || lower.includes("xalat")) {
    return "Pijama";
  }
  if (lower.includes("byus") || lower.includes("bezg") || lower.includes("bra") || lower.includes("push") || lower.includes("komplekt")) {
    return "Byusgalter";
  }
  if (lower.includes("mayka") || lower.includes("top")) {
    return "Mayka";
  }
  if (lower.includes("tursik") || lower.includes("trusik") || lower.includes("choksiz")) {
    return "Tursik";
  }

  // Check direct match
  const match = FIXED_CATEGORIES.find(c => c.toLowerCase() === lower);
  return match || "Byusgalter";
}

export function getSynchronizedCategories(products?: Product[]): CategoryInfo[] {
  void products;
  return [
    { name: "Barchasi" },
    ...FIXED_CATEGORIES.map((name) => ({ name }))
  ];
}

