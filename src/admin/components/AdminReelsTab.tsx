import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ReelItem, ReelStatus } from "../../types/reels";
import { loadReelsFromStorage, saveReelsToStorage, INITIAL_DEMO_REELS } from "../../data/demoReels";
import { DEFAULT_PRODUCTS } from "../../utils/defaultProducts";
import {
  isInstagramUrl,
  extractInstagramShortcode,
  fetchInstagramReelData,
} from "../../utils/instagramFetcher";

interface AdminReelsTabProps {
  notify: (msg: string) => void;
}

export const AdminReelsTab: React.FC<AdminReelsTabProps> = ({ notify }) => {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingReel, setEditingReel] = useState<ReelItem | null>(null);
  const [previewReel, setPreviewReel] = useState<ReelItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ReelItem | null>(null);
  const [isSavingReel, setIsSavingReel] = useState(false);

  // Instagram Auto Fetch State
  const [isAutoFetchingInsta, setIsAutoFetchingInsta] = useState(false);
  const [instaFetchStatus, setInstaFetchStatus] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    caption: "",
    videoUrl: "",
    posterUrl: "",
    musicTitle: "",
    productId: "",
    status: "active" as ReelStatus,
    displayLikesCount: "100",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load from local storage
  const loadData = () => {
    const data = loadReelsFromStorage();
    setReels(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preset sample videos for convenient 1-click testing
  const sampleVideoPresets = [
    { label: "1-namuna: Fashion Runway", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    { label: "2-namuna: Elegant Silk", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4" },
    { label: "3-namuna: Romantic Mood", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4" },
  ];

  // Preset sample covers
  const sampleCoverPresets = [
    { label: "Baxmal to‘plam", url: "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=900&q=80" },
    { label: "Ipak pijama", url: "https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?auto=format&fit=crop&w=900&q=80" },
    { label: "Nafis bodi", url: "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=900&q=80" },
  ];

  // Filtered reels list
  const filteredReels = useMemo(() => {
    return reels.filter((item) => {
      const matchSearch =
        item.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.productName && item.productName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [reels, searchQuery, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = reels.length;
    const active = reels.filter((r) => r.status === "active").length;
    const drafts = reels.filter((r) => r.status === "draft").length;
    const totalViews = reels.reduce((acc, r) => acc + (r.viewsCount || 0), 0);
    const totalLikes = reels.reduce((acc, r) => acc + (r.likesCount || 0), 0);
    return { total, active, drafts, totalViews, totalLikes };
  }, [reels]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingReel(null);
    setFormData({
      caption: "",
      videoUrl: "",
      posterUrl: "",
      musicTitle: "",
      productId: "",
      status: "active",
      displayLikesCount: "100",
    });
    setFormErrors({});
    setVideoFileName("");
    setInstaFetchStatus(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (reel: ReelItem) => {
    setEditingReel(reel);
    setFormData({
      caption: reel.caption,
      videoUrl: reel.videoUrl,
      posterUrl: reel.posterUrl,
      musicTitle: reel.musicTitle || "Guli Market — Original Audio",
      productId: reel.productId ? String(reel.productId) : "",
      status: reel.status,
      displayLikesCount: String(reel.displayLikesCount ?? 100),
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Toggle Status
  const handleToggleStatus = (reel: ReelItem) => {
    const nextStatus: ReelStatus = reel.status === "active" ? "inactive" : "active";
    const updated = reels.map((r) => (r.id === reel.id ? { ...r, status: nextStatus } : r));
    saveReelsToStorage(updated);
    setReels(updated);
    notify(nextStatus === "active" ? `✓ “${reel.caption.slice(0, 25)}...” faollashtirildi` : `“${reel.caption.slice(0, 25)}...” faol emas qilindi`);
  };

  // Video & Cover File Upload state
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoFileName, setVideoFileName] = useState("");
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  // Get all inventory products combining localStorage "guli_products" and DEFAULT_PRODUCTS
  const inventoryProducts = useMemo(() => {
    let localProds: any[] = [];
    try {
      const raw = localStorage.getItem("guli_products");
      if (raw) localProds = JSON.parse(raw);
    } catch {}

    const map = new Map<string | number, any>();

    DEFAULT_PRODUCTS.forEach((p) => {
      map.set(String(p.id), {
        id: p.id,
        product_code: p.product_code || `GL-${p.id}`,
        name: p.name,
        price: p.price,
        stock: p.stock ?? 10,
        image: p.image,
      });
    });

    if (Array.isArray(localProds)) {
      localProds.forEach((p) => {
        if (p.id) {
          map.set(String(p.id), {
            id: p.id,
            product_code: p.product_code || `GL-${p.id}`,
            name: p.name,
            price: p.price,
            stock: p.stock ?? 10,
            image: p.image,
          });
        }
      });
    }

    return Array.from(map.values());
  }, []);

  // Handle Video File Upload from device
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      notify("⚠️ Video hajmi 100MB dan oshmasligi kerak");
      return;
    }

    setIsVideoUploading(true);
    setVideoFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormData((prev) => ({ ...prev, videoUrl: result }));
        notify(`✓ "${file.name}" video fayli muvaffaqiyatli yuklandi`);
      }
      setIsVideoUploading(false);
    };
    reader.onerror = () => {
      notify("❌ Videoni o‘qishda xatolik yuz berdi");
      setIsVideoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle Cover / Poster Image File Upload from device
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCoverUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormData((prev) => ({ ...prev, posterUrl: result }));
        notify(`✓ "${file.name}" muqova rasmi yuklandi`);
      }
      setIsCoverUploading(false);
    };
    reader.onerror = () => {
      notify("❌ Rasmni o‘qishda xatolik yuz berdi");
      setIsCoverUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Auto-fetch video, poster, and caption from Instagram link
  const handleInstagramAutoFetch = useCallback(
    async (targetUrl?: string) => {
      const urlToFetch = targetUrl || formData.videoUrl;
      if (!isInstagramUrl(urlToFetch)) return;

      setIsAutoFetchingInsta(true);
      setInstaFetchStatus("Instagram post va video ma’lumotlari olinmoqda...");

      try {
        const data = await fetchInstagramReelData(urlToFetch);
        if (data) {
          setFormData((prev) => ({
            ...prev,
            videoUrl: data.videoUrl,
            posterUrl: data.posterUrl,
            caption: prev.caption.trim() ? prev.caption : data.caption,
          }));
          setInstaFetchStatus(`✓ Instagram Reels embed uchun tayyor (Kod: ${data.shortcode}). Saqlang va Instagram player orqali ko‘ring.`);
          notify("✓ Instagram havolasi va muqova tayyor. Video Instagram player orqali ko‘rsatiladi.");
        } else {
          setInstaFetchStatus("⚠️ Instagram manzilidan ma’lumot olinmadi");
        }
      } catch (err) {
        console.error("Instagram auto fetch error:", err);
        setInstaFetchStatus("❌ Instagram ma’lumotlarini olishda xatolik yuz berdi");
      } finally {
        setIsAutoFetchingInsta(false);
      }
    },
    [formData.videoUrl, notify]
  );

  // Save Reel (Create or Edit)
  const handleSaveReel = (e: React.FormEvent) => {
    e.preventDefault();

    if (isVideoUploading || isCoverUploading) {
      notify("Avval media fayli yuklanishi tugashini kuting.");
      return;
    }

    const errors: Record<string, string> = {};
    if (!formData.caption.trim()) errors.caption = "Tavsif yoki caption kiritish shart";
    if (!formData.videoUrl.trim()) errors.videoUrl = "Video URL manzili yoki fayli kiritilishi shart";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const selectedProduct = inventoryProducts.find((p) => String(p.id) === String(formData.productId));

    setIsSavingReel(true);
    try {
      if (editingReel) {
        // Edit existing
        const updated = reels.map((r) => {
          if (r.id === editingReel.id) {
            return {
              ...r,
              caption: formData.caption.trim(),
              videoUrl: formData.videoUrl.trim(),
              posterUrl: formData.posterUrl.trim(),
              musicTitle: formData.musicTitle.trim() || "Guli Market — Original Audio",
              displayLikesCount: Math.max(100, Math.min(5000, Number(formData.displayLikesCount) || 100)),
              productId: selectedProduct ? selectedProduct.id : undefined,
              productName: selectedProduct ? selectedProduct.name : undefined,
              productPrice: selectedProduct ? selectedProduct.price : undefined,
              productImage: selectedProduct ? selectedProduct.image : undefined,
              status: formData.status,
            };
          }
          return r;
        });

        saveReelsToStorage(updated);
        setReels(updated);
        notify("✓ Reels muvaffaqiyatli yangilandi");
      } else {
        // Create new
        const newReel: ReelItem = {
          id: `reel-${Date.now()}`,
          caption: formData.caption.trim(),
          videoUrl: formData.videoUrl.trim(),
          posterUrl: formData.posterUrl.trim(),
          musicTitle: formData.musicTitle.trim() || "Guli Market — Original Audio",
          displayLikesCount: Math.max(100, Math.min(5000, Number(formData.displayLikesCount) || 100)),
          author: {
            name: "Guli Market Official",
            username: "gulii.uz",
            avatar: "/guli-logo.png",
            verified: true,
          },
          productId: selectedProduct ? selectedProduct.id : undefined,
          productName: selectedProduct ? selectedProduct.name : undefined,
          productPrice: selectedProduct ? selectedProduct.price : undefined,
          productImage: selectedProduct ? selectedProduct.image : undefined,
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          viewsCount: 1,
          isLiked: false,
          status: formData.status,
          createdAt: new Date().toISOString(),
          comments: [],
        };

        const updated = [newReel, ...reels];
        saveReelsToStorage(updated);
        setReels(updated);
        notify("✓ Yangi Reels qo‘shildi");
      }

      setIsFormModalOpen(false);
    } finally {
      setIsSavingReel(false);
    }
  };

  // Delete Reel
  const handleDeleteConfirm = () => {
    if (!deleteCandidate) return;
    const updated = reels.filter((r) => r.id !== deleteCandidate.id);
    saveReelsToStorage(updated);
    setReels(updated);
    notify("✓ Reels o‘chirildi");
    setDeleteCandidate(null);
  };

  // Reset to initial demo data
  const handleResetDemoData = () => {
    saveReelsToStorage(INITIAL_DEMO_REELS);
    setReels(INITIAL_DEMO_REELS);
    notify("✓ Boshlang‘ich demo Reels ma’lumotlari tiklandi");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #fff7f9 0%, #fff0f3 100%)",
          border: "1px solid #f6dbe2",
          borderRadius: "18px",
          padding: "20px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#2b2024" }}>
              🎬 Reels boshqaruvi
            </h2>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#b6536b",
                background: "#fde8ee",
                padding: "2px 8px",
                borderRadius: "999px",
                border: "1px solid #f8ccd7",
              }}
            >
              Frontend Prototip
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#6e5d64" }}>
            Instagram Reels formatidagi vertikal videolarni boshqarish, tahrirlash va preview qilish.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleResetDemoData}
            style={{
              padding: "10px 16px",
              background: "#ffffff",
              color: "#6e5d64",
              border: "1px solid #ebd4db",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔄 Demo ma’lumotlarni tiklash
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              padding: "10px 18px",
              background: "linear-gradient(135deg, #b6536b 0%, #9f1239 100%)",
              color: "#ffffff",
              border: 0,
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(182, 83, 107, 0.35)",
            }}
          >
            + Yangi Reels qo‘shish
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #f0dfe3" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#806f75", textTransform: "uppercase" }}>Jami Reels</span>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#2b2024", marginTop: "4px" }}>{stats.total}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #f0dfe3" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Faol Reels</span>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#16a34a", marginTop: "4px" }}>{stats.active}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #f0dfe3" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ca8a04", textTransform: "uppercase" }}>Qoralamalar</span>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#ca8a04", marginTop: "4px" }}>{stats.drafts}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #f0dfe3" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Jami ko‘rishlar</span>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#2563eb", marginTop: "4px" }}>{stats.totalViews.toLocaleString("uz-UZ")}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #f0dfe3" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase" }}>Haqiqiy like</span>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#e11d48", marginTop: "4px" }}>{stats.totalLikes.toLocaleString("uz-UZ")}</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        style={{
          background: "#ffffff",
          padding: "16px 20px",
          borderRadius: "16px",
          border: "1px solid #f0dfe3",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Reels tavsifi yoki mahsulot bo‘yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #ebd4db",
              background: "#fdf5f7",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #ebd4db",
              background: "#fdf5f7",
              fontSize: "13px",
              fontWeight: 600,
              outline: "none",
            }}
          >
            <option value="all">Barcha holatlar</option>
            <option value="active">🟢 Faol</option>
            <option value="draft">🟡 Qoralama</option>
            <option value="inactive">⚪ Faol emas</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadData}
          style={{
            padding: "10px 14px",
            background: "#f6eaed",
            border: "1px solid #ebd4db",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#6e5d64",
            cursor: "pointer",
          }}
        >
          🔄 Yangilash
        </button>
      </div>

      {/* Reels List Table / Cards */}
      {filteredReels.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            padding: "48px 20px",
            borderRadius: "16px",
            border: "1px solid #f0dfe3",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>🎬</div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#2b2024" }}>
            Reels topilmadi
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#806f75" }}>
            Qidiruv mezonlariga mos Reels mavjud emas yoki hali rolik yuklanmagan.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              padding: "10px 18px",
              background: "#b6536b",
              color: "#ffffff",
              border: 0,
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Yangi Reels yaratish
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #f0dfe3",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#fdf5f7", borderBottom: "1px solid #ebd4db", color: "#6e5d64", fontWeight: 700 }}>
                  <th style={{ padding: "14px 16px" }}>Rolik & Poster</th>
                  <th style={{ padding: "14px 16px" }}>Tavsif (Caption)</th>
                  <th style={{ padding: "14px 16px" }}>Bog‘langan Mahsulot</th>
                  <th style={{ padding: "14px 16px" }}>Holat</th>
                  <th style={{ padding: "14px 16px" }}>Statistika</th>
                  <th style={{ padding: "14px 16px" }}>Sana</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredReels.map((reel) => {
                  const isFaol = reel.status === "active";
                  const isDraft = reel.status === "draft";

                  return (
                    <tr
                      key={reel.id}
                      style={{
                        borderBottom: "1px solid #f6eaed",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Media Thumb */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div
                          style={{
                            position: "relative",
                            width: "56px",
                            height: "76px",
                            borderRadius: "10px",
                            overflow: "hidden",
                            background: "#000",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          }}
                        >
                          <img
                            src={reel.posterUrl}
                            alt="Cover"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=200&q=80";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewReel(reel)}
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(0,0,0,0.35)",
                              border: 0,
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "18px",
                              cursor: "pointer",
                            }}
                            title="Preview qilish"
                          >
                            ▶
                          </button>
                        </div>
                      </td>

                      {/* Caption */}
                      <td style={{ padding: "14px 16px", maxWidth: "260px" }}>
                        <div style={{ fontWeight: 700, color: "#2b2024", marginBottom: "3px" }}>
                          @{reel.author.username}
                        </div>
                        <div
                          style={{
                            color: "#55434a",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {reel.caption}
                        </div>
                        {reel.musicTitle && (
                          <div style={{ fontSize: "11px", color: "#9b7d86", marginTop: "4px" }}>
                            🎵 {reel.musicTitle}
                          </div>
                        )}
                      </td>

                      {/* Product */}
                      <td style={{ padding: "14px 16px" }}>
                        {reel.productName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {reel.productImage && (
                              <img
                                src={reel.productImage}
                                alt="Prod"
                                style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover" }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: "#2b2024" }}>{reel.productName}</div>
                              {reel.productPrice && (
                                <div style={{ fontSize: "11px", color: "#b6536b", fontWeight: 700 }}>
                                  {reel.productPrice.toLocaleString("uz-UZ")} so‘m
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#9b7d86" }}>Bog‘lanmagan</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 800,
                            background: isFaol ? "#ecfdf5" : isDraft ? "#fefce8" : "#f3f4f6",
                            color: isFaol ? "#15803d" : isDraft ? "#a16207" : "#4b5563",
                            border: `1px solid ${isFaol ? "#bbf7d0" : isDraft ? "#fef08a" : "#e5e7eb"}`,
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: isFaol ? "#22c55e" : isDraft ? "#eab308" : "#9ca3af",
                            }}
                          />
                          {isFaol ? "Faol" : isDraft ? "Qoralama" : "Faol emas"}
                        </span>
                      </td>

                      {/* Stats */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "12px", color: "#6e5d64", fontSize: "12px" }}>
                          <span title="Ko‘rishlar soni">👁️ {(reel.viewsCount || 0).toLocaleString("uz-UZ")}</span>
                          <span title="Haqiqiy foydalanuvchi like’lari">❤️ {reel.likesCount} (haqiqiy)</span>
                          <small style={{ marginLeft: "6px", color: "#9f1239" }}>(demo: {reel.displayLikesCount || 0})</small>
                          <span title="Izohlar soni">💬 {reel.comments.length || reel.commentsCount}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: "14px 16px", color: "#806f75", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {new Date(reel.createdAt).toLocaleDateString("uz-UZ")}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => setPreviewReel(reel)}
                            style={{
                              padding: "6px 10px",
                              background: "#f6eaed",
                              border: 0,
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#6e5d64",
                              cursor: "pointer",
                            }}
                            title="Mobil preview"
                          >
                            👁️ Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(reel)}
                            style={{
                              padding: "6px 10px",
                              background: isFaol ? "#fff1f2" : "#ecfdf5",
                              border: 0,
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: isFaol ? "#e11d48" : "#16a34a",
                              cursor: "pointer",
                            }}
                            title={isFaol ? "O‘chirish" : "Faollashtirish"}
                          >
                            {isFaol ? "To‘xtatish" : "Yoqish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(reel)}
                            style={{
                              padding: "6px 10px",
                              background: "#f6eaed",
                              border: 0,
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#6e5d64",
                              cursor: "pointer",
                            }}
                            title="Tahrirlash"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(reel)}
                            style={{
                              padding: "6px 10px",
                              background: "#fef2f2",
                              border: 0,
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
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
        </div>
      )}

      {/* CREATE / EDIT REEL MODAL */}
      {isFormModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 12, 16, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsFormModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#2b2024" }}>
                {editingReel ? "✏️ Reelsni tahrirlash" : "🎬 Yangi Reels qo‘shish"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                style={{
                  background: "#f6eaed",
                  border: 0,
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#6e5d64",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReel} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Caption */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  Tavsif (Caption) *
                </label>
                <textarea
                  rows={3}
                  placeholder="Reels matni, xeshteglar va mahsulot afzalliklari..."
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: formErrors.caption ? "1px solid #ef4444" : "1px solid #ebd4db",
                    background: "#fdf5f7",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {formErrors.caption && (
                  <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "3px", display: "block" }}>
                    {formErrors.caption}
                  </span>
                )}
              </div>

              {/* Video Upload & URL */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  🎬 Video: qurilmadan yuklash YOKI URL *
                </label>

                {/* Direct File Upload Dropzone / Button */}
                <div style={{ background: "#fdf5f7", border: "2px dashed #ebd4db", borderRadius: "12px", padding: "12px 16px", textAlign: "center", marginBottom: "10px" }}>
                  <label style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#b6536b" }}>
                      📁 Qurilmadan video faylini yuklash
                    </span>
                    <span style={{ fontSize: "11px", color: "#806f75" }}>
                      MP4 / WebM / MOV formatdagi videolarni tanlang
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                  {isVideoUploading && (
                    <div style={{ fontSize: "12px", color: "#b6536b", marginTop: "6px", fontWeight: 700 }}>
                      ⏳ Video yuklanmoqda...
                    </div>
                  )}
                  {videoFileName && !isVideoUploading && (
                    <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "6px", fontWeight: 700 }}>
                      ✓ Fayl: {videoFileName}
                    </div>
                  )}
                </div>

                <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#806f75" }}>
                  Video faylini yuklasangiz, URL kiritish shart emas. URL orqali qo‘shsangiz, fayl yuklash shart emas. Kamida bittasini tanlang.
                </p>

                {/* URL Input */}
                <input
                  type="text"
                  placeholder="Ixtiyoriy: video fayl yuklamasangiz URL kiriting"
                  value={formData.videoUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, videoUrl: val }));
                    // Keep the exact URL entered by the administrator. Instagram import is manual only.
                    setInstaFetchStatus(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: isInstagramUrl(formData.videoUrl)
                      ? "2px solid #e1306c"
                      : formErrors.videoUrl
                      ? "1px solid #ef4444"
                      : "1px solid #ebd4db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                {/* Instagram Auto-Fetch Card / Trigger */}
                {isInstagramUrl(formData.videoUrl) && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                      border: "1px solid #f472b6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>📸</span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#9d174d" }}>
                          Instagram Reels havolasi aniqlandi
                        </div>
                        <div style={{ fontSize: "11px", color: "#be185d" }}>
                          {instaFetchStatus || `Kod: ${extractInstagramShortcode(formData.videoUrl)}`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAutoFetchingInsta}
                      onClick={() => handleInstagramAutoFetch()}
                      style={{
                        padding: "6px 14px",
                        background: "linear-gradient(135deg, #e1306c 0%, #c13584 100%)",
                        color: "#ffffff",
                        border: 0,
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: isAutoFetchingInsta ? "wait" : "pointer",
                        boxShadow: "0 2px 8px rgba(225, 48, 108, 0.3)",
                      }}
                    >
                      {isAutoFetchingInsta ? "⏳ Yuklanmoqda..." : "⚡ Qayta yuklash"}
                    </button>
                  </div>
                )}

                {/* Live Video Preview Box */}
                {formData.videoUrl && (
                  <div style={{ marginTop: "10px", borderRadius: "12px", overflow: "hidden", border: "1px solid #ebd4db", background: "#000", height: "220px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    {isInstagramUrl(formData.videoUrl) ? (
                      <iframe
                        key={formData.videoUrl}
                        src={"https://www.instagram.com/reel/" + extractInstagramShortcode(formData.videoUrl) + "/embed/"}
                        title="Instagram Reels ko‘rish"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ width: "100%", height: "100%", border: 0, background: "#000" }}
                      />
                    ) : (
                      <video
                        key={formData.videoUrl}
                        src={formData.videoUrl}
                        controls
                        muted
                        onError={() => notify("⚠️ Video ochilmadi. URL manzilini tekshiring yoki faylni qayta yuklang.")}
                        style={{ maxHeight: "220px", width: "100%", objectFit: "contain" }}
                      />
                    )}
                  </div>
                )}

                {/* Presets */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#806f75" }}>Namuna videolar:</span>
                  {sampleVideoPresets.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setFormData({ ...formData, videoUrl: preset.url })}
                      style={{
                        background: "#fff",
                        border: "1px solid #ebd4db",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        color: "#b6536b",
                        fontWeight: 600,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Poster / Cover Upload & URL */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  🖼️ Cover / Muqova rasmi — ixtiyoriy
                </label>

                <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#806f75" }}>
                  Xohlasangiz rasm yuklang yoki URL kiriting. Ikkalasini ham bo‘sh qoldirsangiz bo‘ladi — video o‘zi saqlanadi.
                </p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <label style={{ flex: 1, cursor: "pointer", padding: "8px 12px", background: "#fdf5f7", border: "1px dashed #ebd4db", borderRadius: "10px", fontSize: "12px", fontWeight: 700, color: "#b6536b", textAlign: "center" }}>
                    📷 Muqova rasmini yuklash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                  {isCoverUploading && <span style={{ fontSize: "11px", color: "#b6536b" }}>⏳ Yuklanmoqda...</span>}
                </div>

                <input
                  type="text"
                  placeholder="Ixtiyoriy: rasm URL manzili yoki qurilmadan yuklang"
                  value={formData.posterUrl}
                  onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: formErrors.posterUrl ? "1px solid #ef4444" : "1px solid #ebd4db",
                    background: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                {/* Cover Image Thumbnail Preview */}
                {formData.posterUrl && (
                  <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={formData.posterUrl}
                      alt="Muqova"
                      style={{ width: "48px", height: "64px", borderRadius: "8px", objectFit: "cover", border: "1px solid #ebd4db" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>✓ Muqova rasmi tanlandi</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#806f75" }}>Namuna muqovalar:</span>
                  {sampleCoverPresets.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setFormData({ ...formData, posterUrl: preset.url })}
                      style={{
                        background: "#fff",
                        border: "1px solid #ebd4db",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        color: "#b6536b",
                        fontWeight: 600,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Inventory Product & Status (Two columns) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                    🛍️ Omborimdagi mahsulotga bog‘lash
                  </label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid #ebd4db",
                      background: "#fdf5f7",
                      fontSize: "13px",
                      fontWeight: 600,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- (Bog‘lanmagan) --</option>
                    {inventoryProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.product_code || `GL-${p.id}`}] {p.name} — {p.price.toLocaleString("uz-UZ")} so‘m
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                    Holat (Status)
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ReelStatus })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid #ebd4db",
                      background: "#fdf5f7",
                      fontSize: "13px",
                      fontWeight: 700,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="active">🟢 Faol (Darhol ko‘rsatish)</option>
                    <option value="draft">🟡 Qoralama (Draft)</option>
                    <option value="inactive">⚪ Faol emas (Yashirish)</option>
                  </select>
                </div>
              </div>

              {/* Selected Product Preview Card */}
              {formData.productId && (
                (() => {
                  const p = inventoryProducts.find((item) => String(item.id) === String(formData.productId));
                  if (!p) return null;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#fdf2f4", border: "1px solid #f7d2db", borderRadius: "12px" }}>
                      <img
                        src={p.image}
                        alt={p.name}
                        style={{ width: "42px", height: "42px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#2b2024", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#b6536b", fontWeight: 800 }}>
                          {p.price.toLocaleString("uz-UZ")} so‘m • Kod: {p.product_code || `GL-${p.id}`}
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", background: "#16a34a", color: "#fff", padding: "3px 8px", borderRadius: "999px", fontWeight: 700 }}>
                        Bog‘landi ✓
                      </span>
                    </div>
                  );
                })()
              )}

              {/* Music Title */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  Musiqa / Audio nomi
                </label>
                <input
                  type="text"
                  placeholder="Guli Market — Original Audio"
                  value={formData.musicTitle}
                  onChange={(e) => setFormData({ ...formData, musicTitle: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #ebd4db",
                    background: "#fdf5f7",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Clearly labeled demo popularity count, separate from real user likes */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  ❤️ Namoyish like ko‘rsatkichi (demo)
                </label>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={1}
                  value={formData.displayLikesCount}
                  onChange={(e) => setFormData({ ...formData, displayLikesCount: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #ebd4db", background: "#fdf5f7", fontSize: "13px", boxSizing: "border-box" }}
                />
                <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#806f75" }}>
                  100–5000 oralig‘ida. Bu haqiqiy foydalanuvchi like’lari emas; Reels oynasida namoyish ko‘rsatkichi sifatida belgilanadi.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    background: "#f6eaed",
                    border: 0,
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#6e5d64",
                    cursor: "pointer",
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSavingReel || isVideoUploading || isCoverUploading}
                  style={{
                    padding: "10px 22px",
                    background: "linear-gradient(135deg, #b6536b 0%, #9f1239 100%)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(182, 83, 107, 0.35)",
                  }}
                >
                  {isSavingReel ? "Saqlanmoqda..." : isVideoUploading || isCoverUploading ? "Fayl yuklanmoqda..." : editingReel ? "O‘zgarishlarni saqlash" : "Reelsni saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE PREVIEW MODAL (Instagram Reels Frame) */}
      {previewReel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 6, 8, 0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setPreviewReel(null)}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "380px",
              height: "680px",
              borderRadius: "32px",
              overflow: "hidden",
              boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
              background: "#000",
              border: "4px solid rgba(255, 255, 255, 0.2)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Preview */}
            <button
              type="button"
              onClick={() => setPreviewReel(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: "16px",
                zIndex: 30,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>

            {/* Video or Poster */}
            <div style={{ position: "absolute", inset: 0, background: "#000" }}>
              {previewReel.videoUrl ? (
                isInstagramUrl(previewReel.videoUrl) ? (
                  <iframe
                    src={"https://www.instagram.com/reel/" + extractInstagramShortcode(previewReel.videoUrl) + "/embed/"}
                    title="Instagram Reels ko‘rish"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{ width: "100%", height: "100%", border: 0 }}
                  />
                ) : (
                  <video
                    src={previewReel.videoUrl}
                    poster={previewReel.posterUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )
              ) : (
                <img
                  src={previewReel.posterUrl}
                  alt="Poster"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>

            {/* Right mock actions */}
            <div
              style={{
                position: "absolute",
                right: "12px",
                bottom: "90px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                zIndex: 20,
              }}
            >
              <div style={{ textAlign: "center", color: "#fff" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  ❤️
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700 }}>{previewReel.likesCount}</span>
              </div>
              <div style={{ textAlign: "center", color: "#fff" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  💬
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700 }}>{previewReel.comments.length || previewReel.commentsCount}</span>
              </div>
              <div style={{ textAlign: "center", color: "#fff" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  ↗️
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700 }}>{previewReel.sharesCount}</span>
              </div>
            </div>

            {/* Bottom info */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: "70px",
                padding: "16px 14px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                zIndex: 20,
                color: "#fff",
              }}
            >
              {previewReel.productName && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(255,255,255,0.95)",
                    padding: "4px 10px",
                    borderRadius: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e1b4b" }}>
                    🛍️ {previewReel.productName}
                  </span>
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: "13px", marginBottom: "4px" }}>
                @{previewReel.author.username}
              </div>
              <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.4, opacity: 0.95 }}>
                {previewReel.caption}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 12, 16, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setDeleteCandidate(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "420px",
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "40px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 800, color: "#2b2024" }}>
              Reelsni o‘chirishni tasdiqlaysizmi?
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6e5d64", lineHeight: 1.5 }}>
              “{deleteCandidate.caption.slice(0, 40)}...” roligi o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                style={{
                  padding: "10px 18px",
                  background: "#f6eaed",
                  border: 0,
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#6e5d64",
                  cursor: "pointer",
                }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                style={{
                  padding: "10px 20px",
                  background: "#dc2626",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Ha, o‘chirilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
