import type { ReelItem } from "../types/reels";
import { fetchPublicReels, loadCachedPublicReels, saveCachedPublicReels } from "./reelsApi";
import {
  REELS_FEED_FRESH_MS,
  buildFeedOrder,
  feedAgeMs,
  markFeedFetched,
  readResume,
  readSeen,
} from "../utils/reelsFeedLogic";
import { isInstagramUrl } from "../utils/instagramFetcher";

/**
 * Warms the Reels feed while the customer is still on the home screen:
 *  1. the published feed is fetched (or taken from cache) and stored for instant display;
 *  2. the posters of the first reels are decoded;
 *  3. the first video starts buffering (a single <video>, never more).
 *
 * Skipped on admin routes, Data Saver and slow (2g/3g) connections.
 * Kill switch: VITE_REELS_PREWARM=0 at build time, or localStorage guli_reels_prewarm_off=1.
 */

const WARM_POSTERS = 3;
const RELEASE_VIDEO_AFTER_MS = 90_000;

let started = false;
let warmVideo: HTMLVideoElement | null = null;
let releaseTimer: number | null = null;
const posterHolders: HTMLImageElement[] = [];

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

function connection(): NetworkInfo | undefined {
  return (navigator as Navigator & { connection?: NetworkInfo }).connection;
}

function isDisabled(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  if (import.meta.env.VITE_REELS_PREWARM === "0") return true;
  const path = window.location.pathname.replace(/\/$/, "");
  if (path.endsWith("/admin") || window.location.search.includes("admin") || window.location.hash === "#admin") return true;
  try {
    if (localStorage.getItem("guli_reels_prewarm_off") === "1") return true;
  } catch {
    // storage unavailable
  }
  return false;
}

function isSlowNetwork(): boolean {
  const c = connection();
  if (!c) return false;
  return Boolean(c.saveData) || /(^|-)[23]g$/.test(c.effectiveType || "");
}

function releaseWarmVideo(): void {
  if (releaseTimer !== null) window.clearTimeout(releaseTimer);
  releaseTimer = null;
  if (!warmVideo) return;
  warmVideo.removeAttribute("src");
  warmVideo.load();
  warmVideo = null;
}

/** Decodes the first posters and buffers the first playable video. */
export function warmReelsMedia(ordered: readonly ReelItem[]): void {
  if (isDisabled() || isSlowNetwork() || ordered.length === 0) return;

  for (const reel of ordered.slice(0, WARM_POSTERS)) {
    if (!reel.posterUrl) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = reel.posterUrl;
    posterHolders.push(img);
  }
  if (posterHolders.length > 12) posterHolders.splice(0, posterHolders.length - 12);

  const first = ordered.find((r) => r.videoUrl && !isInstagramUrl(r.videoUrl));
  if (!first || (warmVideo && warmVideo.src === first.videoUrl)) return;
  releaseWarmVideo();
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = first.videoUrl;
  video.load();
  warmVideo = video;
  // The player in the feed takes over; do not keep a decoder allocated forever.
  releaseTimer = window.setTimeout(releaseWarmVideo, RELEASE_VIDEO_AFTER_MS);
}

async function refreshAndWarm(): Promise<void> {
  try {
    let list = loadCachedPublicReels();
    if (list.length === 0 || feedAgeMs() >= REELS_FEED_FRESH_MS) {
      const all = await fetchPublicReels();
      list = all.filter((r) => r.status === "active" && Boolean(r.videoUrl));
      saveCachedPublicReels(list);
      markFeedFetched();
    }
    warmReelsMedia(buildFeedOrder(list, readSeen(), readResume()));
  } catch (error) {
    // Warm-up is best effort; the feed itself retries and shows its own error state.
    console.warn("[Reels] Prefetch skipped:", error);
  }
}

/** Idempotent. Call once at app start; runs when the browser is idle. */
export function scheduleReelsWarmup(): void {
  if (started || isDisabled()) return;
  started = true;

  // Media of the previous session can be warmed immediately from the cached feed.
  const cached = loadCachedPublicReels();
  if (cached.length > 0) warmReelsMedia(buildFeedOrder(cached, readSeen(), readResume()));

  const run = () => void refreshAndWarm();
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === "function") idle.call(window, run, { timeout: 4000 });
  else window.setTimeout(run, 1500);
}
