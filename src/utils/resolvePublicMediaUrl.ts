/**
 * Resolve legacy public Supabase Storage URLs to their verified Cloudflare R2
 * public-object equivalents. Private/signed URLs are deliberately untouched.
 *
 * R2 copy layout: <source-bucket>/<original-object-key>
 * Example: product-images/products/item.webp
 */
const R2_PUBLIC_BASE = "https://media.gulii.uz";
const PUBLIC_MEDIA_BUCKETS = new Set([
  "product-images",
  "reels-media",
  "video-ads",
  "review-images",
]);

export function resolvePublicMediaUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      return raw;
    }

    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return raw;

    const bucket = match[1];
    if (!PUBLIC_MEDIA_BUCKETS.has(bucket)) return raw;

    // Keep the encoded object key and query string intact.
    const objectPath = match[2].replace(/^\/+/, "");
    // Banner objects are resolved server-side only after a real R2 HEAD 200.
    // Do not blanket-rewrite missing legacy banner URLs to R2.
    if (bucket === "product-images" && objectPath.startsWith("banners/")) return raw;
    return `${R2_PUBLIC_BASE}/${bucket}/${objectPath}${url.search}`;
  } catch {
    return raw;
  }
}
