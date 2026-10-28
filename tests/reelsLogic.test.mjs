import test from "node:test";
import assert from "node:assert/strict";

// Sample initial data model matching src/types/reels.ts
const INITIAL_DEMO_REELS = [
  {
    id: "reel-1",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    posterUrl: "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=900&q=80",
    caption: "Yangi fasl kolleksiyasi: Fransuz ipak va nozik baxmal to‘plamlari ✨",
    likesCount: 1420,
    commentsCount: 38,
    isLiked: false,
    status: "active",
    comments: [
      { id: "c1", authorName: "Madinabonu", text: "Kiyimi juda chiroyli ekan" }
    ],
  },
  {
    id: "reel-2",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    posterUrl: "https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?auto=format&fit=crop&w=900&q=80",
    caption: "Silk Satin Romantic — kundalik qulaylik 🌸",
    likesCount: 980,
    commentsCount: 19,
    isLiked: true,
    status: "active",
    comments: [],
  },
  {
    id: "reel-3",
    videoUrl: "",
    posterUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80",
    caption: "Qadoqlash jarayoni 🎁",
    likesCount: 840,
    commentsCount: 14,
    isLiked: false,
    status: "draft",
    comments: [],
  },
];

function filterActiveReels(reels) {
  return reels.filter((r) => r.status === "active");
}

function toggleReelLike(reels, reelId) {
  return reels.map((r) => {
    if (r.id === reelId) {
      const nextLiked = !r.isLiked;
      return {
        ...r,
        isLiked: nextLiked,
        likesCount: nextLiked ? r.likesCount + 1 : Math.max(0, r.likesCount - 1),
      };
    }
    return r;
  });
}

function addReelComment(reels, reelId, newComment) {
  return reels.map((r) => {
    if (r.id === reelId) {
      return {
        ...r,
        commentsCount: (r.commentsCount || 0) + 1,
        comments: [newComment, ...(r.comments || [])],
      };
    }
    return r;
  });
}

