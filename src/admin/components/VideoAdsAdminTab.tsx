import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { VideoAd, VideoAdStatsSummary } from "../../types/videoAd";
import { calculateCtr } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { VideoAdModal } from "./VideoAdModal";
import "./VideoAdsAdmin.css";

interface VideoAdsAdminTabProps {
  notify: (msg: string) => void;
}

type SortOption = "newest" | "priority_desc" | "ctr_desc" | "impressions_desc" | "clicks_desc";

export const VideoAdsAdminTab: React.FC<VideoAdsAdminTabProps> = ({ notify }) => {
  const [ads, setAds] = useState<VideoAd[]>([]);
  const [stats, setStats] = useState<VideoAdStatsSummary>({
    total_ads: 0,
    active_ads: 0,
    total_impressions: 0,
    total_clicks: 0,
    overall_ctr: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlacement, setFilterPlacement] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<VideoAd | null>(null);
  const [deletingAd, setDeletingAd] = useState<VideoAd | null>(null);
  const [simulatingAd, setSimulatingAd] = useState<VideoAd | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [simulatorPlatform, setSimulatorPlatform] = useState<"telegram" | "web">("telegram");
  const [simulatorMuted, setSimulatorMuted] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const apiBase = getApiBaseUrl();

      const [adsRes, statsRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/video-ads`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/admin/video-ads/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (adsRes.ok) {
        const adsJson = await adsRes.json();
        if (adsJson.success && Array.isArray(adsJson.data)) {
          setAds(adsJson.data);
        }
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          setStats(statsJson.data);
        }
      }
    } catch (err) {
      console.error("[Video Ads Admin] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async (ad: VideoAd) => {
    const nextStatus = !ad.is_active;
    // Optimistic UI update
    setAds((prev) =>
      prev.map((item) => (item.id === ad.id ? { ...item, is_active: nextStatus } : item))
    );

    try {
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const apiBase = getApiBaseUrl();

      const res = await fetch(`${apiBase}/api/admin/video-ads/${ad.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Holatni o‘zgartirib bo‘lmadi");
      }

      notify(nextStatus ? `✓ “${ad.title}” faollashtirildi` : `“${ad.title}” to‘xtatildi`);
      loadData();
    } catch (err: any) {
      notify(err.message || "Xatolik yuz berdi");
      loadData();
    }
  };

  const handleDuplicate = async (ad: VideoAd) => {
    try {
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const apiBase = getApiBaseUrl();

      const payload = {
        title: `${ad.title} (Nusxa)`,
        description: ad.description,
        video_url: ad.video_url,
        poster_url: ad.poster_url,
        cta_text: ad.cta_text,
        destination_url: ad.destination_url,
        product_id: ad.product_id,
        placement: ad.placement,
        platform: ad.platform,
        priority: ad.priority,
        frequency_cap: ad.frequency_cap,
        is_active: false,
        starts_at: ad.starts_at,
        ends_at: ad.ends_at,
      };

      const res = await fetch(`${apiBase}/api/admin/video-ads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Nusxa yaratishda xatolik");
      }

      notify("Reklamadan nusxa yaratildi ✓");
      loadData();
    } catch (err: any) {
      notify(err.message || "Nusxa yaratib bo‘lmadi");
    }
  };

  const handleCopyLink = (url?: string | null) => {
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      notify("Havola nusxalandi ✓");
    } catch {
      notify("Havolani nusxalab bo‘lmadi");
    }
  };

  const handleDelete = async () => {
    if (!deletingAd) return;
    setDeleting(true);

    try {
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const apiBase = getApiBaseUrl();

      const res = await fetch(`${apiBase}/api/admin/video-ads/${deletingAd.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "O‘chirishda xatolik");
      }

      notify("Video reklama o‘chirildi ✓");
      setDeletingAd(null);
      loadData();
    } catch (err: any) {
      notify(err.message || "O‘chirishda server xatosi");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered and Sorted list
  const filteredAds = useMemo(() => {
    return ads
      .filter((ad) => {
        if (filterStatus === "active" && !ad.is_active) return false;
        if (filterStatus === "inactive" && ad.is_active) return false;
        if (filterPlacement !== "all" && ad.placement !== "all" && ad.placement !== filterPlacement) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = ad.title?.toLowerCase().includes(q);
          const matchesDesc = ad.description?.toLowerCase().includes(q);
          const matchesUrl = ad.destination_url?.toLowerCase().includes(q);
          const matchesCta = ad.cta_text?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesDesc && !matchesUrl && !matchesCta) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const aImp = a.stats?.impressions || 0;
        const bImp = b.stats?.impressions || 0;
        const aClicks = a.stats?.clicks || 0;
        const bClicks = b.stats?.clicks || 0;
        const aCtr = a.stats?.ctr ?? calculateCtr(aClicks, aImp);
        const bCtr = b.stats?.ctr ?? calculateCtr(bClicks, bImp);

        if (sortBy === "ctr_desc") return bCtr - aCtr;
        if (sortBy === "impressions_desc") return bImp - aImp;
        if (sortBy === "clicks_desc") return bClicks - aClicks;
        if (sortBy === "priority_desc") return (b.priority ?? 0) - (a.priority ?? 0);
        if (sortBy === "newest") {
          return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
        }
        return 0;
      });
  }, [ads, filterStatus, filterPlacement, searchQuery, sortBy]);

  const maxImpressions = useMemo(() => {
    return Math.max(1, ...ads.map((a) => a.stats?.impressions || 0));
  }, [ads]);

  return (
    <div className="videoAdsAdminRoot">
      {/* 1. Header Block */}
      <div className="vadsHeader">
        <div className="vadsHeaderTitleBlock">
          <span className="vadsBreadcrumb">Marketing / Video reklamalar</span>
          <h1>Video reklamalar</h1>
          <p className="vadsHeaderSubtitle">
            Bosh sahifa va mahsulotlar oqimida ko‘rsatiluvchi video reklamalarni boshqarish
          </p>
        </div>

        <div className="vadsHeaderActions">
          <button
            type="button"
            onClick={loadData}
            className="vadsSecondaryBtn"
            title="Ma’lumotlarni yangilash"
          >
            <span>🔄</span>
            <span>Yangilash</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAd(null);
              setIsModalOpen(true);
            }}
            className="vadsPrimaryBtn"
          >
            <span>＋</span>
            <span>Yangi video reklama</span>
          </button>
        </div>
      </div>

      {/* 2. Compact KPI Cards (2x2 on mobile, 4 in row on desktop) */}
      <div className="vadsMetricGrid">
        {/* KPI 1: Active Ads */}
        <div className="vadsMetricCard">
          <div className="vadsMetricIcon" style={{ color: "#b6536b" }}>
            🎬
          </div>
          <div className="vadsMetricContent">
            <span className="vadsMetricLabel">Faol reklamalar</span>
            <span className="vadsMetricValue">{stats.active_ads}</span>
            <span className="vadsMetricSub">{stats.total_ads} tadan faol</span>
          </div>
        </div>

        {/* KPI 2: Impressions */}
        <div className="vadsMetricCard">
          <div className="vadsMetricIcon" style={{ color: "#0284c7" }}>
            👁️
          </div>
          <div className="vadsMetricContent">
            <span className="vadsMetricLabel">Ko‘rishlar</span>
            <span className="vadsMetricValue" style={{ color: "#0284c7" }}>
              {stats.total_impressions.toLocaleString()}
            </span>
            <span className="vadsMetricSub">≥1.5s ko‘rilganlar</span>
          </div>
        </div>

        {/* KPI 3: Clicks */}
        <div className="vadsMetricCard">
          <div className="vadsMetricIcon" style={{ color: "#d97706" }}>
            👆
          </div>
          <div className="vadsMetricContent">
            <span className="vadsMetricLabel">CTA bosishlar</span>
            <span className="vadsMetricValue" style={{ color: "#d97706" }}>
              {stats.total_clicks.toLocaleString()}
            </span>
            <span className="vadsMetricSub">Havolaga o‘tishlar</span>
          </div>
        </div>

        {/* KPI 4: CTR */}
        <div className="vadsMetricCard">
          <div className="vadsMetricIcon" style={{ color: "#059669" }}>
            📈
          </div>
          <div className="vadsMetricContent">
            <span className="vadsMetricLabel">CTR konversiya</span>
            <span className="vadsMetricValue" style={{ color: "#059669" }}>
              {stats.overall_ctr}%
            </span>
            <span className="vadsMetricSub">Bosish / Ko‘rish</span>
          </div>
        </div>
      </div>

      {/* 3. Secondary Visual Analytics (Collapsible) */}
      <div className="vadsAnalyticsPanel">
        <div
          className="vadsAnalyticsHead"
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          <div className="vadsAnalyticsHeadTitle">
            <span>📊</span>
            <h3>Analitika va Samaradorlik</h3>
          </div>
          <button
            type="button"
            className="vadsAnalyticsToggleBtn"
            onClick={(e) => {
              e.stopPropagation();
              setShowAnalytics(!showAnalytics);
            }}
          >
            {showAnalytics ? "Yopish ▲" : "Ko‘rsatish ▼"}
          </button>
        </div>

        {showAnalytics && (
          <div className="vadsAnalyticsBody">
            {ads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)", fontSize: "12px" }}>
                Hozircha analitika uchun yetarli ma’lumot yo‘q
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>
                  Reklamalar bo‘yicha ko‘rishlar va bosishlar solishtirmasi
                </div>
                {ads.slice(0, 5).map((ad) => {
                  const impressions = ad.stats?.impressions || 0;
                  const clicks = ad.stats?.clicks || 0;
                  const ctr = ad.stats?.ctr ?? calculateCtr(clicks, impressions);
                  const barWidth = Math.max(8, Math.round((impressions / maxImpressions) * 100));

                  return (
                    <div key={ad.id} className="vadsBarItem">
                      <div className="vadsBarHead">
                        <b>{ad.title}</b>
                        <span>
                          {impressions} ko‘rish · <b>{clicks} bosish</b> · <b style={{ color: "#059669" }}>{ctr}% CTR</b>
                        </span>
                      </div>
                      <div className="vadsBarTrack">
                        <div className="vadsBarFill" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Toolbar: Search, Sorting, and Filters */}
      <div className="vadsToolbar">
        <div className="vadsToolbarTop">
          <div className="vadsSearchBox">
            <span>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Reklama nomi, tavsifi yoki URL bo‘yicha qidirish..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ border: 0, background: "transparent", color: "#8d7d84", cursor: "pointer", fontSize: "12px" }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="vadsToolbarActions">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="vadsSortSelect"
              aria-label="Saralash"
            >
              <option value="newest">Yangi qo‘shilganlar</option>
              <option value="priority_desc">Ustuvorlik bo‘yicha</option>
              <option value="ctr_desc">Eng yuqori CTR</option>
              <option value="impressions_desc">Eng ko‘p ko‘rilgan</option>
              <option value="clicks_desc">Eng ko‘p bosilgan</option>
            </select>

            <div className="vadsViewSwitch">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`vadsViewBtn ${viewMode === "grid" ? "active" : ""}`}
              >
                Kartalar
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`vadsViewBtn ${viewMode === "table" ? "active" : ""}`}
              >
                Jadval
              </button>
            </div>
          </div>
        </div>

        <div className="vadsFilterRow">
          <div className="vadsChipGroup">
            <span className="vadsChipLabel">Joylashuv:</span>
            {[
              { id: "all", label: "Barchasi" },
              { id: "home", label: "Bosh sahifa" },
              { id: "product_feed", label: "In-feed" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterPlacement(p.id)}
                className={`vadsChip ${filterPlacement === p.id ? "active" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="vadsChipGroup">
            <span className="vadsChipLabel">Holat:</span>
            {[
              { id: "all", label: "Barchasi" },
              { id: "active", label: "Faol" },
              { id: "inactive", label: "Faol emas" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFilterStatus(s.id as any)}
                className={`vadsChip ${filterStatus === s.id ? "active" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Ads List (Grid or Table) */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
          <p style={{ margin: 0, fontSize: "13px" }}>Video reklamalar yuklanmoqda...</p>
        </div>
      ) : filteredAds.length === 0 ? (
        <div style={{ textAlign: "center", padding: "44px 16px", background: "#ffffff", borderRadius: "18px", border: "1px dashed var(--line)" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📹</div>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "var(--ink)" }}>Reklamalar topilmadi</h3>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "12px" }}>
            Qidiruv so‘rovingiz yoki filtrlarga mos keluvchi video reklama mavjud emas.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterPlacement("all");
              setFilterStatus("all");
            }}
            className="vadsSecondaryBtn"
            style={{ marginRight: "8px" }}
          >
            Filtrlarni tozalash
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAd(null);
              setIsModalOpen(true);
            }}
            className="vadsPrimaryBtn"
          >
            + Yangi reklama qo‘shish
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="vadsCardsGrid">
          {filteredAds.map((ad) => {
            const impressions = ad.stats?.impressions || 0;
            const clicks = ad.stats?.clicks || 0;
            const ctr = ad.stats?.ctr ?? calculateCtr(clicks, impressions);

            return (
              <div key={ad.id} className="vadsCardItem">
                {/* Media Preview Box */}
                <div className="vadsCardMedia">
                  {ad.poster_url ? (
                    <img src={ad.poster_url} alt={ad.title} />
                  ) : ad.video_url ? (
                    <video src={ad.video_url} muted playsInline />
                  ) : (
                    <div style={{ color: "#a68f98", fontSize: "12px" }}>Video mavjud emas</div>
                  )}

                  <div className="vadsCardBadges">
                    <span className="vadsBadgeChip placement">
                      {ad.placement === "home" ? "Bosh sahifa" : ad.placement === "product_feed" ? "In-feed" : "Barchasi"}
                    </span>
                    <span className="vadsBadgeChip">
                      {ad.platform === "telegram" ? "Telegram" : ad.platform === "web" ? "Veb" : "Barcha"}
                    </span>
                  </div>

                  <span className={`vadsStatusBadge ${ad.is_active ? "active" : "inactive"}`}>
                    {ad.is_active ? "Faol" : "Faol emas"}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSimulatingAd(ad)}
                    className="vadsSimPlayOverlayBtn"
                    title="Simulyatorda ko‘rish"
                  >
                    ▶
                  </button>
                </div>

                {/* Card Body */}
                <div className="vadsCardBody">
                  <div>
                    <h3 className="vadsCardTitle">{ad.title}</h3>
                    {ad.description ? (
                      <p className="vadsCardDesc">{ad.description}</p>
                    ) : (
                      <div style={{ height: "16px" }} />
                    )}

                    {/* Compact Metrics Row */}
                    <div className="vadsMiniStatsRow">
                      <div className="vadsMiniStatItem">
                        <small>Ko‘rish</small>
                        <b>{impressions}</b>
                      </div>
                      <div className="vadsMiniStatItem">
                        <small>Bosish</small>
                        <b>{clicks}</b>
                      </div>
                      <div className="vadsMiniStatItem">
                        <small>CTR</small>
                        <b className="ctr">{ctr}%</b>
                      </div>
                    </div>

                    {/* Secondary Meta */}
                    <div className="vadsCardMetaList">
                      <div className="vadsCardMetaItem">
                        <span>CTA tugma:</span>
                        <b>“{ad.cta_text || "Batafsil"}”</b>
                      </div>
                      <div className="vadsCardMetaItem">
                        <span>Ustuvorlik:</span>
                        <b>P-{ad.priority || 10}</b>
                      </div>
                      {ad.destination_url && (
                        <div className="vadsCardMetaItem">
                          <span>Manzil:</span>
                          <b
                            onClick={() => handleCopyLink(ad.destination_url)}
                            style={{ cursor: "pointer", color: "var(--rose)" }}
                            title="Nusxalash"
                          >
                            {ad.destination_url} 📋
                          </b>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="vadsCardFooter">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(ad)}
                      className={`vadsSwitchBtn ${ad.is_active ? "active" : "inactive"}`}
                    >
                      {ad.is_active ? "To‘xtatish" : "Faollashtirish"}
                    </button>

                    <div className="vadsCardBtnGroup">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(ad)}
                        className="vadsIconActionBtn"
                        title="Nusxa olish"
                      >
                        📑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAd(ad);
                          setIsModalOpen(true);
                        }}
                        className="vadsIconActionBtn"
                        title="Tahrirlash"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAd(ad)}
                        className="vadsIconActionBtn danger"
                        title="O‘chirish"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="vadsTableWrap">
          <table className="vadsTable">
            <thead>
              <tr>
                <th>Video</th>
                <th>Nomi & CTA</th>
                <th>Joylashuv</th>
                <th>Platforma</th>
                <th>Ko‘rish</th>
                <th>Bosish</th>
                <th>CTR</th>
                <th>Holat</th>
                <th style={{ textAlign: "right" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filteredAds.map((ad) => {
                const impressions = ad.stats?.impressions || 0;
                const clicks = ad.stats?.clicks || 0;
                const ctr = ad.stats?.ctr ?? calculateCtr(clicks, impressions);

                return (
                  <tr key={ad.id}>
                    <td style={{ width: "70px" }}>
                      <div
                        onClick={() => setSimulatingAd(ad)}
                        style={{
                          width: "56px",
                          height: "36px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#20171d",
                          position: "relative",
                          cursor: "pointer",
                          border: "1px solid var(--line)",
                        }}
                      >
                        {ad.poster_url ? (
                          <img src={ad.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <video src={ad.video_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                        )}
                        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "11px", color: "#fff", background: "rgba(0,0,0,0.3)" }}>
                          ▶
                        </span>
                      </div>
                    </td>
                    <td>
                      <b style={{ display: "block", color: "var(--ink)", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ad.title}
                      </b>
                      <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                        CTA: “{ad.cta_text || "Batafsil"}”
                      </small>
                    </td>
                    <td>
                      <span style={{ fontSize: "11.5px", fontWeight: 600 }}>
                        {ad.placement === "home" ? "Bosh sahifa" : ad.placement === "product_feed" ? "In-feed" : "Barchasi"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {ad.platform === "telegram" ? "Telegram" : ad.platform === "web" ? "Veb" : "Hammasi"}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#0284c7" }}>
                      {impressions}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#d97706" }}>
                      {clicks}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "#059669" }}>
                      {ctr}%
                    </td>
                    <td>
                      <span className={`vadsStatusBadge ${ad.is_active ? "active" : "inactive"}`} style={{ position: "static" }}>
                        {ad.is_active ? "Faol" : "Faol emas"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(ad)}
                          className="vadsIconActionBtn"
                          title={ad.is_active ? "To‘xtatish" : "Faollashtirish"}
                        >
                          {ad.is_active ? "⏸️" : "▶️"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAd(ad);
                            setIsModalOpen(true);
                          }}
                          className="vadsIconActionBtn"
                          title="Tahrirlash"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(ad)}
                          className="vadsIconActionBtn"
                          title="Nusxa"
                        >
                          📑
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAd(ad)}
                          className="vadsIconActionBtn danger"
                          title="O‘chirish"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Live Simulator Modal */}
      {simulatingAd && (
        <div className="vadsModalOverlay" onClick={() => setSimulatingAd(null)}>
          <div
            className="vadsModalCard"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vadsModalHead">
              <div>
                <h2>Reklama Simulyatori</h2>
                <small style={{ color: "var(--muted)" }}>{simulatingAd.title}</small>
              </div>
              <button
                type="button"
                onClick={() => setSimulatingAd(null)}
                className="vadsModalCloseBtn"
              >
                ✕
              </button>
            </div>

            <div className="vadsModalBody" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* Platform Switcher */}
              <div className="vadsViewSwitch" style={{ marginBottom: "14px" }}>
                <button
                  type="button"
                  onClick={() => setSimulatorPlatform("telegram")}
                  className={`vadsViewBtn ${simulatorPlatform === "telegram" ? "active" : ""}`}
                >
                  Telegram Mini App
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPlatform("web")}
                  className={`vadsViewBtn ${simulatorPlatform === "web" ? "active" : ""}`}
                >
                  Veb-brauzer
                </button>
              </div>

              {/* Phone Mockup Frame */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  borderRadius: "24px",
                  background: "#181116",
                  border: "5px solid #2d1f28",
                  padding: "10px",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
                  color: "#ffffff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a68f98", marginBottom: "8px", padding: "0 4px" }}>
                  <span>9:41</span>
                  <span>{simulatorPlatform === "telegram" ? "Telegram Bot" : "gulii.uz"}</span>
                  <span>🔋 100%</span>
                </div>

                <div
                  style={{
                    position: "relative",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "#000",
                    aspectRatio: "16 / 10",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  {simulatingAd.video_url ? (
                    <video
                      src={simulatingAd.video_url}
                      poster={simulatingAd.poster_url || undefined}
                      muted={simulatorMuted}
                      autoPlay
                      loop
                      playsInline
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <img
                      src={simulatingAd.poster_url || ""}
                      alt=""
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}

                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.2) 60%, transparent)", pointerEvents: "none" }} />

                  <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px", zIndex: 2 }}>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.65)", color: "#fbcfe8", border: "1px solid rgba(244,114,182,0.3)" }}>
                      REKLAMA
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSimulatorMuted(!simulatorMuted)}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      zIndex: 2,
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.2)",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {simulatorMuted ? "🔇" : "🔊"}
                  </button>

                  <div style={{ position: "relative", zIndex: 2, padding: "10px" }}>
                    <h4 style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 750, color: "#ffffff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                      {simulatingAd.title}
                    </h4>
                    {simulatingAd.description && (
                      <p style={{ margin: "0 0 6px", fontSize: "10px", color: "#e2d9dc", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                        {simulatingAd.description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => notify(`CTA bosildi: ${simulatingAd.destination_url || "/"}`)}
                      className="vadsPrimaryBtn"
                      style={{ width: "100%", padding: "7px 10px", fontSize: "11px", minHeight: "34px", borderRadius: "10px" }}
                    >
                      {simulatingAd.cta_text || "Batafsil"} →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="vadsModalFoot">
              <button
                type="button"
                onClick={() => setSimulatingAd(null)}
                className="vadsSecondaryBtn"
                style={{ width: "100%" }}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {deletingAd && (
        <div className="vadsModalOverlay" onClick={() => setDeletingAd(null)}>
          <div
            className="vadsModalCard"
            style={{ maxWidth: "380px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vadsModalHead">
              <h2 style={{ color: "#dc2626" }}>Reklamani o‘chirish</h2>
              <button
                type="button"
                onClick={() => setDeletingAd(null)}
                className="vadsModalCloseBtn"
              >
                ✕
              </button>
            </div>
            <div className="vadsModalBody">
              <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5, margin: "0 0 8px" }}>
                Haqiqatan ham <b>“{deletingAd.title}”</b> video reklamasini o‘chirmoqchimisiz?
              </p>
              <small style={{ color: "var(--muted)", display: "block" }}>
                Ushbu amalni ortga qaytarib bo‘lmaydi va to‘plangan barcha statistika ham tozalanadi.
              </small>
            </div>
            <div className="vadsModalFoot">
              <button
                type="button"
                onClick={() => setDeletingAd(null)}
                disabled={deleting}
                className="vadsSecondaryBtn"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: "12px",
                  padding: "9px 15px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: "42px",
                }}
              >
                {deleting ? "O‘chirilmoqda..." : "Ha, o‘chirilsin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Create / Edit Studio Modal */}
      <VideoAdModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAd(null);
        }}
        onSaved={loadData}
        editingAd={editingAd}
        notify={notify}
      />
    </div>
  );
};
