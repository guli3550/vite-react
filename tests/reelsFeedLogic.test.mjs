import test from "node:test";
import assert from "node:assert/strict";
import {
  wrapIndex, dedupeById, windowPositions, buildFeedOrder, markSeen, mergeFeed,
  readSeen, writeSeen, readResume, writeResume, feedAgeMs, markFeedFetched,
} from "../src/utils/reelsFeedLogic.ts";

const R = (...ids) => ids.map((id) => ({ id, n: id }));
const ids = (list) => list.map((r) => r.id);
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)) }; };

test("wrapIndex wraps both directions and handles empty lists", () => {
  assert.equal(wrapIndex(5, 5), 0);
  assert.equal(wrapIndex(-1, 5), 4);
  assert.equal(wrapIndex(-6, 5), 4);
  assert.equal(wrapIndex(3, 0), 0);
});

test("dedupeById keeps first occurrence", () => {
  assert.deepEqual(ids(dedupeById([{ id: "a" }, { id: "b" }, { id: "a" }])), ["a", "b"]);
});

test("windowPositions mounts at most 3 slides and 1 for a single reel", () => {
  assert.deepEqual(windowPositions(0, 5), [-1, 0, 1]);
  assert.deepEqual(windowPositions(7, 2), [6, 7, 8]);
  assert.deepEqual(windowPositions(0, 1), [0]);
  assert.deepEqual(windowPositions(0, 0), []);
});

test("buildFeedOrder: fresh install keeps server order", () => {
  assert.deepEqual(ids(buildFeedOrder(R("a", "b", "c", "d"), [], null)), ["a", "b", "c", "d"]);
});

test("buildFeedOrder: resumes from the last watched reel, unseen before seen", () => {
  const out = buildFeedOrder(R("a", "b", "c", "d", "e"), ["a", "b", "c"], "c");
  assert.deepEqual(ids(out), ["c", "d", "e", "a", "b"]);
});

test("buildFeedOrder: seen reels are never ahead of unseen reels", () => {
  const out = ids(buildFeedOrder(R("a", "b", "c", "d", "e"), ["a", "d"], "b"));
  assert.equal(out[0], "b");
  assert.deepEqual(out.slice(1, 3).sort(), ["c", "e"]);
  assert.deepEqual(out.slice(3).sort(), ["a", "d"]);
});

test("buildFeedOrder: a completed cycle starts over from the resume reel", () => {
  const out = buildFeedOrder(R("a", "b", "c"), ["a", "b", "c"], "b");
  assert.deepEqual(ids(out), ["b", "c", "a"]);
});

test("buildFeedOrder: forced reel (opened from profile) wins over resume", () => {
  assert.equal(buildFeedOrder(R("a", "b", "c"), [], "a", "c")[0].id, "c");
});

test("buildFeedOrder: unknown resume id falls back to first unseen", () => {
  assert.equal(buildFeedOrder(R("a", "b", "c"), ["a"], "gone")[0].id, "b");
});

test("buildFeedOrder: newly added reel is unseen and shows before seen ones", () => {
  const out = ids(buildFeedOrder(R("new", "a", "b"), ["a", "b"], "b"));
  assert.deepEqual(out, ["b", "new", "a"]);
});

test("markSeen accumulates, ignores removed reels and restarts the cycle when complete", () => {
  assert.deepEqual(markSeen([], "a", ["a", "b", "c"]), ["a"]);
  assert.deepEqual(markSeen(["a", "zzz"], "b", ["a", "b", "c"]), ["a", "b"]);
  assert.deepEqual(markSeen(["a", "b"], "c", ["a", "b", "c"]), ["c"]);
  assert.deepEqual(markSeen(["a"], "a", ["a"]), ["a"]);
});

test("mergeFeed: data-only refresh keeps order and updates fields", () => {
  const cur = [{ id: "a", likes: 1 }, { id: "b", likes: 1 }];
  const { list, idsChanged } = mergeFeed(cur, [{ id: "b", likes: 9 }, { id: "a", likes: 5 }], "a");
  assert.equal(idsChanged, false);
  assert.deepEqual(list, [{ id: "a", likes: 5 }, { id: "b", likes: 9 }]);
});

test("mergeFeed: new reels go right after the current reel, removed reels vanish", () => {
  const { list, idsChanged } = mergeFeed(R("a", "b", "c"), R("a", "b", "c", "x", "y"), "b");
  assert.equal(idsChanged, true);
  assert.deepEqual(ids(list), ["a", "b", "x", "y", "c"]);
  const removed = mergeFeed(R("a", "b", "c"), R("a", "c"), "b");
  assert.deepEqual(ids(removed.list), ["a", "c"]);
  assert.equal(removed.idsChanged, true);
});

test("storage helpers round-trip and survive broken storage", () => {
  const s = memory();
  assert.deepEqual(readSeen(s), []);
  writeSeen(["a", "b"], s);
  assert.deepEqual(readSeen(s), ["a", "b"]);
  assert.equal(readResume(s), null);
  writeResume("b", s);
  assert.equal(readResume(s), "b");
  s.setItem("guli_reels_seen_v2", "{not json");
  assert.deepEqual(readSeen(s), []);
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.deepEqual(readSeen(broken), []);
  assert.equal(readResume(broken), null);
  assert.doesNotThrow(() => writeSeen(["a"], broken));
  assert.doesNotThrow(() => writeResume("a", broken));
});

test("feedAgeMs: unknown -> Infinity, then measures elapsed time", () => {
  const s = memory();
  assert.equal(feedAgeMs(s, 1000), Number.POSITIVE_INFINITY);
  markFeedFetched(s, 1000);
  assert.equal(feedAgeMs(s, 4000), 3000);
});

test("simulation: full viewing session never repeats before the cycle ends, then loops", () => {
  const all = R("a", "b", "c", "d", "e");
  const store = memory();
  let order = buildFeedOrder(all, readSeen(store), readResume(store));
  const shown = [];
  for (let step = 0; step < 5; step++) {
    const r = order[wrapIndex(step, order.length)];
    shown.push(r.id);
    writeResume(r.id, store);
    writeSeen(markSeen(readSeen(store), r.id, ids(all)), store);
  }
  assert.equal(new Set(shown).size, 5, "no repeats inside one cycle");
  // customer closes the app on the 3rd reel and returns
  const store2 = memory();
  const firstThree = ["a", "b", "c"];
  firstThree.forEach((id) => { writeResume(id, store2); writeSeen(markSeen(readSeen(store2), id, ids(all)), store2); });
  const resumed = buildFeedOrder(all, readSeen(store2), readResume(store2));
  assert.equal(resumed[0].id, "c");
  assert.deepEqual(ids(resumed).slice(1), ["d", "e", "a", "b"]);
});
