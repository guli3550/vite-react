import test from "node:test";
import assert from "node:assert/strict";
import {
  DARK_SURFACE_COLORS,
  LIGHT_SURFACE_COLORS,
  REELS_SURFACE_COLORS,
  analyzeColorTransition,
  resolveSurfaceChromeColors,
} from "../src/utils/themeTransition.ts";

test("resolveSurfaceChromeColors returns dark cinema chrome on reels regardless of user theme", () => {
  assert.deepEqual(resolveSurfaceChromeColors("light", "reels"), REELS_SURFACE_COLORS);
  assert.deepEqual(resolveSurfaceChromeColors("dark", "reels"), REELS_SURFACE_COLORS);
  assert.deepEqual(resolveSurfaceChromeColors("light", "home"), LIGHT_SURFACE_COLORS);
  assert.deepEqual(resolveSurfaceChromeColors("dark", "home"), DARK_SURFACE_COLORS);
});

test("analyzeColorTransition detects theme toggles in both directions", () => {
  assert.deepEqual(analyzeColorTransition("light", "dark", "home", "home"), {
    themeChanged: true,
    reelsExited: false,
    reelsEntered: false,
    needsColorTransition: true,
    direction: "to-dark",
  });

  assert.deepEqual(analyzeColorTransition("dark", "light", "catalog", "catalog"), {
    themeChanged: true,
    reelsExited: false,
    reelsEntered: false,
    needsColorTransition: true,
    direction: "to-light",
  });
});

test("analyzeColorTransition detects leaving and entering reels cleanly", () => {
  assert.deepEqual(analyzeColorTransition("light", "light", "reels", "home"), {
    themeChanged: false,
    reelsExited: true,
    reelsEntered: false,
    needsColorTransition: true,
    direction: "to-light",
  });

  assert.deepEqual(analyzeColorTransition("dark", "dark", "reels", "brand_profile"), {
    themeChanged: false,
    reelsExited: true,
    reelsEntered: false,
    needsColorTransition: true,
    direction: null,
  });

  assert.deepEqual(analyzeColorTransition("light", "light", "home", "reels"), {
    themeChanged: false,
    reelsExited: false,
    reelsEntered: true,
    needsColorTransition: true,
    direction: "to-dark",
  });

  assert.deepEqual(analyzeColorTransition("light", "light", "home", "catalog"), {
    themeChanged: false,
    reelsExited: false,
    reelsEntered: false,
    needsColorTransition: false,
    direction: null,
  });
});
