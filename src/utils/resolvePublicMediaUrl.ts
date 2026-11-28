/**
 * Resolve legacy public Supabase Storage URLs to their verified Cloudflare R2
 * public-object equivalents. Private/signed URLs are deliberately untouched.
 *
 * R2 copy layout: <source-bucket>/<original-object-key>
 * Example: product-images/products/item.webp
 */
const R2_PUBLIC_BASE = "https://media.gulii.uz";
const R2_DEVELOPMENT_BASE = "https://pub-03a02e4eb19747dfb7e440384ccc3a7f.r2.dev";
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
    return `${R2_PUBLIC_BASE}/${bucket}/${objectPath}${url.search}`;
  } catch {
    return raw;
  }
}


/**
 * Preview-only fallback for diagnosing intermittent Custom Domain resets.
 * Production never uses the rate-limited R2 Development URL.
 */
export function getPreviewR2FallbackUrl(value: unknown): string | null {
  if (typeof window === "undefined" || !window.location.hostname.endsWith(".vercel.app")) {
    return null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname !== "media.gulii.uz" || url.protocol !== "https:") return null;
    return `${R2_DEVELOPMENT_BASE}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
