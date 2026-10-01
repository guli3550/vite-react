// ============================================================================
// GULI MARKET: ANIMATED SOCIAL PROMO BUTTONS RUNTIME & BACKEND API
// ============================================================================

const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { requireAdmin } = require("./adminAuth");

function cleanEnv(val) {
  return String(val || "").trim().replace(/^['"]|['"]$/g, "");
}

function getSupabaseClient() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = cleanEnv(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY
  );
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    if (!client) return null;
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

// Built-in resilient defaults so the UI always functions even before migration
const DEFAULT_SETTINGS = [
  { row_number: 1, is_enabled: true, direction: "left", duration_seconds: 34 },
  { row_number: 2, is_enabled: true, direction: "right", duration_seconds: 42 },
  { row_number: 3, is_enabled: true, direction: "left", duration_seconds: 36 },
];

const DEFAULT_ITEMS = [
  // Row 1
  {
    id: "promo-def-1",
    title: "Instagram Guli",
    platform: "instagram",
    label: "Instagram · @guli_market",
    target_url: "https://www.instagram.com/guli_market",
    logo_url: null,
    row_number: 1,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-2",
    title: "Telegram Kanal",
    platform: "telegram",
    label: "Telegram · Rasmiy kanal",
    target_url: "https://t.me/guli_market",
    logo_url: null,
    row_number: 1,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-3",
    title: "YouTube Guli",
    platform: "youtube",
    label: "YouTube · Guli Market TV",
    target_url: "https://www.youtube.com/@guli_market",
    logo_url: null,
    row_number: 1,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-4",
    title: "Telegram Bot",
    platform: "telegram",
    label: "Telegram · Buyurtmalar boti",
    target_url: "https://t.me/guli_market_bot",
    logo_url: null,
    row_number: 1,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },

  // Row 2
  {
    id: "promo-def-5",
    title: "Instagram Obzor",
    platform: "instagram",
    label: "Instagram · Yangi kolleksiya",
    target_url: "https://www.instagram.com/guli_market",
    logo_url: null,
    row_number: 2,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-6",
    title: "Telegram Hamjamiyat",
    platform: "telegram",
    label: "Telegram · Mijozlar guruhi",
    target_url: "https://t.me/guli_market_chat",
    logo_url: null,
    row_number: 2,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-7",
    title: "YouTube Obzor",
    platform: "youtube",
    label: "YouTube · Moda va stillar",
    target_url: "https://www.youtube.com/@guli_market",
    logo_url: null,
    row_number: 2,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-8",
    title: "Instagram Reels",
    platform: "instagram",
    label: "Instagram · Eksklyuziv Reels",
    target_url: "https://www.instagram.com/guli_market/reels",
    logo_url: null,
    row_number: 2,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },

  // Row 3
  {
    id: "promo-def-9",
    title: "Telegram Aloqa",
    platform: "telegram",
    label: "Telegram · 24/7 Qo‘llab-quvvatlash",
    target_url: "https://t.me/guli_support",
    logo_url: null,
    row_number: 3,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-10",
    title: "Instagram VIP",
    platform: "instagram",
    label: "Instagram · Maxsus chegirmalar",
    target_url: "https://www.instagram.com/guli_market",
    logo_url: null,
    row_number: 3,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-11",
    title: "YouTube Shorts",
    platform: "youtube",
    label: "YouTube · Mahsulot videolari",
    target_url: "https://www.youtube.com/@guli_market/shorts",
    logo_url: null,
    row_number: 3,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "promo-def-12",
    title: "Telegram Yangiliklar",
    platform: "telegram",
    label: "Telegram · Hafta yangiliklari",
    target_url: "https://t.me/guli_news",
    logo_url: null,
    row_number: 3,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
];

// In-memory runtime cache for hot fallback
let memoryItems = [...DEFAULT_ITEMS];
let memorySettings = [...DEFAULT_SETTINGS];

function isValidUrl(raw) {
  if (!raw || typeof raw !== "string") return false;
  const str = raw.trim();
  if (/^javascript:/i.test(str) || /^data:text\/html/i.test(str)) return false;
  try {
    if (str.startsWith("tg://")) return true;
    const parsed = new URL(str);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// 1. PUBLIC API: GET /api/social-promos
// ----------------------------------------------------------------------------
install("get", "/api/social-promos", async (req, res) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return res.status(503).json({ success: false, source: "database_unavailable", message: "Reklama ma’lumotlari vaqtincha yuklanmadi." });
    }

    // Query active items from DB
    const nowIso = new Date().toISOString();
    const [itemsResult, settingsResult] = await Promise.all([
      client
        .from("social_promo_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      client
        .from("social_promo_settings")
        .select("*")
        .order("row_number", { ascending: true }),
    ]);

    let items = itemsResult.data;
    let settings = settingsResult.data;

    // Check if table not created or query errored
    if (itemsResult.error || settingsResult.error) throw itemsResult.error || settingsResult.error;
    if (!items) items = [];
    if (!settings) settings = [];
    {
      // Filter out any date-expired or upcoming promos
      items = items.filter((it) => {
        if (it.start_at && it.start_at > nowIso) return false;
        if (it.end_at && it.end_at < nowIso) return false;
        return true;
      });
    }


    // Group items by row
    return res.json({
      success: true,
      data: {
        items,
        settings,
      },
    });
  } catch (error) {
    console.warn("[Social Promos] Public GET error:", error?.message || error);
    return res.status(503).json({ success: false, source: "database_error", message: "Reklama ma’lumotlari vaqtincha yuklanmadi." });
  }
});

// ----------------------------------------------------------------------------
// 2. ADMIN API: GET /api/admin/social-promos
// ----------------------------------------------------------------------------
install("get", "/api/admin/social-promos", requireAdmin, async (req, res) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase sozlanmagan. Admin ma'lumotlari xavfsiz saqlanmadi." });
    }

    const [itemsResult, settingsResult] = await Promise.all([
      client
        .from("social_promo_items")
        .select("*")
        .order("row_number", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("social_promo_settings")
        .select("*")
        .order("row_number", { ascending: true }),
    ]);

    let items = itemsResult.data;
    let settings = settingsResult.data;

    if (itemsResult.error || settingsResult.error) {
      throw itemsResult.error || settingsResult.error;
    }
    items = items || [];
    settings = settings || [];

    return res.json({
      success: true,
      data: {
        items,
        settings,
      },
    });
  } catch (error) {
    console.error("[Social Promos] Admin GET error:", error);
    return res.status(500).json({ success: false, message: "Ma'lumotlarni yuklashda xatolik" });
  }
});

// ----------------------------------------------------------------------------
// 3. ADMIN API: POST /api/admin/social-promos (Create Item)
// ----------------------------------------------------------------------------
install("post", "/api/admin/social-promos", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const platform = String(body.platform || "custom").toLowerCase().trim();
    const label = String(body.label || "").trim();
    const targetUrl = String(body.target_url || "").trim();
    const rowNumber = Number(body.row_number) || 1;
    const sortOrder = Number(body.sort_order) || 0;
    const isActive = body.is_active !== false;
    const openInNewTab = body.open_in_new_tab !== false;
    const mobileVisible = body.mobile_visible !== false;
    const logoUrl = body.logo_url ? String(body.logo_url).trim() : null;
    const startAt = body.start_at ? new Date(body.start_at).toISOString() : null;
    const endAt = body.end_at ? new Date(body.end_at).toISOString() : null;

    if (!title) return res.status(400).json({ success: false, message: "Promo nomi talab qilinadi" });
    if (!label) return res.status(400).json({ success: false, message: "Tugma matni talab qilinadi" });
    if (!targetUrl || !isValidUrl(targetUrl)) {
      return res.status(400).json({ success: false, message: "Yaroqli URL manzilini kiriting (https:// yoki t.me)" });
    }
    if (rowNumber < 1 || rowNumber > 3) {
      return res.status(400).json({ success: false, message: "Qator raqami 1, 2 yoki 3 bo'lishi kerak" });
    }

    const payload = {
      title,
      platform: ["instagram", "telegram", "youtube", "custom"].includes(platform) ? platform : "custom",
      label,
      target_url: targetUrl,
      logo_url: logoUrl,
      row_number: rowNumber,
      sort_order: sortOrder,
      is_active: isActive,
      open_in_new_tab: openInNewTab,
      mobile_visible: mobileVisible,
      start_at: startAt,
      end_at: endAt,
      updated_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from("social_promo_items")
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        // update memory
        memoryItems.unshift(data);
        return res.status(201).json({ success: true, message: "Promo tugma muvaffaqiyatli yaratildi ✓", data });
      }
      if (error) throw error;
    }

    return res.status(503).json({ success: false, message: "Promo bazaga saqlanmadi. Supabase jadvali va ulanishini tekshiring." });
  } catch (error) {
    console.error("[Social Promos] Create error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Saqlashda xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 4. ADMIN API: PATCH /api/admin/social-promos/:id (Update Item)
// ----------------------------------------------------------------------------
install("patch", "/api/admin/social-promos/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};

    const updates = {};
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.platform !== undefined) updates.platform = String(body.platform).toLowerCase().trim();
    if (body.label !== undefined) updates.label = String(body.label).trim();
    if (body.target_url !== undefined) {
      const u = String(body.target_url).trim();
      if (!isValidUrl(u)) return res.status(400).json({ success: false, message: "Noto'g'ri URL manzili" });
      updates.target_url = u;
    }
    if (body.row_number !== undefined) {
      const r = Number(body.row_number);
      if (r >= 1 && r <= 3) updates.row_number = r;
    }
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.open_in_new_tab !== undefined) updates.open_in_new_tab = Boolean(body.open_in_new_tab);
    if (body.mobile_visible !== undefined) updates.mobile_visible = Boolean(body.mobile_visible);
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url ? String(body.logo_url).trim() : null;
    if (body.start_at !== undefined) updates.start_at = body.start_at ? new Date(body.start_at).toISOString() : null;
    if (body.end_at !== undefined) updates.end_at = body.end_at ? new Date(body.end_at).toISOString() : null;
    updates.updated_at = new Date().toISOString();

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from("social_promo_items")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        memoryItems = memoryItems.map((m) => (m.id === id ? { ...m, ...data } : m));
        return res.json({ success: true, message: "O'zgarishlar saqlandi ✓", data });
      }
    }

    if (!client) return res.status(503).json({ success: false, message: "Supabase ulanmagan. O'zgarish saqlanmadi." });
    return res.status(404).json({ success: false, message: "Promo tugma topilmadi yoki bazada yangilanmadi" });
  } catch (error) {
    console.error("[Social Promos] Update error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Tahrirlashda xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 5. ADMIN API: DELETE /api/admin/social-promos/:id (Delete Item)
// ----------------------------------------------------------------------------
install("delete", "/api/admin/social-promos/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const client = getSupabaseClient();
    if (!client) return res.status(503).json({ success: false, message: "Supabase ulanmagan. Promo o'chirilmadi." });
    const { error } = await client.from("social_promo_items").delete().eq("id", id);
    if (error) throw error;
    memoryItems = memoryItems.filter((it) => it.id !== id);

    return res.json({ success: true, message: "Promo tugma muvaffaqiyatli o'chirildi ✓" });
  } catch (error) {
    console.error("[Social Promos] Delete error:", error);
    return res.status(500).json({ success: false, message: error?.message || "O'chirishda xatolik" });
  }
});

