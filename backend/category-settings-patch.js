const crypto = require("crypto");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const originalGet = express.application.get;
const originalPut = express.application.put;
let installed = false;

const CATEGORIES = [
  { slug: "pinyuar", name: "Pinyuar", sort_order: 1 },
  { slug: "pijama", name: "Pijama", sort_order: 2 },
  { slug: "byustgalter", name: "Byusgalter", sort_order: 3 },
  { slug: "mayka", name: "Mayka", sort_order: 4 },
  { slug: "tursik", name: "Tursik", sort_order: 5 },
];

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyAdminToken(token) {
  try {
    const secret = process.env.ADMIN_SECRET || "";
    if (!secret || !token) return false;
    const [body, signature] = String(token).split(".");
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  next();
}

function publicStorageUrl(bucket, storagePath) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const normalized = String(storagePath || "").replace(/^\/+/, "").replace(new RegExp(`^${bucket}/`), "");
  return `${base}/storage/v1/object/public/${bucket}/${normalized}`;
}

async function readCategories() {
  const { data: settings, error: settingsError } = await supabase
    .from("category_settings")
    .select("slug,name,image_url,sort_order,active,updated_at")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (settingsError && !/does not exist|relation .* not found|schema cache/i.test(settingsError.message || "")) {
    throw settingsError;
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("categories")
    .select("id,slug,name,sort_order,is_active,updated_at,category_images(storage_path,version,created_at)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (legacyError) throw legacyError;

  const settingMap = new Map((settings || []).map(item => [item.slug, item]));
  return (legacy || CATEGORIES).map(item => {
    const setting = settingMap.get(item.slug);
    const images = Array.isArray(item.category_images)
      ? [...item.category_images].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
      : [];
    const latest = images[0];
    const imageUrl = latest?.storage_path
      ? `${publicStorageUrl("category-media", latest.storage_path)}?v=${encodeURIComponent(latest.version || latest.created_at || Date.now())}`
      : String(setting?.image_url || "");
    return {
      slug: item.slug,
      name: typeof item.name === "string"
        ? item.name
        : (setting?.name || CATEGORIES.find(c => c.slug === item.slug)?.name || item.slug),
      image_url: imageUrl,
      sort_order: Number(item.sort_order ?? setting?.sort_order ?? 0),
      active: item.is_active !== false && setting?.active !== false,
      updated_at: item.updated_at || setting?.updated_at || null,
    };
  }).filter(item => item.active).sort((a, b) => a.sort_order - b.sort_order).slice(0, 5);
}

function installRoutes(app) {
  if (installed) return;
  installed = true;

  originalGet.call(app, "/api/categories", async (_req, res) => {
    try {
      const data = await readCategories();
      res.set("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, data });
    } catch (error) {
      console.error("Categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  originalGet.call(app, "/api/admin/categories", requireAdmin, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,slug,name,sort_order,is_active,updated_at,category_images(storage_path,version,created_at)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data || []).map(item => {
        const latest = [...(item.category_images || [])].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
        return {
          ...item,
          image_url: latest?.storage_path
            ? `${publicStorageUrl("category-media", latest.storage_path)}?v=${encodeURIComponent(latest.version || latest.created_at || Date.now())}`
            : "",
        };
      });
      res.set("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error("Admin categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  originalPut.call(app, "/api/admin/categories/:slug", requireAdmin, async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const current = CATEGORIES.find(item => item.slug === slug);
      if (!current) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
      const name = String(req.body?.name || current.name).trim().slice(0, 60);
      const imageUrl = String(req.body?.image_url || "").trim();
      if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ success: false, message: "Kategoriya rasmi uchun to‘g‘ri URL kerak" });
      const { data, error } = await supabase
        .from("category_settings")
        .upsert({ slug, name, image_url: imageUrl, sort_order: current.sort_order, active: true, updated_at: new Date().toISOString() }, { onConflict: "slug" })
        .select("slug,name,image_url,sort_order,active,updated_at")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Admin category update error:", error);
      res.status(500).json({ success: false, message: error.message || "Kategoriya saqlanmadi" });
    }
  });

  originalGet.call(app, "/api/settings/banner", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("category_settings")
        .select("image_url")
        .eq("slug", "promo_banner")
        .maybeSingle();
      if (error) throw error;
      const defaultUrl = "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1100&q=78";
      res.set("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, url: data?.image_url || defaultUrl });
    } catch (error) {
      console.error("Get banner error:", error);
      res.status(500).json({ success: false, message: "Banner rasmini yuklashda xatolik" });
    }
  });

  originalPut.call(app, "/api/admin/settings/banner", requireAdmin, async (req, res) => {
    try {
      const imageUrl = String(req.body?.image_url || "").trim();
      if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
        return res.status(400).json({ success: false, message: "To‘g‘ri rasm URL manzili kerak" });
      }
      const { data, error } = await supabase
        .from("category_settings")
        .upsert({ slug: "promo_banner", name: "Promo Banner", image_url: imageUrl, sort_order: 999, active: true, updated_at: new Date().toISOString() }, { onConflict: "slug" })
        .select("image_url")
        .single();
      if (error) throw error;
      res.json({ success: true, url: data?.image_url });
    } catch (error) {
      console.error("Update banner error:", error);
      res.status(500).json({ success: false, message: "Banner rasmini yangilashda xatolik" });
    }
  });
}

if (!installed) {
  express.application.get = function patchedGet(path, ...handlers) {
    if (this && typeof path === "string") installRoutes(this);
    return originalGet.call(this, path, ...handlers);
  };
}

module.exports = { CATEGORIES };