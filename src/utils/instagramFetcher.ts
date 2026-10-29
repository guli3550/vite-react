export interface InstagramReelData {
  shortcode: string;
  videoUrl: string;
  posterUrl: string;
  caption: string;
  authorName: string;
  authorUsername: string;
}

/**
 * Checks if a given string is a valid Instagram post/reel URL
 */
export function isInstagramUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    /instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.test(url) ||
    /instagr\.am\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.test(url)
  );
}

/**
 * Extracts shortcode (post ID) from Instagram reel or post link
 */
export function extractInstagramShortcode(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const match =
    url.match(/instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) ||
    url.match(/instagr\.am\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[2] : null;
}

/** Instagram page URLs are not direct video files; never substitute unrelated demo videos. */

/**
 * Fetches and processes Instagram Reel media, poster image, and post caption automatically
 */
export async function fetchInstagramReelData(url: string): Promise<InstagramReelData | null> {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) return null;

  let caption = "";
  let authorName = "Guli Market Official";
  const authorUsername = "gulii.uz";

  // Try fetching public oEmbed information for caption and author
  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.title && typeof data.title === "string") {
        caption = data.title.trim();
      }
      if (data.author_name && typeof data.author_name === "string") {
        authorName = data.author_name.trim();
      }
    }
  } catch (e) {
    console.warn("Instagram oEmbed auto-fetch note:", e);
  }

  // Use wsrv.nl CORS image proxy to bypass Instagram 403 hotlink blocks on browsers
  const rawPosterUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  const posterUrl = `https://wsrv.nl/?url=${encodeURIComponent(
    rawPosterUrl
  )}&default=https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format%26fit=crop%26w=900%26q=80`;

  // Instagram oEmbed provides metadata/poster only. It does not provide the actual MP4.
  // Do not silently substitute a sample video: the admin must upload the real file
  // or supply a direct, publicly playable video URL.
  const videoUrl = "";

  return {
    shortcode,
    videoUrl,
    posterUrl,
    caption: caption || `Guli Market — Instagram Reel (${shortcode}) ✨ #gulimarket #fashion #lingerie`,
    authorName,
    authorUsername,
  };
}

