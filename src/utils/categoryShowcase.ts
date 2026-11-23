import type { Product } from "../components/ProductImageGallery.tsx";
import { type CategoryInfo, normalizeCategory } from "./categoryUtils.ts";

export interface CategoryShowcaseItem {
  product: Product;
  imageUrl: string;
  title: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  isNew?: boolean;
}

/**
 * Groups active product primary images by normalized category in a single O(N) pass
 * so every card renders without scanning the full product list repeatedly.
 */
export function buildCategoryShowcaseMap(
  categories: CategoryInfo[],
  products: Product[],
): Record<string, CategoryShowcaseItem[]> {
  const result: Record<string, CategoryShowcaseItem[]> = {};
  const byNorm = new Map<string, CategoryShowcaseItem[]>();

  for (const cat of categories) {
    if (!cat?.name || cat.name === "Barchasi") continue;
    const norm = normalizeCategory(cat.name);
    if (norm && !byNorm.has(norm)) {
      byNorm.set(norm, []);
    }
    result[cat.name] = [];
  }

  for (const p of products) {
    if (!p || p.active === false) continue;
    const primaryImage =
      typeof p.image === "string" && p.image.trim()
        ? p.image.trim()
        : Array.isArray(p.images)
          ? p.images.find((u): u is string => typeof u === "string" && u.trim().length > 0)?.trim() || ""
          : "";
    if (!primaryImage) continue;

    const norm = normalizeCategory(p.category);
    if (!norm) continue;
    const bucket = byNorm.get(norm);
    if (!bucket) continue;

    bucket.push({
      product: p,
      imageUrl: primaryImage,
      title: p.name,
      price: Number(p.price) || 0,
      oldPrice: p.oldPrice,
      discount: p.discount,
      isNew: bucket.length < 2 || Boolean(p.featured),
    });
  }

  for (const cat of categories) {
    if (!cat?.name || cat.name === "Barchasi") continue;
    const norm = normalizeCategory(cat.name);
    result[cat.name] = byNorm.get(norm) || [];
  }

  return result;
}

/**
 * Picks the next category that has >= 2 items in round-robin order so at most one
 * category card transitions per coordinator tick.
 */
export function pickNextRotatableCategory(
  categoryNames: string[],
  showcaseMap: Record<string, CategoryShowcaseItem[]>,
  cursor: number,
): { categoryName: string; nextCursor: number } | null {
  const len = categoryNames.length;
  if (len === 0) return null;

  const start = ((cursor % len) + len) % len;
  for (let offset = 0; offset < len; offset += 1) {
    const idx = (start + offset) % len;
    const name = categoryNames[idx];
    const items = showcaseMap[name];
    if (items && items.length > 1) {
      return {
        categoryName: name,
        nextCursor: (idx + 1) % len,
      };
    }
  }
  return null;
}
