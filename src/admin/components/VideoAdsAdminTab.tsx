import React, { useState, useEffect, useCallback } from "react";
import type { VideoAd, VideoAdStatsSummary } from "../../types/videoAd";
import { calculateCtr } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { VideoAdModal } from "./VideoAdModal";

interface VideoAdsAdminTabProps {
  notify: (msg: string) => void;
}

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
  const [filterPlacement, setFilterPlacement] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<VideoAd | null>(null);
  const [deletingAd, setDeletingAd] = useState<VideoAd | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      notify(nextStatus ? "Reklama faollashtirildi ✓" : "Reklama to‘xtatildi");
      loadData();
    } catch (err: any) {
      notify(err.message || "Xatolik yuz berdi");
      loadData();
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

  const filteredAds = ads.filter((ad) => {
    if (filterStatus === "active" && !ad.is_active) return false;
    if (filterStatus === "inactive" && ad.is_active) return false;
    if (filterPlacement !== "all" && ad.placement !== "all" && ad.placement !== filterPlacement) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-950 text-slate-100 rounded-2xl min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Marketing → Video reklamalar
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Bosh sahifa va mahsulotlar oqimida ko‘rsatiluvchi video reklamalarni boshqarish va analitikasi
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingAd(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-pink-600/20 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <span>＋</span>
          <span>Yangi video reklama</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Jami faol reklamalar</span>
          <span className="text-2xl font-bold text-pink-400">{stats.active_ads}</span>
          <span className="text-xs text-slate-500 block mt-1">Jami {stats.total_ads} tadan</span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Ko‘rishlar soni (Impressions)</span>
          <span className="text-2xl font-bold text-cyan-400 tabular-nums">{stats.total_impressions}</span>
          <span className="text-xs text-slate-500 block mt-1">≥1.5s ko‘rilganlar</span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 block mb-1">“Batafsil” bosilishlari</span>
          <span className="text-2xl font-bold text-amber-400 tabular-nums">{stats.total_clicks}</span>
          <span className="text-xs text-slate-500 block mt-1">Havolaga o‘tishlar</span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-400 block mb-1">O‘rtacha CTR konversiyasi</span>
          <span className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.overall_ctr}%</span>
          <span className="text-xs text-slate-500 block mt-1">Bosishlar / Ko‘rishlar</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Joylashuv:</span>
          {["all", "home", "product_feed"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilterPlacement(p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                filterPlacement === p
                  ? "bg-pink-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p === "all" ? "Barchasi" : p === "home" ? "Bosh sahifa" : "Mahsulotlar oqimi"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Holat:</span>
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === s
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {s === "all" ? "Barchasi" : s === "active" ? "Faol" : "Nofaol"}
            </button>
          ))}
        </div>
      </div>

      {/* Advertisements List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mb-3" />
          <p className="text-sm">Video reklamalar yuklanmoqda...</p>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800">
          <span className="text-4xl block mb-2">📹</span>
          <h3 className="text-base font-semibold text-slate-300">Reklamalar topilmadi</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Hozircha hech qanday video reklama yaratilmagan yoki filtrlarga mos kelmaydi.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingAd(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold rounded-lg transition"
          >
            + Birinchi video reklamani yaratish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAds.map((ad) => {
            const impressions = ad.stats?.impressions || 0;
            const clicks = ad.stats?.clicks || 0;
            const ctr = ad.stats?.ctr ?? calculateCtr(clicks, impressions);

            return (
              <div
                key={ad.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-md transition"
              >
                {/* Media Preview Box */}
                <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                  {ad.poster_url ? (
                    <img
                      src={ad.poster_url}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                    />
                  ) : ad.video_url ? (
                    <video
                      src={ad.video_url}
                      className="w-full h-full object-cover opacity-80"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="text-xs text-slate-500">Video mavjud emas</div>
                  )}

                  {/* Badges on preview */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/75 text-pink-300 backdrop-blur-sm border border-white/10">
                      {ad.placement === "home"
                        ? "Bosh sahifa"
                        : ad.placement === "product_feed"
                        ? "In-Feed"
                        : "Barchasi"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/60 text-slate-300 backdrop-blur-sm">
                      {ad.platform === "telegram"
                        ? "Telegram"
                        : ad.platform === "web"
                        ? "Veb"
                        : "Barcha platformalar"}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        ad.is_active
                          ? "bg-emerald-500/90 text-white"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {ad.is_active ? "FAOL" : "NOFAOL"}
                    </span>
                  </div>
                </div>

                {/* Content info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">
                      {ad.title}
                    </h3>
                    {ad.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {ad.description}
                      </p>
                    )}

                    {/* Stats metrics row */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-center mb-3">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase">Ko‘rish</span>
                        <span className="text-xs font-bold text-cyan-400 tabular-nums">{impressions}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase">Bosish</span>
                        <span className="text-xs font-bold text-amber-400 tabular-nums">{clicks}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase">CTR</span>
                        <span className="text-xs font-bold text-emerald-400 tabular-nums">{ctr}%</span>
                      </div>
                    </div>

                    {/* Destination details */}
                    <div className="text-[11px] text-slate-400 space-y-0.5 mb-2">
                      <div className="truncate">
                        <span className="text-slate-500">CTA:</span> “{ad.cta_text || "Batafsil"}”
                      </div>
                      {ad.destination_url && (
                        <div className="truncate">
                          <span className="text-slate-500">Havola:</span> {ad.destination_url}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(ad)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                        ad.is_active
                          ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          : "bg-emerald-600/80 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {ad.is_active ? "To‘xtatish" : "Yoqish"}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAd(ad);
                          setIsModalOpen(true);
                        }}
                        className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAd(ad)}
                        className="text-xs px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/40 rounded transition"
                      >
                        O‘chirish
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full text-white shadow-2xl">
            <h3 className="text-base font-bold text-red-400 mb-2">
              Reklamani o‘chirishni tasdiqlaysizmi?
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              “{deletingAd.title}” video reklamasi va unga tegishli barcha ko‘rishlar statistikasi o‘chiriladi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAd(null)}
                disabled={deleting}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold shadow"
              >
                {deleting ? "O‘chirilmoqda..." : "Ha, o‘chirilsin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
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
