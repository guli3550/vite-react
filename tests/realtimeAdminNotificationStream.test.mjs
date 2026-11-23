import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_STREAM_PAGE_SIZE,
  computeNextPaginationState,
  filterStreamItems,
  formatStreamTimestamp,
  mapOrderToStreamItem,
  markAdminStreamReadIds,
  mergePaginatedOrderItems,
  readAdminStreamReadIds,
  shouldFetchStreamPage,
} from "../src/admin/utils/adminNotificationStreamLogic.ts";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
  };
}

test("mapOrderToStreamItem normalizes customer, item summary, and total", () => {
  const item = mapOrderToStreamItem({
    id: 42,
    order_number: "GL-1042",
    first_name: "Madina",
    last_name: "Karimova",
    phone: "+998901234567",
    total: 350000,
    payment: "Karta",
    payment_status: "receipt_uploaded",
    status: "Qabul qilindi",
    created_at: "2026-04-02T10:00:00.000Z",
    items: [
      { qty: 2, product: { name: "Satin Pyjama", image: "/img1.webp" } },
      { qty: 1, product: { name: "Silk Robe", image: "/img2.webp" } },
    ],
  });

  assert.ok(item);
  assert.equal(item.orderId, "42");
  assert.equal(item.orderNumber, "GL-1042");
  assert.equal(item.customerName, "Madina Karimova");
  assert.equal(item.itemsCount, 3);
  assert.equal(item.firstProductTitle, "Satin Pyjama");
  assert.equal(item.firstProductImage, "/img1.webp");
  assert.equal(item.eventType, "payment_update");
  assert.equal(item.read, false);
});

test("mergePaginatedOrderItems deduplicates paginated pages and prepends realtime updates smoothly", () => {
  const page1 = [
    { id: 10, order_number: "GL-10", total: 100000, status: "Qabul qilindi", created_at: "2026-04-02T12:00:00Z" },
    { id: 9, order_number: "GL-9", total: 90000, status: "Tayyorlanmoqda", created_at: "2026-04-02T11:00:00Z" },
  ];
  const initial = mergePaginatedOrderItems([], page1, { mode: "prepend" });
  assert.equal(initial.addedCount, 2);
  assert.equal(initial.items.length, 2);

  // Append page 2 with an overlapping item (#9) and a new older item (#8)
  const page2 = [
    { id: 9, order_number: "GL-9", total: 90000, status: "Tayyorlanmoqda", created_at: "2026-04-02T11:00:00Z" },
    { id: 8, order_number: "GL-8", total: 80000, status: "Yetkazildi", created_at: "2026-04-02T10:00:00Z" },
  ];
  const appended = mergePaginatedOrderItems(initial.items, page2, { mode: "append" });
  assert.equal(appended.addedCount, 1);
  assert.deepEqual(
    appended.items.map((x) => x.orderId),
    ["10", "9", "8"],
  );

  // Realtime INSERT arrives for #11
  const rtInsert = mergePaginatedOrderItems(
    appended.items,
    [{ id: 11, order_number: "GL-11", total: 220000, status: "Qabul qilindi", created_at: "2026-04-02T12:05:00Z" }],
    { mode: "prepend", eventType: "new_order", isRealtimeArrival: true },
  );
  assert.equal(rtInsert.addedCount, 1);
  assert.equal(rtInsert.items[0].orderId, "11");
  assert.equal(rtInsert.items[0].isRealtimeArrival, true);
  assert.equal(rtInsert.items[0].read, false);
});

test("computeNextPaginationState stops pagination cleanly when backend lacks offset support or list ends", () => {
  const page1 = computeNextPaginationState({
    pageSize: ADMIN_STREAM_PAGE_SIZE,
    currentOffset: 0,
    fetchedCount: ADMIN_STREAM_PAGE_SIZE,
    addedCount: ADMIN_STREAM_PAGE_SIZE,
    serverHasMore: true,
  });
  assert.equal(page1.hasMore, true);
  assert.equal(page1.nextOffset, ADMIN_STREAM_PAGE_SIZE);

  // Backend returned full page on offset=15, but zero new items were added (offset ignored fallback)
  const ignoredOffset = computeNextPaginationState({
    pageSize: ADMIN_STREAM_PAGE_SIZE,
    currentOffset: ADMIN_STREAM_PAGE_SIZE,
    fetchedCount: ADMIN_STREAM_PAGE_SIZE,
    addedCount: 0,
  });
  assert.equal(ignoredOffset.hasMore, false);
  assert.equal(ignoredOffset.paginationExhausted, true);

  // Partial last page stops cleanly
  const lastPage = computeNextPaginationState({
    pageSize: ADMIN_STREAM_PAGE_SIZE,
    currentOffset: 15,
    fetchedCount: 6,
    addedCount: 6,
  });
  assert.equal(lastPage.hasMore, false);
});

test("shouldFetchStreamPage prevents overlapping in-flight fetches, hidden tabs, and cooldown bursts", () => {
  const now = 100_000;
  assert.equal(
    shouldFetchStreamPage({ now, lastFetchAt: 0, inFlight: true }),
    false,
  );
  assert.equal(
    shouldFetchStreamPage({ now, lastFetchAt: 0, inFlight: false, visibilityState: "hidden" }),
    false,
  );
  assert.equal(
    shouldFetchStreamPage({ now, lastFetchAt: now - 5_000, inFlight: false, cooldownMs: 12_000 }),
    false,
  );
  assert.equal(
    shouldFetchStreamPage({ now, lastFetchAt: now - 15_000, inFlight: false, cooldownMs: 12_000 }),
    true,
  );
  assert.equal(
    shouldFetchStreamPage({ now, lastFetchAt: now - 3_000, inFlight: false, force: true }),
    true,
  );
});

test("filterStreamItems filters by tab and search query", () => {
  const readSet = new Set(["10"]);
  const { items } = mergePaginatedOrderItems(
    [],
    [
      { id: 10, order_number: "GL-10", first_name: "Malika", status: "Yetkazildi", created_at: "2026-04-02T10:00:00Z" },
      { id: 11, order_number: "GL-11", first_name: "Zarina", status: "Qabul qilindi", created_at: "2026-04-02T11:00:00Z" },
    ],
    { mode: "prepend", readIds: readSet },
  );

  assert.equal(filterStreamItems(items, { filter: "unread" }).length, 1);
  assert.equal(filterStreamItems(items, { filter: "new" }).length, 1);
  assert.equal(filterStreamItems(items, { filter: "all", searchQuery: "malika" }).length, 1);
  assert.equal(filterStreamItems(items, { filter: "all", searchQuery: "gl-11" }).length, 1);
});

test("markAdminStreamReadIds and formatStreamTimestamp persist read state and format dates", () => {
  const storage = createMemoryStorage();
  markAdminStreamReadIds(["10", "GL-10"], 5, storage);
  const loaded = readAdminStreamReadIds(storage);
  assert.equal(loaded.has("10"), true);
  assert.equal(loaded.has("GL-10"), true);

  const now = new Date("2026-04-02T12:10:00.000Z").getTime();
  assert.equal(formatStreamTimestamp("2026-04-02T12:09:40.000Z", now), "Hozirgina");
  assert.equal(formatStreamTimestamp("2026-04-02T12:05:00.000Z", now), "5 daq oldin");
});
