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

export function getSynchronizedCategories(products?: Product[]): CategoryInfo[] {
  void products;
  return [
    { name: "Barchasi" },
    ...FIXED_CATEGORIES.map((name) => ({ name }))
  ];
}
