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

async function readCategories() {
  const { data, error } = await supabase.from("category_settings").select("slug,name,image_url,sort_order,active,updated_at").eq("active", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

function installRoutes(app) {
  if (installed) return;
  installed = true;

  originalGet.call(app, "/api/categories", async (req, res) => {
    try {
      const data = await readCategories();
      res.set("Cache-Control", "no-store");
      res.json({ success: true, data });
    } catch (error) {
      console.error("Categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  originalGet.call(app, "/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase.from("category_settings").select("slug,name,image_url,sort_order,active,updated_at").order("sort_order", { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error("Admin categories API error:", error);
      res.status(500).json({ success: false, message: "Kategoriyalarni yuklashda xatolik" });
    }
  });

  originalPut.call(app, "/api/admin/categories/:slug", requireAdmin, async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const current = CATEGORIES.find((item) => item.slug === slug);
      if (!current) return res.status(404).json({ success: false, message: "Kategoriya topilmadi" });
      const name = String(req.body?.name || current.name).trim().slice(0, 60);
      const imageUrl = String(req.body?.image_url || "").trim();
      if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ success: false, message: "Kategoriya rasmi uchun to‘g‘ri URL kerak" });
      const { data, error } = await supabase.from("category_settings").upsert({ slug, name, image_url: imageUrl, sort_order: current.sort_order, active: true, updated_at: new Date().toISOString() }, { onConflict: "slug" }).select("slug,name,image_url,sort_order,active,updated_at").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Admin category update error:", error);
      res.status(500).json({ success: false, message: error.message || "Kategoriya saqlanmadi" });
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
