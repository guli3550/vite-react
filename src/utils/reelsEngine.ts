/**
 * Core utility functions for Guli Market Instagram-style Reels feed.
 * Includes preload window calculation, swipe evaluation, and author normalization.
 */

export interface NormalizedAuthor {
  name: string;
  username: string;
  avatar: string;
  verified: boolean;
}

/**
 * Normalizes author data to standard "Guli Market" branding.
 * Always renders uniform Guli Market logo and "Guli Market" brand name.
 */
export function normalizeReelAuthor(author?: Partial<NormalizedAuthor>): NormalizedAuthor {
  return {
    name: "Guli Market",
    username: author?.username || "gulii.uz",
    avatar: author?.avatar && author.avatar.startsWith("/") ? author.avatar : "/guli-logo.png",
    verified: true,
  };
}

/**
 * Calculates which reel indices to preload:
 * - When index = 0: preloads [0, 1, 2] (initial 3 reels: metadata/poster/video)
 * - When index = 1: preloads [1, 2, 3]
 * - When index = 2: preloads [2, 3, 4]
 * - Keeps adjacent window so only active + next 2 reels (and optional prev 1) are loaded.
 */
export function getPreloadWindow(
  currentIndex: number,
  totalCount: number,
  aheadCount = 2,
  keepPrevious = 1
): number[] {
  if (totalCount <= 0) return [];
  const start = Math.max(0, currentIndex - keepPrevious);
  const end = Math.min(totalCount - 1, currentIndex + aheadCount);

  const windowIndices: number[] = [];
  for (let i = start; i <= end; i++) {
    windowIndices.push(i);
  }
  return windowIndices;
}

/**
 * Check if a given reel index should have video media mounted with metadata preloading.
 */
export function isIndexPreloaded(
  index: number,
  currentIndex: number,
  totalCount: number,
  aheadCount = 2,
  keepPrevious = 1
): boolean {
  const windowIndices = getPreloadWindow(currentIndex, totalCount, aheadCount, keepPrevious);
  return windowIndices.includes(index);
}

/**
 * Evaluates swipe vertical gesture based on drag displacement.
 * deltaY is (startY - currentY). Positive = dragged UP (next), Negative = dragged DOWN (prev).
 */
export function evaluateSwipeGesture(
  deltaY: number,
  threshold = 45
): "next" | "prev" | "none" {
  if (deltaY > threshold) return "next";
  if (deltaY < -threshold) return "prev";
  return "none";
}

/**
 * Clamps progress percentage between 0 and 100%.
 */
export function calculateVideoProgress(currentTime: number, duration: number): number {
  if (!duration || duration <= 0 || isNaN(currentTime) || isNaN(duration)) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/**
 * Evaluates drag gestures on the comments bottom sheet handle.
 * deltaY is (startY - currentY). Positive = dragged UP, Negative = dragged DOWN.
 */
export type CommentsSheetHeight = "collapsed" | "expanded";

export function evaluateCommentsSheetDrag(
  currentHeight: CommentsSheetHeight,
  deltaY: number,
  expandThreshold = 40,
  collapseThreshold = 40,
  closeThreshold = 55
): CommentsSheetHeight | "close" | "none" {
  if (currentHeight === "collapsed") {
    if (deltaY > expandThreshold) return "expanded";
    if (deltaY < -closeThreshold) return "close";
    return "none";
  }
  if (currentHeight === "expanded") {
    if (deltaY < -collapseThreshold) return "collapsed";
    return "none";
  }
  return "none";
}

