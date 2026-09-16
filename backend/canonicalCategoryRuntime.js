// Canonical public category runtime.
// This is a compatibility hardening layer for the existing category/admin patches.
// The public storefront must never depend on optional nested category relations.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const CATEGORY_DEFAULTS = [
  { slug: "pinyuar", name: "Pinyuar", sort_order: 1 },
  { slug: "pijama", name: "Pijama", sort_order: 2 },
  { slug: "byustgalter", name: "Byusgalter", sort_order: 3 },
  { slug: "mayka", name: "Mayka", sort_order: 4 },
  { slug: "tursik", name: "Tursik", sort_order: 5 },
];

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

async function readCanonicalCategories() {
  if (!supabase) return CATEGORY_DEFAULTS.map((item) => ({ ...item, image_url: "", active: true, updated_at: null }));

  let settings = [];
  try {
    const result = await supabase
      .from("category_settings")
      .select("slug,name,image_url,sort_order,active,updated_at")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (!result.error) settings = result.data || [];
  } catch {}

  let categories = [];
  try {
    const result = await supabase
      .from("categories")
      .select("id,slug,name,sort_order,is_active,updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (!result.error) categories = result.data || [];
  } catch {}

  const settingsMap = new Map(settings.map((item) => [String(item.slug), item]));
  const source = categories.length ? categories : CATEGORY_DEFAULTS;

  return source
    .map((item) => {
      const setting = settingsMap.get(String(item.slug));
      const fallback = CATEGORY_DEFAULTS.find((entry) => entry.slug === String(item.slug));
      return {
        slug: String(item.slug),
        name: String(item.name || setting?.name || fallback?.name || item.slug),
        image_url: String(setting?.image_url || ""),
        sort_order: Number(item.sort_order ?? setting?.sort_order ?? fallback?.sort_order ?? 0),
        active: item.is_active !== false && setting?.active !== false,
        updated_at: item.updated_at || setting?.updated_at || null,
      };
    })
    .filter((item) => item.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5);
}

function categoryHandler(_req, res) {
  readCanonicalCategories()
    .then((data) => {
      res.set("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, data });
    })
    .catch((error) => {
      console.error("Canonical categories API error:", error);
      // Even if Supabase is temporarily unavailable, the storefront receives
      // the fixed five-category contract instead of a 5xx response.
      res.set("Cache-Control", "no-store, max-age=0");
      res.json({
        success: true,
        data: CATEGORY_DEFAULTS.map((item) => ({ ...item, image_url: "", active: true, updated_at: null })),
        degraded: true,
      });
    });
}

if (!globalThis.__GULI_CANONICAL_CATEGORY_RUNTIME__) {
  globalThis.__GULI_CANONICAL_CATEGORY_RUNTIME__ = true;
  const originalListen = express.application.listen;

  express.application.listen = function canonicalCategoryListen(...args) {
    // Remove every previously registered public category handler. The legacy
    // category patches can register the same route during module preload and
    // Express uses first-match semantics, so appending another handler is not
    // sufficient. Keep all admin routes untouched.
    const router = this._router;
    if (router?.stack) {
      router.stack = router.stack.filter((layer) => {
        const route = layer?.route;
        return !(route && route.path === "/api/categories");
      });
    }

    this.get("/api/categories", categoryHandler);
    return originalListen.apply(this, args);
  };
}

module.exports = { readCanonicalCategories };
