import type { Product } from "../components/ProductImageGallery";

export interface CategoryInfo {
  name: string;
  icon?: string;
  slug?: string;
}

export const FIXED_CATEGORIES = [
  "Penyuar",
  "Pijama",
  "Byusgalter",
  "Mayka",
  "Tursik",
] as const;

export type FixedCategory = typeof FIXED_CATEGORIES[number];

/**
 * Normalizes only the legacy spellings that already exist in the catalog.
 * Unknown names are preserved so admin-created categories never collapse into
 * one of the five legacy categories.
 */
export function normalizeCategory(catName?: string): string {
  const trimmed = String(catName || "").trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower === "penyuar" || lower === "pinyuar") return "Penyuar";
  if (lower === "pijama") return "Pijama";
  if (lower === "byusgalter" || lower === "byustgalter") return "Byusgalter";
  if (lower === "mayka") return "Mayka";
  if (lower === "tursik" || lower === "trusik") return "Tursik";

  return trimmed;
}

export function getSynchronizedCategories(products?: Product[]): CategoryInfo[] {
  const map = new Map<string, CategoryInfo>();

  FIXED_CATEGORIES.forEach((name) => {
    map.set(name, { name, icon: "🌸" });
  });

  if (products && Array.isArray(products)) {
    products.forEach((p) => {
      if (p.category && typeof p.category === "string" && p.active !== false) {
        const name = normalizeCategory(p.category);
        if (name && !map.has(name)) {
          map.set(name, { name, icon: "🌸" });
        }
      }
    });
  }

  return [
    { name: "Barchasi", icon: "✨" },
    ...Array.from(map.values()),
  ];
}
