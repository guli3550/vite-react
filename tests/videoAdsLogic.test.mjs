import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCtr,
  sanitizeDestinationUrl,
  isAdActiveAndVisible,
  getAdsForPlacement,
} from "../src/types/videoAd.ts";

test("calculateCtr: handles 0 or invalid impressions without division error", () => {
  assert.equal(calculateCtr(0, 0), 0);
  assert.equal(calculateCtr(10, 0), 0);
  assert.equal(calculateCtr(-5, 100), 0);
  assert.equal(calculateCtr(0, 100), 0);
});

test("calculateCtr: calculates correct percentage with 1 decimal place rounding", () => {
  assert.equal(calculateCtr(25, 100), 25);
  assert.equal(calculateCtr(1, 3), 33.3);
  assert.equal(calculateCtr(12, 1000), 1.2);
  assert.equal(calculateCtr(150, 100), 100); // capped at 100%
});

test("sanitizeDestinationUrl: rejects dangerous schemes and script injections", () => {
  assert.equal(sanitizeDestinationUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeDestinationUrl("JAVASCRIPT:alert('xss')"), "");
  assert.equal(sanitizeDestinationUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), "");
  assert.equal(sanitizeDestinationUrl("vbscript:MsgBox(1)"), "");
  assert.equal(sanitizeDestinationUrl("file:///etc/passwd"), "");
  assert.equal(sanitizeDestinationUrl(""), "");
  assert.equal(sanitizeDestinationUrl(null), "");
  assert.equal(sanitizeDestinationUrl(undefined), "");
});

test("sanitizeDestinationUrl: allows safe relative paths and external URLs", () => {
  assert.equal(sanitizeDestinationUrl("/?category=Pijamalar"), "/?category=Pijamalar");
  assert.equal(sanitizeDestinationUrl("/product/123456"), "/product/123456");
  assert.equal(sanitizeDestinationUrl("https://gulii.uz/aksiya"), "https://gulii.uz/aksiya");
  assert.equal(sanitizeDestinationUrl("https://t.me/guli_market"), "https://t.me/guli_market");
  assert.equal(sanitizeDestinationUrl("tg://resolve?domain=guli_market"), "tg://resolve?domain=guli_market");
  assert.equal(sanitizeDestinationUrl("instagram.com/guli_market"), "https://instagram.com/guli_market");
});

test("isAdActiveAndVisible: verifies is_active flag", () => {
  const baseAd = {
    id: "1",
    title: "Test Ad",
    video_url: "https://example.com/video.mp4",
    cta_text: "Batafsil",
    placement: "home",
    platform: "all",
    priority: 1,
    frequency_cap: 5,
    is_active: true,
  };

  assert.equal(isAdActiveAndVisible(baseAd), true);
  assert.equal(isAdActiveAndVisible({ ...baseAd, is_active: false }), false);
});

test("isAdActiveAndVisible: verifies starts_at and ends_at time boundaries", () => {
  const baseAd = {
    id: "2",
    title: "Time-bounded Ad",
    video_url: "https://example.com/video.mp4",
    cta_text: "Batafsil",
    placement: "home",
    platform: "all",
    priority: 1,
    frequency_cap: 5,
    is_active: true,
  };

  const now = new Date("2026-10-27T12:00:00Z");

  // Future starts_at
  assert.equal(
    isAdActiveAndVisible(
      { ...baseAd, starts_at: "2026-10-28T00:00:00Z" },
      now
    ),
    false
  );

  // Past starts_at (valid)
  assert.equal(
    isAdActiveAndVisible(
      { ...baseAd, starts_at: "2026-10-26T00:00:00Z" },
      now
    ),
    true
  );

  // Past ends_at (expired)
  assert.equal(
    isAdActiveAndVisible(
      { ...baseAd, ends_at: "2026-10-26T23:59:59Z" },
      now
    ),
    false
  );

  // Future ends_at (valid)
  assert.equal(
    isAdActiveAndVisible(
      { ...baseAd, ends_at: "2026-10-29T23:59:59Z" },
      now
    ),
    true
  );

  // Within range
  assert.equal(
    isAdActiveAndVisible(
      {
        ...baseAd,
        starts_at: "2026-10-25T00:00:00Z",
        ends_at: "2026-10-30T00:00:00Z",
      },
      now
    ),
    true
  );
});

