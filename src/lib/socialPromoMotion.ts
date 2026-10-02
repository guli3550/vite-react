// Pure helpers for the Social Promo expand/marquee UX and its admin speed settings.
// No React, DOM or imports on purpose: this file is unit-tested with Node's built-in
// runner (`npm test` -> tests/socialPromoMotion.test.mjs), so keep it erasable TypeScript
// (no enums, namespaces or constructor parameter properties).

export const MIN_DURATION_SECONDS = 5;
export const MAX_DURATION_SECONDS = 180;
export const FALLBACK_DURATION_SECONDS = 35;

/** Customer UI re-reads /api/social-promos at this interval while the page is visible. */
export const REFRESH_INTERVAL_MS = 60000;
/** Never hit the API more often than this, even if focus/visibility events burst. */
export const MIN_REFRESH_GAP_MS = 5000;
/** Admin speed input auto-saves only after the value has been stable for this long. */
export const SAVE_DEBOUNCE_MS = 800;

export const ROW_STAGGER_MS = 90;
export const ROW_REVEAL_MS = 460;
export const REDUCED_FADE_MS = 250;
/** Marquee cards are repeated until the group is roughly this wide per card (px). */
export const CARD_PITCH_PX = 170;

export type MarqueeDirection = "left" | "right";

export interface RowSettingInput {
  row_number?: unknown;
  is_enabled?: unknown;
  direction?: unknown;
  duration_seconds?: unknown;
}

export interface ResolvedRowSetting {
  rowNumber: number;
  isEnabled: boolean;
  direction: MarqueeDirection;
  durationSeconds: number;
}

export function defaultDurationForRow(rowNumber: number): number {
  return rowNumber === 2 ? 42 : rowNumber === 3 ? 36 : 34;
}

export function defaultDirectionForRow(rowNumber: number): MarqueeDirection {
  return rowNumber === 2 ? "right" : "left";
}

/** Round and clamp to the supported 5-180 second range. Non-finite input -> fallback. */
export function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return FALLBACK_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(value)));
}

/**
 * Turn whatever the API/DB returned into a safe duration in seconds.
 * null/undefined/empty/NaN/non-positive -> fallback; otherwise clamped to 5-180.
 */
export function normalizeDuration(raw: unknown, fallback: number): number {
  const safeFallback = clampDuration(fallback);
  if (typeof raw !== "number" && typeof raw !== "string") return safeFallback;
  if (typeof raw === "string" && raw.trim() === "") return safeFallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return safeFallback;
  return clampDuration(n);
}

export function findRowSetting<T extends RowSettingInput>(
  settings: readonly T[] | null | undefined,
  rowNumber: number
): T | undefined {
  if (!settings) return undefined;
  return settings.find((s) => Number(s?.row_number) === rowNumber);
}

export function resolveRowSetting(
  setting: RowSettingInput | null | undefined,
  rowNumber: number
): ResolvedRowSetting {
  const s: RowSettingInput = setting ?? {};
  return {
    rowNumber,
    isEnabled: s.is_enabled !== false,
    direction:
      s.direction === "right" ? "right" : s.direction === "left" ? "left" : defaultDirectionForRow(rowNumber),
    durationSeconds: normalizeDuration(s.duration_seconds, defaultDurationForRow(rowNumber)),
  };
}

export type DurationDraftStatus = "empty" | "invalid" | "out_of_range" | "ok";

export interface DurationDraftResult {
  status: DurationDraftStatus;
  /** Value that is safe to save (clamped for out_of_range); null for empty/invalid. */
  value: number | null;
}

/** Classify the raw text typed in the admin speed field. Empty/garbage must never be saved. */
export function classifyDurationDraft(draft: string): DurationDraftResult {
  const text = String(draft ?? "").trim();
  if (text === "") return { status: "empty", value: null };
  const n = Number(text);
  if (!Number.isFinite(n)) return { status: "invalid", value: null };
  const rounded = Math.round(n);
  if (rounded < MIN_DURATION_SECONDS || rounded > MAX_DURATION_SECONDS) {
    return { status: "out_of_range", value: clampDuration(rounded) };
  }
  return { status: "ok", value: rounded };
}

export interface LatestGate {
  next(): number;
  isLatest(token: number): boolean;
}

/** Ordering guard: only the response of the most recently started request may be applied. */
export function createLatestGate(): LatestGate {
  let latest = 0;
  return {
    next(): number {
      latest += 1;
      return latest;
    },
    isLatest(token: number): boolean {
      return token === latest;
    },
  };
}

export function marqueeAnimationName(rowNumber: number, direction: MarqueeDirection): string {
  return direction === "right" ? `guliMarqueeRight_${rowNumber}` : `guliMarqueeLeft_${rowNumber}`;
}

/** Value of the CSS `animation` property: duration is always in whole seconds. */
export function marqueeAnimationValue(
  rowNumber: number,
  direction: MarqueeDirection,
  durationSeconds: number
): string {
  return `${marqueeAnimationName(rowNumber, direction)} ${clampDuration(durationSeconds)}s linear infinite`;
}

export function minCardsForWidth(viewportWidth: number): number {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0;
  return Math.min(40, Math.max(5, Math.ceil(w / CARD_PITCH_PX) + 1));
}

/** Repeat the items (in order) until at least `minCards` cards exist. */
export function buildDisplayList<T>(items: readonly T[], minCards: number): T[] {
  if (items.length === 0) return [];
  const target = Math.min(40, Math.max(1, Math.floor(minCards)));
  const out: T[] = [...items];
  while (out.length < target) out.push(...items);
  return out;
}

/** Left-to-right on open (row 0 first); reverse order on close (last row first). */
export function revealDelayMs(rowIndex: number, rowCount: number, open: boolean): number {
  const last = Math.max(rowCount - 1, 0);
  const idx = Math.max(0, Math.min(rowIndex, last));
  const order = open ? idx : last - idx;
  return order * ROW_STAGGER_MS;
}

/** How long the open/close transition runs; links stay inert until it has settled. */
export function transitionTotalMs(rowCount: number, reducedMotion: boolean): number {
  if (reducedMotion) return REDUCED_FADE_MS;
  return Math.max(rowCount - 1, 0) * ROW_STAGGER_MS + ROW_REVEAL_MS + 40;
}
