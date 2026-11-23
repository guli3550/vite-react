import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCategoryShowcaseMap,
  pickNextRotatableCategory,
} from "../src/utils/categoryShowcase.ts";
import {
  buildProductQueryKey,
  getCachedProductQuery,
  invalidateProductQueryCache,
  runDeduplicatedProductQuery,
} from "../src/utils/productQueryCache.ts";

test("buildCategoryShowcaseMap groups active product primary images by normalized category in one pass", () => {
  const categories = [
    { name: "Barchasi" },
    { name: "Penyuar" },
    { name: "Pijama" },
    { name: "Tursik" },
    { name: "Yangi Toifa" },
  ];

  const products = [
    {
      id: 1,
      name: "Atlas Penyuar",
      category: "pinyuar",
      price: 180000,
      image: "https://cdn.example.com/1.jpg",
      images: ["https://cdn.example.com/1-alt.jpg"],
      active: true,
    },
    {
      id: 2,
      name: "Ipak Pijama",
      category: "Pijama",
      price: 210000,
      image: "",
      images: ["https://cdn.example.com/2.jpg"],
      active: true,
    },
    {
      id: 3,
      name: "Yashirin Tovar",
      category: "Penyuar",
      price: 99000,
      image: "https://cdn.example.com/3.jpg",
      active: false,
    },
    {
      id: 4,
      name: "Rasmi Yo'q Tovar",
      category: "Pijama",
      price: 95000,
      image: "",
      images: [],
      active: true,
    },
    {
      id: 5,
      name: "Sport Tursik",
      category: "trusik",
      price: 55000,
      image: "https://cdn.example.com/5.jpg",
      active: true,
    },
    {
      id: 6,
      name: "Maxsus Toifa",
      category: "Yangi Toifa",
      price: 300000,
      image: "https://cdn.example.com/6.jpg",
      active: true,
    },
  ];

  const map = buildCategoryShowcaseMap(categories, products);
  assert.equal(map.Barchasi, undefined);
  assert.equal(map.Penyuar.length, 1);
  assert.equal(map.Penyuar[0].title, "Atlas Penyuar");
  assert.equal(map.Pijama.length, 1);
  assert.equal(map.Pijama[0].imageUrl, "https://cdn.example.com/2.jpg");
  assert.equal(map.Tursik.length, 1);
  assert.equal(map["Yangi Toifa"].length, 1);
});

test("pickNextRotatableCategory skips single-item categories and cycles round-robin", () => {
  const names = ["Penyuar", "Pijama", "Mayka", "Tursik"];
  const showcaseMap = {
    Penyuar: [{ title: "A" }],
    Pijama: [{ title: "B1" }, { title: "B2" }],
    Mayka: [],
    Tursik: [{ title: "D1" }, { title: "D2" }],
  };

  const first = pickNextRotatableCategory(names, showcaseMap, 0);
  assert.deepEqual(first, { categoryName: "Pijama", nextCursor: 2 });

  const second = pickNextRotatableCategory(names, showcaseMap, first.nextCursor);
  assert.deepEqual(second, { categoryName: "Tursik", nextCursor: 0 });

  const none = pickNextRotatableCategory(
    names,
    { Penyuar: [{ title: "Only" }], Pijama: [], Mayka: [], Tursik: [] },
    0,
  );
  assert.equal(none, null);
});

test("productQueryCache serves cached results within TTL and deduplicates concurrent requests", async () => {
  invalidateProductQueryCache();
  const key = buildProductQueryKey({
    category: "Penyuar",
    search: " Silk ",
    limit: 40,
    offset: 0,
  });
  assert.equal(key, "Penyuar|silk|40|0");

  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return { rows: [{ id: 101 }], hasMore: false };
  };

  const [res1, res2] = await Promise.all([
    runDeduplicatedProductQuery(key, fetcher, { now: 1000 }),
    runDeduplicatedProductQuery(key, fetcher, { now: 1005 }),
  ]);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(res1, res2);

  // Subsequent hit within TTL uses memory cache with 0 server fetches
  const res3 = await runDeduplicatedProductQuery(key, fetcher, {
    now: Date.now() + 1000,
    ttlMs: 60_000,
  });
  assert.equal(fetchCalls, 1);
  assert.equal(res3.rows.length, 1);

  // Expired cache triggers fresh request
  assert.equal(getCachedProductQuery(key, Date.now() + 120_000, 60_000), null);

  // forceRefresh bypasses cache
  await runDeduplicatedProductQuery(key, fetcher, { forceRefresh: true });
  assert.equal(fetchCalls, 2);

  invalidateProductQueryCache();
  assert.equal(getCachedProductQuery(key), null);
});