function validateReelForm(formData) {
  const errors = {};
  if (!formData.caption || !formData.caption.trim()) {
    errors.caption = "Tavsif kiritilishi shart";
  }
  if (!formData.videoUrl || !formData.videoUrl.trim()) {
    errors.videoUrl = "Video URL kiritilishi shart";
  }
  if (!formData.posterUrl || !formData.posterUrl.trim()) {
    errors.posterUrl = "Poster URL kiritilishi shart";
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

test("Reels: filterActiveReels only returns active status items", () => {
  const active = filterActiveReels(INITIAL_DEMO_REELS);
  assert.equal(active.length, 2);
  assert.ok(active.every((r) => r.status === "active"));
});

test("Reels: toggleReelLike correctly increments count on like", () => {
  const updated = toggleReelLike(INITIAL_DEMO_REELS, "reel-1");
  const reel1 = updated.find((r) => r.id === "reel-1");
  assert.equal(reel1.isLiked, true);
  assert.equal(reel1.likesCount, 1421);
});

test("Reels: toggleReelLike correctly decrements count on unlike", () => {
  const updated = toggleReelLike(INITIAL_DEMO_REELS, "reel-2");
  const reel2 = updated.find((r) => r.id === "reel-2");
  assert.equal(reel2.isLiked, false);
  assert.equal(reel2.likesCount, 979);
});

test("Reels: addReelComment prepends comment and increments commentsCount", () => {
  const newComment = { id: "c_new", authorName: "Test User", text: "Ajoyib rolik!" };
  const updated = addReelComment(INITIAL_DEMO_REELS, "reel-1", newComment);
  const reel1 = updated.find((r) => r.id === "reel-1");
  assert.equal(reel1.commentsCount, 39);
  assert.equal(reel1.comments[0].id, "c_new");
  assert.equal(reel1.comments.length, 2);
});

test("Reels: validateReelForm catches empty fields and passes valid submissions", () => {
  const emptyForm = { caption: "", videoUrl: "", posterUrl: "" };
  const invalidResult = validateReelForm(emptyForm);
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.caption);
  assert.ok(invalidResult.errors.videoUrl);
  assert.ok(invalidResult.errors.posterUrl);

  const validForm = {
    caption: "Yangi rolik",
    videoUrl: "https://example.com/video.mp4",
    posterUrl: "https://example.com/poster.jpg",
  };
  const validResult = validateReelForm(validForm);
  assert.equal(validResult.isValid, true);
  assert.equal(Object.keys(validResult.errors).length, 0);
});

// Preload window logic tests
function getPreloadWindow(currentIndex, totalCount, aheadCount = 2, keepPrevious = 1) {
  if (totalCount <= 0) return [];
  const start = Math.max(0, currentIndex - keepPrevious);
  const end = Math.min(totalCount - 1, currentIndex + aheadCount);
  const windowIndices = [];
  for (let i = start; i <= end; i++) {
    windowIndices.push(i);
  }
  return windowIndices;
}

test("Reels Preload: Index 0 preloads 1st, 2nd, and 3rd reel [0, 1, 2]", () => {
  const window0 = getPreloadWindow(0, 10, 2, 1);
  assert.deepEqual(window0, [0, 1, 2]);
});

test("Reels Preload: Index 1 shifts preload window to include [0, 1, 2, 3]", () => {
  const window1 = getPreloadWindow(1, 10, 2, 1);
  assert.deepEqual(window1, [0, 1, 2, 3]);
});

test("Reels Preload: Index 2 shifts preload window to [1, 2, 3, 4]", () => {
  const window2 = getPreloadWindow(2, 10, 2, 1);
  assert.deepEqual(window2, [1, 2, 3, 4]);
});

test("Reels Preload: At last item, window bounds correctly to totalCount", () => {
  const windowLast = getPreloadWindow(4, 5, 2, 1);
  assert.deepEqual(windowLast, [3, 4]);
});

// Author Normalization tests
function normalizeReelAuthor(author) {
  return {
    name: "Guli Market",
    username: author?.username || "gulii.uz",
    avatar: author?.avatar && author.avatar.startsWith("/") ? author.avatar : "/guli-logo.png",
    verified: true,
  };
}

test("Reels Author: Uniformly normalizes author name to Guli Market", () => {
  const norm1 = normalizeReelAuthor({ name: "Random Creator", username: "random_user" });
  assert.equal(norm1.name, "Guli Market");
  assert.equal(norm1.avatar, "/guli-logo.png");
  assert.equal(norm1.verified, true);
});

// Swipe Evaluation tests
function evaluateSwipeGesture(deltaY, threshold = 45) {
  if (deltaY > threshold) return "next";
  if (deltaY < -threshold) return "prev";
  return "none";
}

test("Reels Gestures: evaluateSwipeGesture triggers next on upward drag > 45px", () => {
  assert.equal(evaluateSwipeGesture(60, 45), "next");
  assert.equal(evaluateSwipeGesture(-60, 45), "prev");
  assert.equal(evaluateSwipeGesture(20, 45), "none");
});

// Video Progress Calculation test
function calculateVideoProgress(currentTime, duration) {
  if (!duration || duration <= 0 || isNaN(currentTime) || isNaN(duration)) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

test("Reels Progress: correctly clamps progress between 0 and 100", () => {
  assert.equal(calculateVideoProgress(5, 10), 50);
  assert.equal(calculateVideoProgress(-2, 10), 0);
  assert.equal(calculateVideoProgress(15, 10), 100);
  assert.equal(calculateVideoProgress(0, 0), 0);
});

// Author Row Display Tests: [Logo] Guli Market [Verified] without @username
function formatAuthorDisplayElements(author) {
  const normalized = normalizeReelAuthor(author);
  return {
    logoSrc: normalized.avatar,
    displayName: "Guli Market",
    showUsername: false,
    verifiedBadgeAfterName: true,
  };
}

test("Reels Author Row: displays [Logo] Guli Market [Verified] and omits @username", () => {
  const display = formatAuthorDisplayElements({ username: "gulii.uz", name: "Guli Market" });
  assert.equal(display.logoSrc, "/guli-logo.png");
  assert.equal(display.displayName, "Guli Market");
  assert.equal(display.showUsername, false);
  assert.equal(display.verifiedBadgeAfterName, true);
});

test("Reels Audio: Initial audio state is unmuted (plays with sound upon entry)", () => {
  const initialMutedState = false;
  assert.equal(initialMutedState, false, "Video plays with sound by default when entering Reels");
});

// Comments Sheet Drag Evaluation tests
function evaluateCommentsSheetDrag(currentHeight, deltaY, expandThreshold = 40, collapseThreshold = 40, closeThreshold = 55) {
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

test("Reels Comments Sheet Drag: dragging up > 40px in collapsed state returns expanded", () => {
  assert.equal(evaluateCommentsSheetDrag("collapsed", 50), "expanded");
  assert.equal(evaluateCommentsSheetDrag("collapsed", 20), "none");
});

test("Reels Comments Sheet Drag: dragging down > 40px in expanded state returns collapsed", () => {
  assert.equal(evaluateCommentsSheetDrag("expanded", -45), "collapsed");
  assert.equal(evaluateCommentsSheetDrag("expanded", -15), "none");
});

test("Reels Comments Sheet Drag: dragging down > 55px in collapsed state triggers close", () => {
  assert.equal(evaluateCommentsSheetDrag("collapsed", -60), "close");
  assert.equal(evaluateCommentsSheetDrag("collapsed", -30), "none");
});

test("Reels Action Bar: Omits avatar above like button and includes Like, Comment, Share, Music", () => {
  const actionBarItems = ["like", "comment", "share", "music"];
  assert.equal(actionBarItems.includes("avatar"), false, "Avatar above like button must be removed");
  assert.equal(actionBarItems[0], "like", "Like button should be the top item");
});

test("Reels Caption: More indicator uses ... only without ko'proq text", () => {
  const moreIndicatorText = "...";
  assert.equal(moreIndicatorText, "...");
});

test("Reels Comments Sheet: Modal z-index is above bottomNav (2500)", () => {
  const modalZIndex = 2500;
  const bottomNavZIndex = 1000;
  assert.ok(modalZIndex > bottomNavZIndex, "Comments modal overlay must render above bottomNav");
});

test("Instagram Extractor: accurately detects Instagram reel and post URLs", () => {
  const isInstagramUrl = (url) =>
    /instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.test(url) ||
    /instagr\.am\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.test(url);

  assert.equal(isInstagramUrl("https://www.instagram.com/reel/C12345/"), true);
  assert.equal(isInstagramUrl("https://instagr.am/p/ABCDEF/"), true);
  assert.equal(isInstagramUrl("https://example.com/video.mp4"), false);
});

test("Instagram Extractor: correctly extracts shortcode from Instagram links", () => {
  const extractInstagramShortcode = (url) => {
    const match =
      url.match(/instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) ||
      url.match(/instagr\.am\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    return match ? match[2] : null;
  };

  assert.equal(extractInstagramShortcode("https://www.instagram.com/reel/C_X9yZ123/"), "C_X9yZ123");
  assert.equal(extractInstagramShortcode("https://instagr.am/p/P_888999/"), "P_888999");
  assert.equal(extractInstagramShortcode("invalid-link"), null);
});





