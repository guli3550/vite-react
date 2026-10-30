export type VideoAdPlacement = "home" | "product_feed" | "all";
export type VideoAdPlatform = "all" | "web" | "telegram";
export type VideoAdEventType = "impression" | "click" | "video_start" | "video_complete";

export interface VideoAd {
  id: string;
  title: string;
  description?: string | null;
  video_url: string;
  poster_url?: string | null;
  cta_text: string;
  destination_url?: string | null;
  product_id?: string | null;
  placement: VideoAdPlacement;
  platform: VideoAdPlatform;
  priority: number;
  frequency_cap: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  // Optional aggregated stats returned in admin views
  stats?: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

export interface VideoAdFormData {
  id?: string;
  title: string;
  description: string;
  video_url: string;
  poster_url: string;
  cta_text: string;
  destination_url: string;
  product_id: string;
  placement: VideoAdPlacement;
  platform: VideoAdPlatform;
  priority: number;
  frequency_cap: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
}

export interface VideoAdStatsSummary {
  total_ads: number;
  active_ads: number;
  total_impressions: number;
  total_clicks: number;
  overall_ctr: number;
}

/**
 * Calculates Click-Through Rate safely, guarding against 0 impressions and division by zero.
 */
export function calculateCtr(clicks: number, impressions: number): number {
  if (!impressions || impressions <= 0 || clicks <= 0) return 0;
  const raw = (clicks / impressions) * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}

/**
 * Validates and sanitizes a destination URL to prevent XSS or dangerous protocols.
 * Allows safe http/https, tg://, or t.me links. Rejects javascript: or data: URIs.
 */
export function sanitizeDestinationUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Reject dangerous schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return "";
  }

  // Allow relative URLs starting with /
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // Allow http/https/tg/t.me
  if (/^(https?:\/\/|tg:\/\/|https?:\/\/t\.me\/)/i.test(trimmed)) {
    return trimmed;
  }

  // If simple domain or relative path, prefix https:// if it looks like domain
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return "";
}

/**
 * Checks whether an ad is currently within its active start and end time window.
 */
export function isAdActiveAndVisible(ad: VideoAd, now = new Date()): boolean {
  if (!ad.is_active) return false;
  if (ad.starts_at) {
    const start = new Date(ad.starts_at);
    if (!isNaN(start.getTime()) && now < start) return false;
  }
  if (ad.ends_at) {
    const end = new Date(ad.ends_at);
    if (!isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}


/**
 * Returns every ad eligible for a given storefront placement, preserving
 * the API's priority/newest ordering. Do not collapse this list to its first item.
 */
export function getAdsForPlacement<T extends Pick<VideoAd, "placement">>(
  ads: T[],
  placement: "home" | "product_feed"
): T[] {
  return ads.filter((ad) => ad.placement === placement || ad.placement === "all");
}
