import { useState } from "react";
import { EmptyState } from "./AdminUIComponents";

export type Banner = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  badgeText: string;
  ctaText: string;
  active: boolean;
};

const DEFAULT_BANNERS: Banner[] = [
  {
    id: 1,
    title: "Eksklyuziv Pijamalar Sets ✨",
    subtitle: "Uydagi har bir lahjangizni go‘zallashtiring",
    imageUrl: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=85",
    badgeText: "TOP SOTILGAN",
    ctaText: "Xarid qilish",
    active: true,
  },
  {
    id: 2,
    title: "Yangi Bahor Kolleksiyasi 🌸",
    subtitle: "Nafis ipak, qulay bichim va zamonaviy uslub",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85",
    badgeText: "YANGILIK ✦",
    ctaText: "Kolleksiyani ko‘rish",
    active: true,
  },
  {
    id: 3,
    title: "Premium Ipak & To‘rli Komplektlar ✨",
    subtitle: "Nafislik, qulaylik va o‘zingizga bo‘lgan ishonch",
    imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85",
    badgeText: "PREMIUM",
    ctaText: "Kashf qilish",
    active: true,
  },
  {
    id: 4,
    title: "Maxsus Chegirmalar — 30% Gacha 🎁",
    subtitle: "Barcha sara to‘plamlar uchun cheklangan taklif",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85",
    badgeText: "AKSIYA 🔥",
    ctaText: "Tanlash",
    active: true,
  },
];

const compressImage = (file: File, maxWidth = 1200, maxHeight = 800, quality = 0.82): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
};

export function AdminBannersTab({ notify }: { notify: (m: string) => void }) {
  const [banners, setBanners] = useState<Banner[]>(() => {
    if ((window as any).__GULI_ADMIN_BANNERS__) {
      return (window as any).__GULI_ADMIN_BANNERS__;
    }
    try {
      const saved = localStorage.getItem("guli_admin_banners");
      return saved ? JSON.parse(saved) : DEFAULT_BANNERS;
    } catch {
      return DEFAULT_BANNERS;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [ctaText, setCtaText] = useState("");

  const saveToStorage = (list: Banner[]) => {
    setBanners(list);
    (window as any).__GULI_ADMIN_BANNERS__ = list;

    try {
      localStorage.setItem("guli_admin_banners", JSON.stringify(list));
    } catch (e) {
      console.warn("LocalStorage error:", e);
    }

    window.dispatchEvent(new Event("guli_banners_updated"));

    const active = list.find((b) => b.active);
    if (active) {
      const apiBase = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
      fetch(`${apiBase}/api/settings/banner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: active.imageUrl }),
      }).catch(() => {});
    }
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1100&q=78");
    setBadgeText("PREMIUM COLLECTION");
    setCtaText("Kolleksiyani ko'rish");
    setModalOpen(true);
  };

  const handleOpenEdit = (b: Banner) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle);
    setImageUrl(b.imageUrl);
    setBadgeText(b.badgeText);
    setCtaText(b.ctaText);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingBanner) {
      const target = { ...editingBanner, title: title.trim(), subtitle: subtitle.trim(), imageUrl, badgeText, ctaText, active: true };
      const otherBanners = banners.filter((b) => b.id !== editingBanner.id);
      saveToStorage([target, ...otherBanners]);
      notify("Banner yangilandi va asosiy ekranga joylandi ✓");
    } else {
      const newB: Banner = {
        id: Date.now(),
        title: title.trim() || "Go‘zallik sizdan boshlanadi.",
        subtitle: subtitle.trim(),
        imageUrl,
        badgeText: badgeText || "PREMIUM COLLECTION",
        ctaText: ctaText || "Kolleksiyani ko'rish",
        active: true,
      };
      saveToStorage([newB, ...banners]);
      notify("Yangi banner qo‘shildi va asosiy ekranga o‘rnatildi ✓");
    }
    setModalOpen(false);
  };

  const toggleActive = (id: number) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b));
    saveToStorage(updated);
    notify("Banner holati o‘zgardi ✓");
  };

  const deleteBanner = (id: number) => {
    if (!window.confirm("Rostdan ham ushbu bannerni o'chirmoqchimisiz?")) return;
    const updated = banners.filter((b) => b.id !== id);
    saveToStorage(updated);
    notify("Banner o‘chirildi ✓");
  };

  return (
    <section className="proPanel tablePanel">
      <div className="panelHead">
        <div>
          <span className="proEyebrow">MARKETING BANNERS</span>
          <h2>Bosh Sahifa Bannerlari ({banners.length})</h2>
        </div>
        <button type="button" className="proPrimary" onClick={handleOpenAdd}>
          + Yangi Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <EmptyState
          icon="🖼"
          title="Bannerlar topilmadi"
          description="Bosh sahifa slayderi uchun banner qo‘shing"
          actionLabel="+ Banner yaratish"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bannerGridList">
          {banners.map((b) => (
            <div key={b.id} className="bannerCardItem">
              <div className="bannerCardImgWrap">
                <img src={b.imageUrl} alt={b.title} />
                <span className="bannerBadgeChip">{b.badgeText}</span>
              </div>
              <div className="bannerCardBody">
                <b>{b.title}</b>
                <p>{b.subtitle}</p>
                <div className="bannerCardFooter">
                  <span className={`pill ${b.active ? "" : "mutedPill"}`}>
                    {b.active ? "Faol (Ekranda)" : "Nofaol (Yashirin)"}
                  </span>
                  <div className="actions" style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => handleOpenEdit(b)}>
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(b.id)}
                      style={{ background: "#f1f5f9", color: "#475569" }}
                    >
                      {b.active ? "Yashirish" : "Yoqish"}
                    </button>
                    <button
                      type="button"
                      className="dangerBtn"
                      onClick={() => deleteBanner(b.id)}
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modalShade" onMouseDown={() => setModalOpen(false)}>
          <div className="proModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <span className="proEyebrow">BANNER</span>
                <h2>{editingBanner ? "Bannerni tahrirlash" : "Yangi banner"}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="formGrid">
                <label>
                  Sarlavha (Title)
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: Go‘zallik sizdan boshlanadi."
                    required
                  />
                </label>
                <label>
                  Nishon (Badge Text)
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="Masalan: PREMIUM COLLECTION"
                  />
                </label>
                <label className="fullRow">
                  Qisqa tavsif (Subtitle)
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Masalan: Eksklyuziv ayollar ichki kiyimlari..."
                  />
                </label>
                <label className="fullRow">
                  Rasm biriktirish (URL yoki Fayl) <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>(Tavsiya etilgan format: 16:10)</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      style={{ flex: 1 }}
                      required
                    />
                    <label className="proSecondary" style={{ cursor: "pointer", padding: "8px 12px", whiteSpace: "nowrap", margin: 0, display: "inline-block" }}>
                      📁 Fayl yuklash
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImage(file, 1280, 800);
                              if (compressed) {
                                setImageUrl(compressed);
                              }
                            } catch {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) {
                                  setImageUrl(evt.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </label>
                {imageUrl && (
                  <div className="fullRow" style={{ marginTop: 4 }}>
                    <div style={{ width: "100%", maxWidth: 360, aspectRatio: "16/10", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                      <img
                        src={imageUrl}
                        alt="Preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modalActions">
                <button type="button" onClick={() => setModalOpen(false)}>
                  Bekor qilish
                </button>
                <button type="submit" className="proPrimary">
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

