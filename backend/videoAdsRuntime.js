// ============================================================================
// GULI MARKET: PROFESSIONAL VIDEO ADS RUNTIME & API
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

// Built-in fallback video ads in case database migration hasn't been applied yet
const DEFAULT_VIDEO_ADS = [
  {
    id: "v-ad-default-1",
    title: "Guli Premium Pijamalar To‘plami",
    description: "Yangi ipak va paxta to‘plamlari bilan beqiyos qulaylikni his qiling.",
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    cta_text: "Xarid qilish",
    destination_url: "/?category=Pijamalar",
    product_id: null,
    placement: "all",
    platform: "all",
    priority: 10,
    frequency_cap: 5,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory stats tracker for resilience
const inMemoryEvents = [];
const eventRateLimitMap = new Map();

function isValidUrl(str) {
  if (!str || typeof str !== "string") return false;
  const s = str.trim();
  if (/^(javascript|data|vbscript|file):/i.test(s)) return false;
  if (s.startsWith("/")) return true;
  return /^(https?:\/\/|tg:\/\/)/i.test(s);
}

function calculateCtr(clicks, impressions) {
  if (!impressions || impressions <= 0 || clicks <= 0) return 0;
  return Math.min(100, Math.round(((clicks / impressions) * 100) * 10) / 10);
}

// ----------------------------------------------------------------------------
// 1. PUBLIC API: GET /api/video-ads
// Returns active, unexpired video ads filtered by placement and platform
// ----------------------------------------------------------------------------
install("get", "/api/video-ads", async (req, res) => {
  try {
    const placement = String(req.query.placement || "all").trim();
    const platform = String(req.query.platform || "all").trim();
    const nowIso = new Date().toISOString();

    const client = getSupabaseClient();
    if (client) {
      let query = client
        .from("video_ads")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (placement && placement !== "all") {
        query = query.or(`placement.eq.${placement},placement.eq.all`);
      }

      if (platform && platform !== "all") {
        query = query.or(`platform.eq.${platform},platform.eq.all`);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        // Filter by start and end timestamps in JS for time-zone reliability
        const filtered = data.filter((ad) => {
          if (ad.starts_at && new Date(ad.starts_at).toISOString() > nowIso) return false;
          if (ad.ends_at && new Date(ad.ends_at).toISOString() < nowIso) return false;
          return true;
        });

        res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
        return res.json({ success: true, data: filtered });
      }
    }

    // Fallback if table not yet seeded or DB temporarily unavailable
    const fallbackList = DEFAULT_VIDEO_ADS.filter((ad) => {
      if (!ad.is_active) return false;
      if (placement !== "all" && ad.placement !== "all" && ad.placement !== placement) return false;
      if (platform !== "all" && ad.platform !== "all" && ad.platform !== platform) return false;
      return true;
    });

    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.json({ success: true, data: fallbackList });
  } catch (error) {
    console.error("[Video Ads] Public GET error:", error);
    return res.status(500).json({ success: false, message: "Reklamalarni yuklashda xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 2. PUBLIC API: POST /api/video-ads/:id/events
// Records anonymous impression, click, and play analytics
// ----------------------------------------------------------------------------
install("post", "/api/video-ads/:id/events", async (req, res) => {
  try {
    const adId = String(req.params.id || "").trim();
    const body = req.body || {};
    const eventType = String(body.event_type || "").trim();
    const sessionId = body.session_id ? String(body.session_id).slice(0, 80) : null;
    const platform = body.platform === "telegram" ? "telegram" : "web";

    if (!adId) {
      return res.status(400).json({ success: false, message: "Reklama identifikatori talab qilinadi" });
    }

    const ALLOWED_EVENTS = ["impression", "click", "video_start", "video_complete"];
    if (!ALLOWED_EVENTS.includes(eventType)) {
      return res.status(400).json({ success: false, message: "Noto‘g‘ri event turi" });
    }

    // Deduplication check: max 1 impression per ad per session per 3 minutes
    if (sessionId && eventType === "impression") {
      const dedupKey = `${adId}:${sessionId}:${eventType}`;
      const lastRecorded = eventRateLimitMap.get(dedupKey);
      const now = Date.now();
      if (lastRecorded && now - lastRecorded < 180000) {
        return res.json({ success: true, message: "Deduplicated" });
      }
      eventRateLimitMap.set(dedupKey, now);

      // Clean up map periodically
      if (eventRateLimitMap.size > 2000) {
        const threshold = now - 300000;
        for (const [k, v] of eventRateLimitMap.entries()) {
          if (v < threshold) eventRateLimitMap.delete(k);
        }
      }
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from("video_ad_events").insert([
          {
            ad_id: adId,
            event_type: eventType,
            session_id: sessionId,
            platform,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (insertError) {
        console.warn("[Video Ads] Event insert warning:", insertError.message);
      }
    }

    // Track in memory buffer for quick aggregated counts
    inMemoryEvents.push({
      ad_id: adId,
      event_type: eventType,
      created_at: Date.now(),
    });
    if (inMemoryEvents.length > 5000) {
      inMemoryEvents.splice(0, 1000);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[Video Ads] Event recording error:", error);
    return res.status(500).json({ success: false, message: "Statistikani saqlashda xatolik" });
  }
});

// ----------------------------------------------------------------------------
// 3. ADMIN API: GET /api/admin/video-ads
// Returns all ads with individual impression and click stats
// ----------------------------------------------------------------------------
install("get", "/api/admin/video-ads", requireAdmin, async (req, res) => {
  try {
    const client = getSupabaseClient();
    let ads = [];

    if (client) {
      const { data, error } = await client
        .from("video_ads")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        ads = data;
      }
    }

    if (!ads.length) {
      ads = [...DEFAULT_VIDEO_ADS];
    }

    // Calculate aggregated stats for each ad
    let statsByAd = {};
    if (client) {
      try {
        const { data: eventsData } = await client
          .from("video_ad_events")
          .select("ad_id, event_type");

        if (Array.isArray(eventsData)) {
          for (const ev of eventsData) {
            if (!statsByAd[ev.ad_id]) {
              statsByAd[ev.ad_id] = { impressions: 0, clicks: 0 };
            }
            if (ev.event_type === "impression") statsByAd[ev.ad_id].impressions++;
            if (ev.event_type === "click") statsByAd[ev.ad_id].clicks++;
          }
        }
      } catch (statsErr) {
        console.warn("[Video Ads] Could not fetch DB events, using memory stats:", statsErr.message);
      }
    }

    // Merge in-memory events if DB events were empty
    for (const ev of inMemoryEvents) {
      if (!statsByAd[ev.ad_id]) {
        statsByAd[ev.ad_id] = { impressions: 0, clicks: 0 };
      }
      if (ev.event_type === "impression") statsByAd[ev.ad_id].impressions++;
      if (ev.event_type === "click") statsByAd[ev.ad_id].clicks++;
    }

    const adsWithStats = ads.map((ad) => {
      const st = statsByAd[ad.id] || { impressions: 0, clicks: 0 };
      return {
        ...ad,
        stats: {
          impressions: st.impressions,
          clicks: st.clicks,
          ctr: calculateCtr(st.clicks, st.impressions),
        },
      };
    });

    return res.json({ success: true, data: adsWithStats });
  } catch (error) {
    console.error("[Video Ads] Admin GET error:", error);
    return res.status(500).json({ success: false, message: "Reklamalarni yuklashda xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 4. ADMIN API: GET /api/admin/video-ads/stats
// Returns overall summary KPI cards
// ----------------------------------------------------------------------------
install("get", "/api/admin/video-ads/stats", requireAdmin, async (req, res) => {
  try {
    const client = getSupabaseClient();
    let totalAds = 0;
    let activeAds = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    if (client) {
      try {
        const { count: countTotal } = await client.from("video_ads").select("*", { count: "exact", head: true });
        const { count: countActive } = await client.from("video_ads").select("*", { count: "exact", head: true }).eq("is_active", true);
        totalAds = countTotal || 0;
        activeAds = countActive || 0;

        const { data: eventsData } = await client.from("video_ad_events").select("event_type");
        if (Array.isArray(eventsData)) {
          for (const ev of eventsData) {
            if (ev.event_type === "impression") totalImpressions++;
            if (ev.event_type === "click") totalClicks++;
          }
        }
      } catch (err) {
        console.warn("[Video Ads] Stats DB query warning:", err.message);
      }
    }

    // Merge in-memory if DB counts were zero
    if (totalImpressions === 0 && totalClicks === 0 && inMemoryEvents.length > 0) {
      for (const ev of inMemoryEvents) {
        if (ev.event_type === "impression") totalImpressions++;
        if (ev.event_type === "click") totalClicks++;
      }
    }
    if (totalAds === 0) {
      totalAds = DEFAULT_VIDEO_ADS.length;
      activeAds = DEFAULT_VIDEO_ADS.filter((a) => a.is_active).length;
    }

    return res.json({
      success: true,
      data: {
        total_ads: totalAds,
        active_ads: activeAds,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        overall_ctr: calculateCtr(totalClicks, totalImpressions),
      },
    });
  } catch (error) {
    console.error("[Video Ads] Admin stats summary error:", error);
    return res.status(500).json({ success: false, message: "Statistikani hisoblashda xatolik" });
  }
});

// ----------------------------------------------------------------------------
// 5. ADMIN API: POST /api/admin/video-ads (Create Video Ad)
// ----------------------------------------------------------------------------
install("post", "/api/admin/video-ads", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const description = body.description ? String(body.description).trim() : null;
    const videoUrl = String(body.video_url || "").trim();
    const posterUrl = body.poster_url ? String(body.poster_url).trim() : null;
    const ctaText = String(body.cta_text || "Batafsil").trim();
    const destinationUrl = body.destination_url ? String(body.destination_url).trim() : null;
    const productId = body.product_id ? String(body.product_id).trim() : null;
    const placement = ["home", "product_feed", "all"].includes(body.placement) ? body.placement : "home";
    const platform = ["all", "web", "telegram"].includes(body.platform) ? body.platform : "all";
    const priority = Number(body.priority) || 0;
    const frequencyCap = Math.max(1, Math.min(100, Number(body.frequency_cap) || 5));
    const isActive = body.is_active !== false;
    const startsAt = body.starts_at ? new Date(body.starts_at).toISOString() : null;
    const endsAt = body.ends_at ? new Date(body.ends_at).toISOString() : null;

    if (!title) {
      return res.status(400).json({ success: false, message: "Reklama nomi talab qilinadi" });
    }
    if (!videoUrl || !isValidUrl(videoUrl)) {
      return res.status(400).json({ success: false, message: "Yaroqli video URL manzili kiriting (https:// yoki mp4/webm)" });
    }
    if (posterUrl && !isValidUrl(posterUrl)) {
      return res.status(400).json({ success: false, message: "Poster URL formati noto‘g‘ri" });
    }
    if (destinationUrl && !isValidUrl(destinationUrl)) {
      return res.status(400).json({ success: false, message: "Manzil URL formati noto‘g‘ri (xavfli protokollar taqiqlangan)" });
    }

    const payload = {
      title,
      description,
      video_url: videoUrl,
      poster_url: posterUrl,
      cta_text: ctaText || "Batafsil",
      destination_url: destinationUrl,
      product_id: productId,
      placement,
      platform,
      priority,
      frequency_cap: frequencyCap,
      is_active: isActive,
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from("video_ads")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("[Video Ads] DB Insert error:", error);
        return res.status(500).json({ success: false, message: "Reklamani ma'lumotlar bazasiga saqlashda xatolik: " + error.message });
      }

      return res.status(201).json({ success: true, message: "Video reklama muvaffaqiyatli saqlandi", data });
    }

    // In-memory fallback
    const mockCreated = {
      id: `v-ad-${Date.now()}`,
      ...payload,
    };
    DEFAULT_VIDEO_ADS.unshift(mockCreated);
    return res.status(201).json({ success: true, message: "Video reklama saqlandi (xotira rejimida)", data: mockCreated });
  } catch (error) {
    console.error("[Video Ads] Create error:", error);
    return res.status(500).json({ success: false, message: "Serverda kutilmagan xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 6. ADMIN API: PUT /api/admin/video-ads/:id (Update Video Ad)
// ----------------------------------------------------------------------------
install("put", "/api/admin/video-ads/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ success: false, message: "Reklama ID talab qilinadi" });

    const body = req.body || {};
    const title = String(body.title || "").trim();
    const videoUrl = String(body.video_url || "").trim();
    const posterUrl = body.poster_url ? String(body.poster_url).trim() : null;
    const destinationUrl = body.destination_url ? String(body.destination_url).trim() : null;

    if (!title) return res.status(400).json({ success: false, message: "Reklama nomi talab qilinadi" });
    if (!videoUrl || !isValidUrl(videoUrl)) return res.status(400).json({ success: false, message: "Yaroqli video URL manzili kiriting" });
    if (posterUrl && !isValidUrl(posterUrl)) return res.status(400).json({ success: false, message: "Poster URL formati noto‘g‘ri" });
    if (destinationUrl && !isValidUrl(destinationUrl)) return res.status(400).json({ success: false, message: "Manzil URL formati noto‘g‘ri" });

    const payload = {
      title,
      description: body.description ? String(body.description).trim() : null,
      video_url: videoUrl,
      poster_url: posterUrl,
      cta_text: String(body.cta_text || "Batafsil").trim(),
      destination_url: destinationUrl,
      product_id: body.product_id ? String(body.product_id).trim() : null,
      placement: ["home", "product_feed", "all"].includes(body.placement) ? body.placement : "home",
      platform: ["all", "web", "telegram"].includes(body.platform) ? body.platform : "all",
      priority: Number(body.priority) || 0,
      frequency_cap: Math.max(1, Math.min(100, Number(body.frequency_cap) || 5)),
      is_active: body.is_active !== false,
      starts_at: body.starts_at ? new Date(body.starts_at).toISOString() : null,
      ends_at: body.ends_at ? new Date(body.ends_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from("video_ads")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[Video Ads] Update DB error:", error);
        return res.status(500).json({ success: false, message: "Reklamani yangilashda xatolik: " + error.message });
      }

      return res.json({ success: true, message: "Video reklama yangilandi", data });
    }

    const idx = DEFAULT_VIDEO_ADS.findIndex((a) => a.id === id);
    if (idx !== -1) {
      DEFAULT_VIDEO_ADS[idx] = { ...DEFAULT_VIDEO_ADS[idx], ...payload };
      return res.json({ success: true, message: "Video reklama yangilandi", data: DEFAULT_VIDEO_ADS[idx] });
    }

    return res.status(404).json({ success: false, message: "Reklama topilmadi" });
  } catch (error) {
    console.error("[Video Ads] Update error:", error);
    return res.status(500).json({ success: false, message: "Serverda kutilmagan xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 7. ADMIN API: PATCH /api/admin/video-ads/:id/status (Toggle is_active)
// ----------------------------------------------------------------------------
install("patch", "/api/admin/video-ads/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const isActive = Boolean(req.body?.is_active);

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from("video_ads")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, is_active")
        .single();

      if (error) {
        return res.status(500).json({ success: false, message: "Holatni o‘zgartirishda xatolik" });
      }

      return res.json({ success: true, data });
    }

    const item = DEFAULT_VIDEO_ADS.find((a) => a.id === id);
    if (item) {
      item.is_active = isActive;
      return res.json({ success: true, data: { id, is_active: isActive } });
    }

    return res.status(404).json({ success: false, message: "Reklama topilmadi" });
  } catch (error) {
    console.error("[Video Ads] Status toggle error:", error);
    return res.status(500).json({ success: false, message: "Xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 8. ADMIN API: DELETE /api/admin/video-ads/:id (Delete Video Ad)
// ----------------------------------------------------------------------------
install("delete", "/api/admin/video-ads/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();

    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("video_ads").delete().eq("id", id);
      if (error) {
        return res.status(500).json({ success: false, message: "O‘chirishda xatolik: " + error.message });
      }
      return res.json({ success: true, message: "Reklama o‘chirildi" });
    }

    const idx = DEFAULT_VIDEO_ADS.findIndex((a) => a.id === id);
    if (idx !== -1) {
      DEFAULT_VIDEO_ADS.splice(idx, 1);
      return res.json({ success: true, message: "Reklama o‘chirildi" });
    }

    return res.status(404).json({ success: false, message: "Reklama topilmadi" });
  } catch (error) {
    console.error("[Video Ads] Delete error:", error);
    return res.status(500).json({ success: false, message: "Xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 9. ADMIN API: POST /api/admin/video-ads/upload (Upload Media to Storage)
// Accepts base64 encoded media (video or poster image)
// ----------------------------------------------------------------------------
install("post", "/api/admin/video-ads/upload", requireAdmin, async (req, res) => {
  try {
    const { data: base64Data, mimeType, extension, mediaType } = req.body || {};

    if (!base64Data || typeof base64Data !== "string") {
      return res.status(400).json({ success: false, message: "Fayl ma'lumoti topilmadi" });
    }

    const ALLOWED_MIME = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const safeMime = String(mimeType || "").toLowerCase().trim();
    if (!ALLOWED_MIME.includes(safeMime)) {
      return res.status(400).json({
        success: false,
        message: "Ruxsat etilmagan fayl formati. Faqat MP4, WebM, MOV, JPG, PNG yoki WebP qabul qilinadi.",
      });
    }

    const isVideo = safeMime.startsWith("video/");
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 6 * 1024 * 1024; // 50MB for video, 6MB for poster
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > maxBytes) {
      return res.status(413).json({
        success: false,
        message: `Fayl hajmi juda katta (maksimal: ${isVideo ? "50 MB" : "6 MB"}).`,
      });
    }

    const extClean = String(extension || (isVideo ? "mp4" : "jpg"))
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || (isVideo ? "mp4" : "jpg");

    const folder = isVideo ? "videos" : "posters";
    const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extClean}`;

    const client = getSupabaseClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: "Supabase Storage ulanishi mavjud emas. Iltimos, to‘g‘ridan-to‘g‘ri video URL kiriting.",
      });
    }

    const { error: uploadError } = await client.storage
      .from("video-ads")
      .upload(fileName, buffer, {
        contentType: safeMime,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Video Ads] Storage upload error:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Storage'ga yuklashda xatolik: " + uploadError.message,
      });
    }

    const publicRes = client.storage.from("video-ads").getPublicUrl(fileName);
    const publicUrl = publicRes?.data?.publicUrl;

    if (!publicUrl) {
      return res.status(500).json({ success: false, message: "Public URL olinmadi" });
    }

    return res.json({
      success: true,
      message: "Fayl muvaffaqiyatli yuklandi",
      url: publicUrl,
      path: fileName,
      bytes: buffer.length,
    });
  } catch (error) {
    console.error("[Video Ads] Upload handler error:", error);
    return res.status(500).json({ success: false, message: "Faylni qayta ishlashda xatolik yuz berdi" });
  }
});

module.exports = {
  isValidUrl,
  calculateCtr,
};
