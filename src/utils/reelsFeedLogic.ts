/**
 * Pure feed logic for the Guli Market Reels feed (no React, no DOM).
 *
 * Rules implemented here:
 *  - A reel is not shown again until every reel of the current cycle was seen.
 *  - When the last reel of a cycle is seen, a new cycle starts (feed never ends).
 *  - Re-opening the app resumes from the last reel the customer was on.
 *  - Background refreshes never reorder the list the customer is watching.
 */

export const REELS_SEEN_KEY = "guli_reels_seen_v2";
export const REELS_RESUME_KEY = "guli_reels_resume_v1";
export const REELS_FETCHED_AT_KEY = "guli_reels_fetched_at_v1";

/** A reel counts as "seen" after it stayed active this long. */
export const REEL_SEEN_AFTER_MS = 1500;
/** The cached feed is considered fresh (no network refresh needed) for this long. */
export const REELS_FEED_FRESH_MS = 2 * 60 * 1000;

type WithId = { id: string };
type StoreLike = Pick<Storage, "getItem" | "setItem">;

export function wrapIndex(index: number, length: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function dedupeById<T extends WithId>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Positions (virtual, unbounded integers) that must be mounted around `pos`.
 * Only previous / current / next are mounted, so at most 3 <video> elements exist.
 */
export function windowPositions(pos: number, length: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [pos];
  return [pos - 1, pos, pos + 1];
}

/**
 * Builds the viewing order of one session.
 * first  = forced reel (opened from a profile) or the resume reel or the first unseen reel;
 * then   = unseen reels in server order starting after `first`;
 * last   = already seen reels (only reached after everything unseen was shown).
 */
export function buildFeedOrder<T extends WithId>(
  input: readonly T[],
  seenIds: readonly string[],
  resumeId?: string | null,
  forceFirstId?: string | null,
): T[] {
  const list = dedupeById(input);
  if (list.length <= 1) return list;

  const ids = new Set(list.map((r) => r.id));
  let seen = new Set(seenIds.filter((id) => ids.has(id)));
  if (seen.size >= ids.size) seen = new Set(); // whole cycle completed -> start a new one

  let startIndex = -1;
  if (forceFirstId && ids.has(forceFirstId)) startIndex = list.findIndex((r) => r.id === forceFirstId);
  else if (resumeId && ids.has(resumeId)) startIndex = list.findIndex((r) => r.id === resumeId);
  if (startIndex < 0) startIndex = Math.max(0, list.findIndex((r) => !seen.has(r.id)));

  const rotated = [...list.slice(startIndex), ...list.slice(0, startIndex)];
  const [first, ...rest] = rotated;
  return [first, ...rest.filter((r) => !seen.has(r.id)), ...rest.filter((r) => seen.has(r.id))];
}

/** Adds `id` to the seen set; when that completes the cycle, a new cycle starts with only `id`. */
export function markSeen(seenIds: readonly string[], id: string, allIds: readonly string[]): string[] {
  const all = new Set(allIds);
  const next = new Set(seenIds.filter((x) => all.has(x)));
  next.add(id);
  if (allIds.length > 0 && allIds.every((x) => next.has(x))) return [id];
  return [...next];
}

/**
 * Merges a fresh server list into the list being watched without reordering it.
 * New reels are inserted right after the current reel; removed reels disappear.
 */
export function mergeFeed<T extends WithId>(
  current: readonly T[],
  fresh: readonly T[],
  currentId: string | null,
): { list: T[]; idsChanged: boolean } {
  const freshList = dedupeById(fresh);
  const freshById = new Map(freshList.map((r) => [r.id, r] as const));
  const kept = current.filter((r) => freshById.has(r.id)).map((r) => freshById.get(r.id) as T);
  const keptIds = new Set(kept.map((r) => r.id));
  const added = freshList.filter((r) => !keptIds.has(r.id));
  const removed = kept.length !== current.length;
  if (!added.length && !removed) return { list: kept, idsChanged: false };
  const at = currentId ? kept.findIndex((r) => r.id === currentId) : -1;
  const insertAt = at === -1 ? kept.length : at + 1;
  return { list: [...kept.slice(0, insertAt), ...added, ...kept.slice(insertAt)], idsChanged: true };
}

function defaultStore(): StoreLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readSeen(store: StoreLike | null = defaultStore()): string[] {
  try {
    const parsed = JSON.parse(store?.getItem(REELS_SEEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeSeen(ids: readonly string[], store: StoreLike | null = defaultStore()): void {
  try {
    store?.setItem(REELS_SEEN_KEY, JSON.stringify(ids.slice(-500)));
  } catch {
    // storage may be unavailable in restricted WebViews
  }
}

export function readResume(store: StoreLike | null = defaultStore()): string | null {
  try {
    return store?.getItem(REELS_RESUME_KEY) || null;
  } catch {
    return null;
  }
}

export function writeResume(id: string, store: StoreLike | null = defaultStore()): void {
  try {
    store?.setItem(REELS_RESUME_KEY, id);
  } catch {
    // ignore
  }
}

export function markFeedFetched(store: StoreLike | null = defaultStore(), now = Date.now()): void {
  try {
    store?.setItem(REELS_FETCHED_AT_KEY, String(now));
  } catch {
    // ignore
  }
}

export function feedAgeMs(store: StoreLike | null = defaultStore(), now = Date.now()): number {
  try {
    const at = Number(store?.getItem(REELS_FETCHED_AT_KEY) || 0);
    return at > 0 ? Math.max(0, now - at) : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
