const crypto = require("crypto");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
    .trim().replace(/^['"]|['"]$/g, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim().replace(/^['"]|['"]$/g, "");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = getSupabaseClient();
  return _supabase;
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase is not configured (SUPABASE_URL or service key missing)");
    }
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

const originalGet = express.application.get;
let installed = false;

function route(app, method, path, ...handlers) {
  return app.route(path)[method](...handlers);
}

const DEFAULT_CATEGORIES = [
  { slug: "pinyuar", name: "Penyuar", icon: "🌸", sort_order: 1 },
  { slug: "pijama", name: "Pijama", icon: "🌙", sort_order: 2 },
  { slug: "byustgalter", name: "Byusgalter", icon: "👙", sort_order: 3 },
  { slug: "mayka", name: "Mayka", icon: "🎽", sort_order: 4 },
  { slug: "tursik", name: "Tursik", icon: "🩲", sort_order: 5 },
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
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  }
  next();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[‘’'\`]/g, "")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function canonicalSlug(value) {
  const slug = slugify(value);
  if (slug === "penyuar" || slug === "pinyuar") return "pinyuar";
  if (slug === "byusgalter" || slug === "byustgalter") return "byustgalter";
  if (slug === "trusik" || slug === "tursik") return "tursik";
  return slug;
}

function publicCategoryName(row) {
  const slug = canonicalSlug(row.slug);
  if (slug === "pinyuar") return "Penyuar";
  if (slug === "byustgalter") return "Byusgalter";
  if (slug === "tursik") return "Tursik";
  return String(row.name || row.slug || "").trim();
}

async function readCategories({ includeInactive = false } = {}) {
  let query = supabase
    .from("category_settings")
    .select("slug,name,icon,image_url,sort_order,active,updated_at")
    .not("slug", "like", "banner_%")
    .neq("slug", "promo_banner")
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });

  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    slug: row.slug,
    name: publicCategoryName(row),
    icon: row.icon || "🌸",
    image_url: row.image_url || "",
    sort_order: Number(row.sort_order || 0),
    active: row.active !== false,
    updated_at: row.updated_at || null,
  }));
}

async function nextSortOrder() {
  const { data, error } = await supabase
    .from("category_settings")
    .select("sort_order")
    .not("slug", "like", "banner_%")
    .neq("slug", "promo_banner")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Number(data?.[0]?.sort_order || 0) + 1;
}