// ----------------------------------------------------------------------------
// 6. ADMIN API: PATCH /api/admin/social-promos/settings (Row Marquee Settings)
// ----------------------------------------------------------------------------
install("patch", "/api/admin/social-promos/settings", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const settingsList = Array.isArray(body.settings) ? body.settings : [body];

    const updatedSettings = [];
    const client = getSupabaseClient();
    if (!client) return res.status(503).json({ success: false, message: "Supabase ulanmagan. Sozlamalar saqlanmadi." });

    for (const s of settingsList) {
      const rowNumber = Number(s.row_number);
      if (!rowNumber || rowNumber < 1 || rowNumber > 3) continue;

      const rowUpdate = {
        row_number: rowNumber,
        is_enabled: s.is_enabled !== false,
        direction: s.direction === "right" ? "right" : "left",
        duration_seconds: Math.max(8, Math.min(180, Number(s.duration_seconds) || 35)),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from("social_promo_settings")
        .upsert([rowUpdate], { onConflict: "row_number" })
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("Qator sozlamasi bazadan tasdiqlanmadi");
      updatedSettings.push(data);
    }

    return res.json({
      success: true,
      message: "Qator sozlamalari yangilandi ✓",
      data: updatedSettings.length ? updatedSettings : memorySettings,
    });
  } catch (error) {
    console.error("[Social Promos] Settings update error:", error);
    return res.status(500).json({ success: false, message: "Qator sozlamalarini saqlashda xatolik" });
  }
});

