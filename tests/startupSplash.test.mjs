import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  computeNextSplashProgress,
  getStartupProgressState,
  markStartupPhase,
  reportStartupProgress,
  resetStartupProgressForTest,
} from "../src/utils/startupProgress.ts";
import { GULI_LOGO_BASE64 } from "../src/utils/guliLogoBase64.ts";

test("startupProgress advances monotonically across boot phases to 100%", () => {
  resetStartupProgressForTest();

  const boot = markStartupPhase("boot");
  assert.equal(boot.progress, 18);

  const cache = markStartupPhase("cache");
  assert.equal(cache.progress, 40);

  // Trying to report a lower value never regresses progress
  const lower = reportStartupProgress(10, "Oldingi holat");
  assert.equal(lower.progress, 40);

  const banners = markStartupPhase("banners");
  assert.equal(banners.progress, 66);

  const ready = markStartupPhase("products");
  assert.equal(ready.progress, 100);
  assert.equal(ready.label, "Guli Market'ga xush kelibsiz!");
});

test("startupProgress hits 100% even if products resolve before banners", () => {
  resetStartupProgressForTest();

  markStartupPhase("boot");
  const afterProducts = markStartupPhase("products");
  assert.equal(afterProducts.progress, 84);

  const afterBanners = markStartupPhase("banners");
  assert.equal(afterBanners.progress, 100);
  assert.equal(getStartupProgressState().progress, 100);
});

test("computeNextSplashProgress animates continuously without stalling or overflowing", () => {
  let current = 12;
  // Simulate slow network stuck at boot milestone (18%)
  for (let i = 0; i < 40; i += 1) {
    const next = computeNextSplashProgress(current, 18);
    assert.ok(next >= current, `Expected monotonic step: ${next} >= ${current}`);
    assert.ok(next < 95, `Should stay below 95% before final ready milestone, got ${next}`);
    current = next;
  }
  assert.ok(current > 25, `Expected visible movement from 12%, got ${current}`);

  // Now simulate real completion milestone reaching 100%
  for (let i = 0; i < 40 && current < 100; i += 1) {
    current = computeNextSplashProgress(current, 100);
  }
  assert.equal(current, 100);
});

test("splash logo is an instant inline WebP Data URI under 15 KB and rendered directly", () => {
  assert.ok(
    GULI_LOGO_BASE64.startsWith("data:image/webp;base64,"),
    "Expected inline base64 WebP Data URI for instant splash logo rendering",
  );
  assert.ok(
    GULI_LOGO_BASE64.length < 15000,
    `Expected compact inline splash logo (< 15 KB), got ${GULI_LOGO_BASE64.length} bytes`,
  );

  const splashTsx = fs.readFileSync(
    path.resolve("src/components/GuliStartupSplash.tsx"),
    "utf8",
  );
  assert.ok(splashTsx.includes("src={GULI_LOGO_BASE64}"), "Splash must render inline GULI_LOGO_BASE64 directly");
  assert.ok(!splashTsx.includes("/guli-logo.jpg"), "Splash must not wait on heavy /guli-logo.jpg network fetch");
  assert.ok(splashTsx.includes("guli_startup_progress"));
});

test("splash loading indicator is elevated inside body flow instead of pinned at bottom edge", () => {
  const splashCss = fs.readFileSync(
    path.resolve("src/components/GuliStartupSplash.css"),
    "utf8",
  );
  const footerBlockMatch = splashCss.match(/\.guliSplashFooter\s*\{[^}]*\}/);
  assert.ok(footerBlockMatch, "Expected .guliSplashFooter rule in GuliStartupSplash.css");
  const footerRule = footerBlockMatch[0];
  assert.ok(footerRule.includes("position: relative"), "Footer should be in flow inside .guliSplashBody");
  assert.ok(!/bottom:\s*max\(54px/.test(splashCss), "Footer should no longer be pinned 54px from bottom edge");
  assert.ok(!/bottom:\s*max\(48px/.test(splashCss), "Footer should no longer be pinned 48px from bottom edge on mobile");
});
