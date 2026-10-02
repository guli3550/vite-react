// Pure-logic tests for the Social Promo motion/settings helpers.
// Run: npm test  (node --experimental-strip-types --test tests/*.test.mjs)
// These are logic tests only: they are NOT real-browser, 320px or Telegram WebView tests.

import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  clampDuration,
  normalizeDuration,
  findRowSetting,
  resolveRowSetting,
  classifyDurationDraft,
  createLatestGate,
  marqueeAnimationName,
  marqueeAnimationValue,
  minCardsForWidth,
  buildDisplayList,
  revealDelayMs,
  transitionTotalMs,
  defaultDurationForRow,
} from "../src/lib/socialPromoMotion.ts";

const DB_SETTINGS = [
  { row_number: 1, is_enabled: true, direction: "left", duration_seconds: 30 },
  { row_number: 2, is_enabled: true, direction: "right", duration_seconds: 40 },
  { row_number: 3, is_enabled: true, direction: "left", duration_seconds: 35 },
];

test("range is unified to 5-180 seconds", () => {
  assert.equal(MIN_DURATION_SECONDS, 5);
  assert.equal(MAX_DURATION_SECONDS, 180);
  assert.equal(clampDuration(1), 5);
  assert.equal(clampDuration(5), 5);
  assert.equal(clampDuration(180), 180);
  assert.equal(clampDuration(999), 180);
  assert.equal(clampDuration(29.6), 30);
});

test("admin 30/40/35 reach the frontend per row, in seconds", () => {
  const r1 = resolveRowSetting(findRowSetting(DB_SETTINGS, 1), 1);
  const r2 = resolveRowSetting(findRowSetting(DB_SETTINGS, 2), 2);
  const r3 = resolveRowSetting(findRowSetting(DB_SETTINGS, 3), 3);
  assert.deepEqual([r1.durationSeconds, r2.durationSeconds, r3.durationSeconds], [30, 40, 35]);
  assert.deepEqual([r1.direction, r2.direction, r3.direction], ["left", "right", "left"]);
});

test("DB values win over code defaults (34/42/36)", () => {
  const r = resolveRowSetting({ row_number: 1, duration_seconds: 30 }, 1);
  assert.equal(r.durationSeconds, 30);
  assert.notEqual(r.durationSeconds, defaultDurationForRow(1));
});

test("string row_number from the API still maps to the right row", () => {
  const rows = [{ row_number: "2", duration_seconds: 41 }];
  assert.equal(findRowSetting(rows, 2)?.duration_seconds, 41);
  assert.equal(findRowSetting(rows, 1), undefined);
});

test("missing/invalid values fall back safely", () => {
  assert.equal(resolveRowSetting(undefined, 1).durationSeconds, 34);
  assert.equal(resolveRowSetting(undefined, 2).durationSeconds, 42);
  assert.equal(resolveRowSetting(undefined, 3).durationSeconds, 36);
  for (const bad of [null, undefined, "", "   ", "abc", NaN, 0, -3, {}, true]) {
    assert.equal(normalizeDuration(bad, 34), 34, `fallback for ${String(bad)}`);
  }
  assert.equal(normalizeDuration(3, 34), 5);
  assert.equal(normalizeDuration(500, 34), 180);
  assert.equal(normalizeDuration("42", 34), 42);
});

test("is_enabled false disables a row; anything else keeps it on", () => {
  assert.equal(resolveRowSetting({ is_enabled: false }, 1).isEnabled, false);
  assert.equal(resolveRowSetting({}, 1).isEnabled, true);
});

test("changing the value changes the CSS animation duration", () => {
  assert.equal(marqueeAnimationValue(1, "left", 30), "guliMarqueeLeft_1 30s linear infinite");
  assert.equal(marqueeAnimationValue(1, "left", 60), "guliMarqueeLeft_1 60s linear infinite");
  assert.equal(marqueeAnimationValue(2, "right", 40), "guliMarqueeRight_2 40s linear infinite");
  assert.equal(marqueeAnimationValue(3, "left", 2), "guliMarqueeLeft_3 5s linear infinite");
  assert.equal(marqueeAnimationName(2, "right"), "guliMarqueeRight_2");
});

test("admin draft: empty and garbage are never saved", () => {
  assert.deepEqual(classifyDurationDraft(""), { status: "empty", value: null });
  assert.deepEqual(classifyDurationDraft("   "), { status: "empty", value: null });
  assert.deepEqual(classifyDurationDraft("abc"), { status: "invalid", value: null });
});

test("admin draft: range handling 5-180", () => {
  assert.deepEqual(classifyDurationDraft("30"), { status: "ok", value: 30 });
  assert.deepEqual(classifyDurationDraft("5"), { status: "ok", value: 5 });
  assert.deepEqual(classifyDurationDraft("180"), { status: "ok", value: 180 });
  assert.deepEqual(classifyDurationDraft("3"), { status: "out_of_range", value: 5 });
  assert.deepEqual(classifyDurationDraft("181"), { status: "out_of_range", value: 180 });
  assert.deepEqual(classifyDurationDraft("30.4"), { status: "ok", value: 30 });
});

test("out-of-order responses cannot overwrite a newer value", () => {
  const gate = createLatestGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(gate.isLatest(first), false, "older response is stale");
  assert.equal(gate.isLatest(second), true);
  const third = gate.next();
  assert.equal(gate.isLatest(second), false);
  assert.equal(gate.isLatest(third), true);
});

test("display list repeats items in order and covers wide screens", () => {
  const items = ["a", "b"];
  assert.deepEqual(buildDisplayList(items, 5), ["a", "b", "a", "b", "a", "b"]);
  assert.deepEqual(buildDisplayList([], 5), []);
  assert.ok(minCardsForWidth(320) >= 5);
  assert.ok(minCardsForWidth(1440) * 170 >= 1440);
  assert.ok(buildDisplayList(items, minCardsForWidth(1440)).length >= minCardsForWidth(1440));
  assert.equal(minCardsForWidth(Number.NaN), 5);
  assert.ok(minCardsForWidth(1e9) <= 40);
});

test("rows open in order and close in reverse order", () => {
  const open = [0, 1, 2].map((i) => revealDelayMs(i, 3, true));
  const close = [0, 1, 2].map((i) => revealDelayMs(i, 3, false));
  assert.deepEqual(open, [0, 90, 180]);
  assert.deepEqual(close, [180, 90, 0]);
  assert.equal(revealDelayMs(0, 1, true), 0);
  assert.equal(revealDelayMs(5, 0, false), 0);
});

test("reduced motion uses a short fade, normal motion waits for the stagger", () => {
  assert.equal(transitionTotalMs(3, true), 250);
  assert.ok(transitionTotalMs(3, false) > transitionTotalMs(1, false));
  assert.ok(transitionTotalMs(0, false) > 0);
});