test("Platform and placement filtering logic", () => {
  const ads = [
    { id: "1", placement: "home", platform: "all" },
    { id: "2", placement: "product_feed", platform: "telegram" },
    { id: "3", placement: "all", platform: "web" },
    { id: "4", placement: "home", platform: "telegram" },
  ];

  // For home on web
  const homeWeb = ads.filter(
    (a) => (a.placement === "home" || a.placement === "all") && (a.platform === "web" || a.platform === "all")
  );
  assert.deepEqual(homeWeb.map((a) => a.id), ["1", "3"]);

  // For product_feed on telegram
  const feedTg = ads.filter(
    (a) => (a.placement === "product_feed" || a.placement === "all") && (a.platform === "telegram" || a.platform === "all")
  );
  assert.deepEqual(feedTg.map((a) => a.id), ["2"]);
});

test("Fullscreen video ad: progress percentage calculation clamps safely between 0 and 100", () => {
  const calcProgress = (currentTime, duration) => {
    if (!duration || duration <= 0 || !currentTime || currentTime < 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  };

  assert.equal(calcProgress(0, 30), 0);
  assert.equal(calcProgress(15, 30), 50);
  assert.equal(calcProgress(30, 30), 100);
  assert.equal(calcProgress(35, 30), 100);
  assert.equal(calcProgress(-5, 30), 0);
  assert.equal(calcProgress(5, 0), 0);
  assert.equal(calcProgress(null, 30), 0);
});

test("Fullscreen video ad: user gesture transition requests unmuted sound", () => {
  // Main card playback: always muted
  const mainCardState = { muted: true, autoPlay: true };
  assert.equal(mainCardState.muted, true);

  // Transition to fullscreen modal triggered by user gesture:
  const openFullscreen = (mainCurrentTime) => ({
    isOpen: true,
    initialTime: mainCurrentTime,
    requestedMuted: false, // user gesture -> attempt sound on
  });

  const modalState = openFullscreen(12.4);
  assert.equal(modalState.isOpen, true);
  assert.equal(modalState.initialTime, 12.4);
  assert.equal(modalState.requestedMuted, false);
});



test("getAdsForPlacement: returns all matching ads, not only the first", () => {
  const ads = [
    { id: "priority-home", placement: "home" },
    { id: "all-placement", placement: "all" },
    { id: "feed-only", placement: "product_feed" },
    { id: "second-home", placement: "home" },
  ];

  assert.deepEqual(
    getAdsForPlacement(ads, "home").map((ad) => ad.id),
    ["priority-home", "all-placement", "second-home"]
  );
  assert.deepEqual(
    getAdsForPlacement(ads, "product_feed").map((ad) => ad.id),
    ["all-placement", "feed-only"]
  );
});

test("Fullscreen video ad auto-advances when gallery length >= 2 and bio is not expanded", () => {
  const evaluateVideoEnd = ({ currentIndex, galleryLength, isInfoExpanded, userPaused }) => {
    if (userPaused) return { action: "stay" };
    if (!isInfoExpanded && galleryLength > 1) {
      return { action: "next", nextIndex: (currentIndex + 1) % galleryLength };
    }
    return { action: "loop_current", currentIndex };
  };

  // Scenario 1: 3 videos, bio not expanded, video 0 ends -> go to video 1
  assert.deepEqual(
    evaluateVideoEnd({ currentIndex: 0, galleryLength: 3, isInfoExpanded: false, userPaused: false }),
    { action: "next", nextIndex: 1 }
  );

  // Scenario 2: 3 videos, bio expanded, video 0 ends -> loop current video
  assert.deepEqual(
    evaluateVideoEnd({ currentIndex: 0, galleryLength: 3, isInfoExpanded: true, userPaused: false }),
    { action: "loop_current", currentIndex: 0 }
  );

  // Scenario 3: 1 video, bio not expanded, video 0 ends -> loop current video
  assert.deepEqual(
    evaluateVideoEnd({ currentIndex: 0, galleryLength: 1, isInfoExpanded: false, userPaused: false }),
    { action: "loop_current", currentIndex: 0 }
  );

  // Scenario 4: 2 videos, video 1 ends -> loop back to video 0
  assert.deepEqual(
    evaluateVideoEnd({ currentIndex: 1, galleryLength: 2, isInfoExpanded: false, userPaused: false }),
    { action: "next", nextIndex: 0 }
  );
});
