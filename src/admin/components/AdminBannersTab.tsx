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
    title: "Yangi Bahor Kolleksiyasi 🌸",
    subtitle: "Nafis ipak va to'rli premium xaddan tashqari qulay komplektlar",
    imageUrl: "https://images.unsplash.com/photo-1596489379650-7fbe8b556f8f?w=800&auto=format&fit=crop&q=80",
    badgeText: "YANGILIK",
    ctaText: "Kolleksiyani ko'rish",
    active: true,
  },
  {
    id: 2,
    title: "Eksklyuziv Pijamalar Sets ✨",
    subtitle: "Uydagi har bir lahjangizni go'zallashtiring",
    imageUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80",
    badgeText: "TOP SOTILGAN",
    ctaText: "Xarid qilish",
    active: true,
  },
];

export function AdminBannersTab({ notify }: { notify: (m: string) => void }) {
  const [banners, setBanners] = useState<Banner[]>(() => {
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
    try {
      localStorage.setItem("guli_admin_banners", JSON.stringify(list));
    } catch {}
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80");
    setBadgeText("CHEGIRMA");
    setCtaText("Sotib olish");
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
      const updated = banners.map((b) =>
        b.id === editingBanner.id
          ? { ...b, title: title.trim(), subtitle: subtitle.trim(), imageUrl, badgeText, ctaText }
          : b
      );
      saveToStorage(updated);
      notify("Banner yangilandi ✓");
    } else {
      const newB: Banner = {
        id: Date.now(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl,
        badgeText,
        ctaText,
        active: true,
      };
      saveToStorage([...banners, newB]);
      notify("Yangi banner qo‘shildi ✓");
    }
    setModalOpen(false);
  };

  const toggleActive = (id: number) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b));
    saveToStorage(updated);
    notify("Banner holati o‘zgardi ✓");
  };

  return (
    <section className="proPanel tablePanel">
      <div className="panelHead">
        <div>
          <span className="proEyebrow">MARKETING BANNERS</span>
          <h2>Reklama Bannerlari ({banners.length})</h2>
        </div>
        <button type="button" className="proPrimary" onClick={handleOpenAdd}>
          + Banner qo‘shish
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
                    {b.active ? "Faol" : "Yashirin"}
                  </span>
                  <div className="actions">
                    <button type="button" onClick={() => handleOpenEdit(b)}>
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      className="dangerBtn"
                      onClick={() => toggleActive(b.id)}
                    >
                      {b.active ? "O‘chirish" : "Yoqish"}
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
                    placeholder="Masalan: Bahoriy aksiya"
                    required
                  />
                </label>
                <label>
                  Nishon (Badge Text)
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="Masalan: -20% CHEGIRMA"
                  />
                </label>
                <label className="fullRow">
                  Qisqa tavsif (Subtitle)
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Masalan: Barcha ipak komplektlarga"
                  />
                </label>
                <label className="fullRow">
                  Rasm havolasi (URL)
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Tugma matni (CTA)
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Masalan: Xarid qilish"
                  />
                </label>
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