// ----------------------------------------------------------------------------
// 7. ADMIN API: POST /api/admin/social-promos/upload-logo (Logo Upload)
// ----------------------------------------------------------------------------
install("post", "/api/admin/social-promos/upload-logo", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const dataUri = String(body.dataUri || body.image || "").trim();

    const match = dataUri.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ success: false, message: "Faqat PNG, JPG yoki WebP rasm formatlari qo'llab-quvvatlanadi" });
    }

    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");

    if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Logo hajmi 2MB dan oshmasligi kerak" });
    }

    const ext = mime.includes("svg") ? "svg" : mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const filename = `social_logo_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;

    const client = getSupabaseClient();
    if (client) {
      try {
        const bucketName = "review-images"; // reuse existing storage bucket
        const { error: uploadError } = await client.storage
          .from(bucketName)
          .upload(filename, buffer, {
            contentType: mime,
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = client.storage
            .from(bucketName)
            .getPublicUrl(filename);

          if (publicUrlData?.publicUrl) {
            return res.json({
              success: true,
              message: "Logo muvaffaqiyatli yuklandi ✓",
              data: { url: publicUrlData.publicUrl },
            });
          }
        }
      } catch (e) {
        console.warn("[Social Promos] Storage upload fallback to data URI:", e.message);
      }
    }

    // Fallback: return optimized data URI
    return res.json({
      success: true,
      message: "Logo qabul qilindi ✓",
      data: { url: dataUri },
    });
  } catch (error) {
    console.error("[Social Promos] Logo upload error:", error);
    return res.status(500).json({ success: false, message: "Logo yuklashda xatolik yuz berdi" });
  }
});

module.exports = {
  DEFAULT_ITEMS,
  DEFAULT_SETTINGS,
};
