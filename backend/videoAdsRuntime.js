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
      if (error) {
        console.error("[Video Ads] Public query failed:", error.message);
        return res.status(503).json({ success: false, message: "Video reklamalar vaqtincha mavjud emas" });
      }

      if (Array.isArray(data)) {
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

    console.error("[Video Ads] Supabase is not configured");
    return res.status(503).json({ success: false, message: "Video reklama xizmati vaqtincha mavjud emas" });
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

    const client = getSupabaseClient();
    if (!client) {
      return res.status(503).json({ success: false, message: "Statistika xizmati vaqtincha mavjud emas" });
    }

    // Stable impression IDs make writes idempotent across retries and instances.
    const eventId = eventType === "impression" && sessionId && sessionId !== "sid_anon"
      ? "impression:" + adId + ":" + sessionId
      : crypto.randomUUID();
    const { error: insertError } = await client
      .from("video_ad_events")
      .upsert([{
        event_id: eventId,
        ad_id: adId,
        event_type: eventType,
        session_id: sessionId,
        platform,
        created_at: new Date().toISOString(),
      }], { onConflict: "event_id", ignoreDuplicates: true });

    if (insertError) {
      console.error("[Video Ads] Event insert failed:", insertError.message);
      return res.status(503).json({ success: false, message: "Statistikani saqlab bo‘lmadi" });
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
    if (!client) {
      return res.status(503).json({ success: false, message: "Video reklama bazasiga ulanish mavjud emas" });
    }

    const { data: ads, error: adsError } = await client
      .from("video_ads")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (adsError || !Array.isArray(ads)) {
      console.error("[Video Ads] Admin list query failed:", adsError?.message || "Invalid response");
      return res.status(503).json({ success: false, message: "Reklamalarni bazadan yuklab bo‘lmadi" });
    }

    // Calculate aggregated stats for each ad
    let statsByAd = {};
    if (client) {
      try {
        const { data: eventsData, error: eventsError } = await client
          .from("video_ad_events")
          .select("ad_id, event_type");
        if (eventsError) {
          console.error("[Video Ads] Admin event query failed:", eventsError.message);
          return res.status(503).json({ success: false, message: "Reklama statistikasi mavjud emas" });
        }

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
    if (!client) {
      return res.status(503).json({ success: false, message: "Video reklama bazasiga ulanish mavjud emas" });
    }

    const [totalResult, activeResult, impressionsResult, clicksResult] = await Promise.all([
      client.from("video_ads").select("id", { count: "exact", head: true }),
      client.from("video_ads").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("video_ad_events").select("id", { count: "exact", head: true }).eq("event_type", "impression"),
      client.from("video_ad_events").select("id", { count: "exact", head: true }).eq("event_type", "click"),
    ]);

    const queryErrors = [totalResult.error, activeResult.error, impressionsResult.error, clicksResult.error].filter(Boolean);
    if (queryErrors.length) {
      console.error("[Video Ads] Stats query failed:", queryErrors.map((e) => e.message).join("; "));
      return res.status(503).json({ success: false, message: "Statistikani bazadan yuklab bo‘lmadi" });
    }

    const totalAds = totalResult.count || 0;
    const activeAds = activeResult.count || 0;
    const totalImpressions = impressionsResult.count || 0;
    const totalClicks = clicksResult.count || 0;

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
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase ulanishi mavjud emas; reklama saqlanmadi" });
    }

    const { data, error } = await client
      .from("video_ads")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[Video Ads] DB Insert error:", error.message);
      return res.status(503).json({ success: false, message: "Reklamani ma’lumotlar bazasiga saqlab bo‘lmadi" });
    }

    return res.status(201).json({ success: true, message: "Video reklama muvaffaqiyatli saqlandi", data });
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
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase ulanishi mavjud emas; o‘zgarishlar saqlanmadi" });
    }

    const { data, error } = await client
      .from("video_ads")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Video Ads] Update DB error:", error.message);
      return res.status(503).json({ success: false, message: "Reklamani yangilab bo‘lmadi" });
    }

    return res.json({ success: true, message: "Video reklama yangilandi", data });
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
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase ulanishi mavjud emas; holat o‘zgartirilmadi" });
    }

    const { data, error } = await client
      .from("video_ads")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, is_active")
      .single();

    if (error) {
      console.error("[Video Ads] Status update failed:", error.message);
      return res.status(503).json({ success: false, message: "Holatni o‘zgartirib bo‘lmadi" });
    }

    return res.json({ success: true, data });
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
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase ulanishi mavjud emas; reklama o‘chirilmadi" });
    }

    const { error } = await client.from("video_ads").delete().eq("id", id);
    if (error) {
      console.error("[Video Ads] Delete failed:", error.message);
      return res.status(503).json({ success: false, message: "Reklamani o‘chirib bo‘lmadi" });
    }
    return res.json({ success: true, message: "Reklama o‘chirildi" });
  } catch (error) {
    console.error("[Video Ads] Delete error:", error);
    return res.status(500).json({ success: false, message: "Xatolik yuz berdi" });
  }
});

// ----------------------------------------------------------------------------
// 9. ADMIN API: POST /api/admin/video-ads/upload-url
// Creates a short-lived signed upload URL; browser uploads the binary directly.
// ----------------------------------------------------------------------------
install("post", "/api/admin/video-ads/upload-url", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const mimeType = String(body.mimeType || "").toLowerCase().trim();
    const mediaType = body.mediaType === "image" ? "image" : "video";
    const size = Number(body.size);
    const allowedMime = mediaType === "video"
      ? new Set(["video/mp4", "video/webm", "video/quicktime"])
      : new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxBytes = mediaType === "video" ? 50 * 1024 * 1024 : 6 * 1024 * 1024;

    if (!allowedMime.has(mimeType)) {
      return res.status(400).json({ success: false, message: "Fayl formati qo‘llab-quvvatlanmaydi" });
    }
    if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
      return res.status(413).json({ success: false, message: "Fayl hajmi limitidan oshmasligi kerak" });
    }

    const extensionByMime = {
      "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    };
    const folder = mediaType === "video" ? "videos" : "posters";
    const path = folder + "/" + Date.now() + "-" + crypto.randomBytes(8).toString("hex") + "." + extensionByMime[mimeType];
    const client = getSupabaseClient();
    if (!client) {
      return res.status(503).json({ success: false, message: "Supabase Storage ulanishi mavjud emas" });
    }

    const { data, error } = await client.storage.from("video-ads").createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      console.error("[Video Ads] Signed upload URL error:", error?.message || "Missing signed URL");
      return res.status(503).json({ success: false, message: "Yuklash havolasini yaratib bo‘lmadi" });
    }

    const { data: publicData } = client.storage.from("video-ads").getPublicUrl(path);
    return res.json({
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || path,
      url: publicData?.publicUrl || null,
      maxBytes,
    });
  } catch (error) {
    console.error("[Video Ads] Signed upload URL handler error:", error.message);
    return res.status(500).json({ success: false, message: "Yuklashni tayyorlashda xatolik yuz berdi" });
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
    const maxBytes = isVideo ? 10 * 1024 * 1024 : 4 * 1024 * 1024; // Legacy Base64 route must fit under the 15 MB JSON parser limit
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
