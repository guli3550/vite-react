// Category API resilience patch.
// The production smoke test showed /api/categories returning 500 because the
// richer nested category_images relation is not guaranteed to exist in every
// production schema. Keep the public catalog endpoint independent from that
// optional relation; images remain optional and can be populated separately.
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const CATEGORIES = [
  { slug: "pinyuar", name: "Pinyuar", sort_order: 1 },
  { slug: "pijama", name: "Pijama", sort_order: 2 },
  { slug: "byustgalter", name: "Byusgalter", sort_order: 3 },
  { slug: "mayka", name: "Mayka", sort_order: 4 },
  { slug: "tursik", name: "Tursik", sort_order: 5 },
];

const previousGet = express.application.get;

async function readCategoriesSafe() {
  if (!supabase) return CATEGORIES.map(c => ({ ...c, image_url: "", active: true, updated_at: null }));

  let settings = [];
  try {
    const result = await supabase
      .from("category_settings")
      .select("slug,name,image_url,sort_order,active,updated_at")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (!result.error) settings = result.data || [];
  } catch {}

  let legacy = [];
  try {
    // Deliberately avoid the optional category_images relationship here.
    const result = await supabase
      .from("categories")
      .select("id,slug,name,sort_order,is_active,updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (!result.error) legacy = result.data || [];
  } catch {}

  const settingsMap = new Map(settings.map(item => [String(item.slug), item]));
  const source = legacy.length ? legacy : CATEGORIES;

  return source
    .map(item => {
      const setting = settingsMap.get(String(item.slug));
      return {
        slug: String(item.slug),
        name: String(item.name || setting?.name || CATEGORIES.find(c => c.slug === item.slug)?.name || item.slug),
        image_url: String(setting?.image_url || ""),
        sort_order: Number(item.sort_order ?? setting?.sort_order ?? 0),
        active: item.is_active !== false && setting?.active !== false,
        updated_at: item.updated_at || setting?.updated_at || null,
      };
    })
    .filter(item => item.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5);
}

express.application.get = function categoryResilientGet(path, ...handlers) {
  if (path === "/api/categories") {
    return previousGet.call(this, path, async (_req, res) => {
      try {
        const data = await readCategoriesSafe();
        res.set("Cache-Control", "no-store, max-age=0");
        res.json({ success: true, data });
      } catch (error) {
        console.error("Categories resilience API error:", error);
        res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
      }
    });
  }
  return previousGet.call(this, path, ...handlers);
};