async function productCountsByCategory() {
  const { data, error } = await supabase
    .from("products")
    .select("category,active")
    .eq("active", true);
  if (error) throw error;

  const counts = new Map();
  for (const row of data || []) {
    const key = canonicalSlug(row.category);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function readAdminCategories() {
  const [rows, counts] = await Promise.all([
    readCategories({ includeInactive: true }),
    productCountsByCategory(),
  ]);
  return rows.map((row) => ({
    id: row.slug,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    productCount: counts.get(canonicalSlug(row.slug)) || 0,
    sortOrder: row.sort_order,
    active: row.active,
    image_url: row.image_url,
    updated_at: row.updated_at,
  }));
}

async function ensureUniqueSlug(baseSlug, currentSlug = "") {
  const clean = baseSlug || "kategoriya";
  if (clean === currentSlug) return clean;

  const { data, error } = await supabase
    .from("category_settings")
    .select("slug")
    .like("slug", `${clean}%`);
  if (error) throw error;

  const used = new Set((data || []).map((row) => row.slug));
  if (!used.has(clean)) return clean;

  let i = 2;
  while (used.has(`${clean}-${i}`)) i += 1;
  return `${clean}-${i}`;
}

function installRoutes(app) {
  if (installed) return;
  installed = true;

  route(app, "get", "/api/categories", async (_req, res) => {
    try {
      const data = await readCategories();
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, data });
    } catch (error) {
      console.error("Categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  route(app, "get", "/api/admin/categories", requireAdmin, async (_req, res) => {
    try {
      const data = await readAdminCategories();
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, data });
    } catch (error) {
      console.error("Admin categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  route(app, "post", "/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim().slice(0, 60);
      const icon = String(req.body?.icon || "🌸").trim().slice(0, 12) || "🌸";
      if (!name) {
        return res.status(400).json({ success: false, message: "Kategoriya nomi kerak" });
      }

      const requestedSlug = slugify(req.body?.slug || name);
      const slug = await ensureUniqueSlug(requestedSlug || "kategoriya");
      const sortOrder = Number(req.body?.sortOrder || req.body?.sort_order || 0) || await nextSortOrder();

      const { data, error } = await supabase
        .from("category_settings")
        .insert([{
          slug,
          name,
          icon,
          image_url: String(req.body?.image_url || "").trim(),
          sort_order: sortOrder,
          active: req.body?.active !== false,
          updated_at: new Date().toISOString(),
        }])
        .select("slug,name,icon,image_url,sort_order,active,updated_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ success: false, message: "Bunday kategoriya allaqachon mavjud" });
        }
        throw error;
      }

      res.status(201).json({
        success: true,
        data: {
          id: data.slug,
          name: publicCategoryName(data),
          slug: data.slug,
          icon: data.icon || "🌸",
          productCount: 0,
          sortOrder: Number(data.sort_order || 0),
          active: data.active !== false,
          image_url: data.image_url || "",
          updated_at: data.updated_at || null,
        },
      });
    } catch (error) {
      console.error("Admin category create error:", error);
      res.status(500).json({ success: false, message: error.message || "Kategoriya yaratilmadi" });
    }
  });

  route(app, "put", "/api/admin/categories/:slug", requireAdmin, async (req, res) => {
    try {
      const currentSlug = String(req.params.slug || "").trim().toLowerCase();
      if (!currentSlug) return res.status(400).json({ success: false, message: "Kategoriya slug kerak" });

      const { data: existing, error: existingError } = await supabase
        .from("category_settings")
        .select("slug,name,icon,image_url,sort_order,active,updated_at")
        .eq("slug", currentSlug)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });

      const name = String(req.body?.name ?? existing.name).trim().slice(0, 60);
      const icon = String(req.body?.icon ?? existing.icon ?? "🌸").trim().slice(0, 12) || "🌸";
      const active = req.body?.active === undefined ? existing.active !== false : Boolean(req.body.active);
      const sortOrder = Number(req.body?.sortOrder ?? req.body?.sort_order ?? existing.sort_order) || Number(existing.sort_order || 0);
      const imageUrl = String(req.body?.image_url ?? existing.image_url ?? "").trim();

      const { data, error } = await supabase
        .from("category_settings")
        .update({
          name,
          icon,
          image_url: imageUrl,
          sort_order: sortOrder,
          active,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", currentSlug)
        .select("slug,name,icon,image_url,sort_order,active,updated_at")
        .single();
      if (error) throw error;

      const counts = await productCountsByCategory();
      res.json({
        success: true,
        data: {
          id: data.slug,
          name: publicCategoryName(data),
          slug: data.slug,
          icon: data.icon || "🌸",
          productCount: counts.get(canonicalSlug(data.slug)) || 0,
          sortOrder: Number(data.sort_order || 0),
          active: data.active !== false,
          image_url: data.image_url || "",
          updated_at: data.updated_at || null,
        },
      });
    } catch (error) {
      console.error("Admin category update error:", error);
      res.status(500).json({ success: false, message: error.message || "Kategoriya saqlanmadi" });
    }
  });

  route(app, "delete", "/api/admin/categories/:slug", requireAdmin, async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      if (!slug) return res.status(400).json({ success: false, message: "Kategoriya slug kerak" });

      const { data, error } = await supabase
        .from("category_settings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("slug", slug)
        .select("slug,name,icon,image_url,sort_order,active,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });

      res.json({
        success: true,
        data: {
          id: data.slug,
          name: publicCategoryName(data),
          slug: data.slug,
          icon: data.icon || "🌸",
          productCount: 0,
          sortOrder: Number(data.sort_order || 0),
          active: false,
          image_url: data.image_url || "",
          updated_at: data.updated_at || null,
        },
      });
    } catch (error) {
      console.error("Admin category delete error:", error);
      res.status(500).json({ success: false, message: error.message || "Kategoriya o‘chirilmadi" });
    }
  });

  route(app, "get", "/api/settings/banner", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("category_settings")
        .select("image_url")
        .eq("slug", "promo_banner")
        .maybeSingle();
      if (error) throw error;
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json({ success: true, url: data?.image_url || null });
    } catch (error) {
      console.error("Get banner error:", error);
      res.status(500).json({ success: false, message: "Banner rasmini yuklashda xatolik" });
    }
  });

  route(app, "get", "/api/banners", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("category_settings")
        .select("slug,name,image_url,sort_order,active,updated_at")
        .like("slug", "banner_%")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      res.setHeader("Cache-Control", "no-store, max-age=0");
      const banners = (data || []).map((item, idx) => {
        let meta = {};
        try { meta = JSON.parse(item.name || "{}"); } catch { meta = { title: item.name }; }
        return {
          id: item.slug.replace(/^banner_/, "") || `banner-${idx + 1}`,
          imageUrl: item.image_url,
          title: meta.title || "Maxsus Taklif",
          subtitle: meta.subtitle || "",
          badgeText: meta.badgeText || "TOP SOTILGAN",
          ctaText: meta.ctaText || "Xarid qilish",
          actionType: meta.actionType || "catalog",
          actionTarget: meta.actionTarget || "",
          active: item.active !== false,
          createdAt: item.updated_at,
        };
      });
      res.json({ success: true, data: banners });
    } catch (error) {
      console.error("Get banners error:", error);
      res.status(500).json({ success: false, message: "Bannerlarni yuklashda xatolik", data: [] });
    }
  });

  route(app, "put", "/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const banners = Array.isArray(req.body?.banners) ? req.body.banners : [];
      for (let i = 0; i < banners.length; i += 1) {
        const b = banners[i] || {};
        const slug = "banner_" + (b.id || i + 1);
        const actionTarget = String(b.actionTarget || "").trim();
        if (actionTarget && !/^https?:\\/\\//i.test(actionTarget)) {
          return res.status(400).json({
            success: false,
            message: "Banner yo‘naltirish URL manzili http:// yoki https:// bilan boshlanishi kerak",
          });
        }
        const meta = JSON.stringify({
          title: b.title || "",
          subtitle: b.subtitle || "",
          badgeText: b.badgeText || "",
          ctaText: b.ctaText || "",
          actionType: b.actionType || "catalog",
          actionTarget,
        });
        const { error } = await supabase
          .from("category_settings")
          .upsert({
            slug,
            name: meta,
            image_url: b.imageUrl || "",
            sort_order: i + 1,
            active: b.active !== false,
            updated_at: new Date().toISOString(),
          }, { onConflict: "slug" });
        if (error) throw error;
      }
      res.json({ success: true, message: "Bannerlar muvaffaqiyatli saqlandi" });
    } catch (error) {
      console.error("Save banners error:", error);
      res.status(500).json({ success: false, message: "Bannerlarni saqlashda xatolik" });
    }
  });

  route(app, "put", "/api/admin/settings/banner", requireAdmin, async (req, res) => {
    try {
      const imageUrl = String(req.body?.image_url || "").trim();
      if (!imageUrl || !/^https?:\\/\\//i.test(imageUrl)) {
        return res.status(400).json({ success: false, message: "To‘g‘ri rasm URL manzili kerak" });
      }
      const { data, error } = await supabase
        .from("category_settings")
        .upsert({
          slug: "promo_banner",
          name: "Promo Banner",
          image_url: imageUrl,
          sort_order: 999,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "slug" })
        .select("image_url")
        .single();
      if (error) throw error;
      res.json({ success: true, url: data?.image_url || null });
    } catch (error) {
      console.error("Update banner error:", error);
      res.status(500).json({ success: false, message: "Banner rasmini yangilashda xatolik" });
    }
  });

  if (!installed) return;
}

if (!installed) {
  express.application.get = function patchedGet(path, ...handlers) {
    if (this && typeof path === "string") installRoutes(this);
    return originalGet.call(this, path, ...handlers);
  };
}

module.exports = { DEFAULT_CATEGORIES, canonicalSlug, slugify };
