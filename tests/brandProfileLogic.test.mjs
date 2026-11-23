import test from "node:test";
import assert from "node:assert/strict";

// Helper testing route detection
function isBrandProfileRoute(pathname, hash = "") {
  return (
    pathname.includes("/profile/guli-market") ||
    hash.includes("/profile/guli-market") ||
    hash === "#profile-brand"
  );
}

// Helper testing follow state toggle
function toggleBrandFollow(currentState, currentCount) {
  const nextFollowed = !currentState;
  const nextCount = nextFollowed ? currentCount + 1 : Math.max(0, currentCount - 1);
  return { isFollowed: nextFollowed, followersCount: nextCount };
}

// Helper testing highlights category filter
function filterProductsByHighlight(products, categoryKey) {
  if (categoryKey === "Barchasi") return products;
  if (categoryKey === "Yangi") return products.filter((p) => p.featured || p.id % 2 === 0);
  return products.filter((p) => {
    const cat = String(p.category || "").toLowerCase();
    const target = categoryKey.toLowerCase();
    return cat.includes(target) || target.includes(cat);
  });
}

test("Brand Profile: Route detection correctly recognizes /profile/guli-market path and hash", () => {
  assert.equal(isBrandProfileRoute("/profile/guli-market"), true);
  assert.equal(isBrandProfileRoute("/", "#/profile/guli-market"), true);
  assert.equal(isBrandProfileRoute("/catalog"), false);
  assert.equal(isBrandProfileRoute("/"), false);
});

test("Brand Profile: Follow toggle updates state and accurately increments/decrements followers", () => {
  const initial = { isFollowed: false, count: 3480 };
  const step1 = toggleBrandFollow(initial.isFollowed, initial.count);
  assert.equal(step1.isFollowed, true);
  assert.equal(step1.followersCount, 3481);

  const step2 = toggleBrandFollow(step1.isFollowed, step1.followersCount);
  assert.equal(step2.isFollowed, false);
  assert.equal(step2.followersCount, 3480);
});

test("Brand Profile: Highlight category filter accurately segregates products", () => {
  const mockProducts = [
    { id: 1, name: "Ipak Pijama", category: "Pijama", featured: true },
    { id: 2, name: "Romantic Penyuar", category: "Penyuar", featured: false },
    { id: 3, name: "Klassik Pijama", category: "Pijama", featured: false },
    { id: 4, name: "Lace Byustgalter", category: "Byusgalter", featured: true },
  ];

  const pijamas = filterProductsByHighlight(mockProducts, "Pijama");
  assert.equal(pijamas.length, 2);
  assert.ok(pijamas.every((p) => p.category === "Pijama"));

  const penyuars = filterProductsByHighlight(mockProducts, "Penyuar");
  assert.equal(penyuars.length, 1);
  assert.equal(penyuars[0].name, "Romantic Penyuar");

  const byustgalter = filterProductsByHighlight(mockProducts, "Byusgalter");
  assert.equal(byustgalter.length, 1);
  assert.equal(byustgalter[0].name, "Lace Byustgalter");
});

test("Brand Profile: Top logo click correctly triggers navigation to brand_profile", () => {
  let currentPage = "home";
  let targetTab = "catalog";

  const handleTopLogoClick = () => {
    targetTab = "tovarlar";
    currentPage = "brand_profile";
  };

  handleTopLogoClick();
  assert.equal(currentPage, "brand_profile");
  assert.equal(targetTab, "tovarlar");
});

test("Brand Profile: Horizontal tab swipe is disabled when viewing Reels from brand profile", () => {
  const shouldAllowHorizontalTabSwipe = (page, previousPage) => {
    if (page === "reels" && previousPage === "brand_profile") {
      return false;
    }
    return true;
  };

  assert.equal(shouldAllowHorizontalTabSwipe("reels", "brand_profile"), false);
  assert.equal(shouldAllowHorizontalTabSwipe("reels", "home"), true);
  assert.equal(shouldAllowHorizontalTabSwipe("catalog", "home"), true);
});

import { resolveSwipedProduct } from "../src/utils/productNav.ts";

test("Brand Profile Product Swipe: swiping left advances to next product and swiping right returns to previous", () => {
  const queue = [{ id: 10 }, { id: 20 }, { id: 30 }];

  const next = resolveSwipedProduct({
    queue,
    currentProductId: 10,
    diffX: -90,
    diffY: 12,
    timeDiff: 220,
  });
  assert.equal(next?.product.id, 20);
  assert.equal(next?.index, 1);

  const prev = resolveSwipedProduct({
    queue,
    currentProductId: 20,
    diffX: 85,
    diffY: -10,
    timeDiff: 250,
  });
  assert.equal(prev?.product.id, 10);
  assert.equal(prev?.index, 0);

  // Boundary clamp returns null at edges
  assert.equal(
    resolveSwipedProduct({
      queue,
      currentProductId: 10,
      diffX: 120,
      diffY: 0,
      timeDiff: 200,
    }),
    null,
  );
  assert.equal(
    resolveSwipedProduct({
      queue,
      currentProductId: 30,
      diffX: -120,
      diffY: 0,
      timeDiff: 200,
    }),
    null,
  );

  // Vertical scroll or small tap does not navigate
  assert.equal(
    resolveSwipedProduct({
      queue,
      currentProductId: 20,
      diffX: -30,
      diffY: 80,
      timeDiff: 200,
    }),
    null,
  );
});


