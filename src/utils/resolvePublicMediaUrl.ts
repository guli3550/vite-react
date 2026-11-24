/**
 * Keep legacy Supabase Storage URLs on their original origin until each object
 * has been copied to R2 and its existence has been verified.
 *
 * Rewriting every Supabase URL to R2 caused missing legacy Reels/posters and
 * promo thumbnails when an object had not yet been migrated. New uploads
 * already carry their media.gulii.uz URL and pass through unchanged.
 */
export function resolvePublicMediaUrl(value: unknown): string {
  return String(value ?? "").trim();
}
