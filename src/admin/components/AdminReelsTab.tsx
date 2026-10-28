import React, { useState, useEffect, useMemo } from "react";
import type { ReelItem, ReelStatus } from "../../types/reels";
import { loadReelsFromStorage, saveReelsToStorage, INITIAL_DEMO_REELS } from "../../data/demoReels";
import { DEFAULT_PRODUCTS } from "../../utils/defaultProducts";

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

  // Form inputs
  const [formData, setFormData] = useState({
    caption: "",
    videoUrl: "",
    posterUrl: "",
    musicTitle: "",
    productId: "",
    status: "active" as ReelStatus,
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
      videoUrl: sampleVideoPresets[0].url,
      posterUrl: sampleCoverPresets[0].url,
      musicTitle: "Guli Market — Original Audio",
      productId: "",
      status: "active",
    });
    setFormErrors({});
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
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Toggle Status
  const handleToggleStatus = (reel: ReelItem) => {
    const nextStatus: ReelStatus = reel.status === "active" ? "inactive" : "active";
    const updated = reels.map((r) => {
      if (r.id === reel.id) {
        return { ...r, status: nextStatus };
      }
      return r;
    });

    saveReelsToStorage(updated);
    setReels(updated);
    notify(nextStatus === "active" ? `✓ “${reel.caption.slice(0, 25)}...” faollashtirildi` : `“${reel.caption.slice(0, 25)}...” faol emas qilindi`);
  };

  // Save Reel (Create or Edit)
  const handleSaveReel = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: Record<string, string> = {};
    if (!formData.caption.trim()) {
      errors.caption = "Tavsif yoki caption kiritish shart";
    }
    if (!formData.videoUrl.trim()) {
      errors.videoUrl = "Video URL manzili yoki fayli kiritilishi shart";
    }
    if (!formData.posterUrl.trim()) {
      errors.posterUrl = "Poster / Cover rasmi kiritilishi shart";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const selectedProduct = DEFAULT_PRODUCTS.find(
      (p) => String(p.id) === formData.productId
    );

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
        author: {
          name: "Guli Market Official",
          username: "gulii.uz",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
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
  };

  // Delete Reel
  const handleDeleteConfirm = () => {
    if (!deleteCandidate) return;
    const updated = reels.filter((r) => r.id !== deleteCandidate.id);
    saveReelsToStorage(updated);
    setReels(updated);
    notify(`✓ Reels o‘chirildi`);
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
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase" }}>Jami Like</span>
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
                          <span title="Like soni">❤️ {reel.likesCount}</span>
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

              {/* Video URL */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  Video URL manzili yoki fayli *
                </label>
                <input
                  type="text"
                  placeholder="https://... yoki demo video tanlang"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: formErrors.videoUrl ? "1px solid #ef4444" : "1px solid #ebd4db",
                    background: "#fdf5f7",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
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

              {/* Poster / Cover URL */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                  Cover / Poster rasm URL *
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.posterUrl}
                  onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: formErrors.posterUrl ? "1px solid #ef4444" : "1px solid #ebd4db",
                    background: "#fdf5f7",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
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

              {/* Linked Product & Status (Two columns) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#403238", marginBottom: "6px" }}>
                    Mahsulotga bog‘lash (Ixtiyoriy)
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
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">(Bog‘lanmagan)</option>
                    {DEFAULT_PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price.toLocaleString("uz-UZ")} so‘m)
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
                  {editingReel ? "O‘zgarishlarni saqlash" : "Reelsni saqlash"}
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
                <video
                  src={previewReel.videoUrl}
                  poster={previewReel.posterUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
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
