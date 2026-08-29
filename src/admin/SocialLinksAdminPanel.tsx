import React, { useState, useEffect } from "react";
import { getSocialLinks, saveSocialLinks, SocialLinks } from "../utils/socialLinks";

export function SocialLinksAdminPanel({ notify }: { notify: (msg: string) => void }) {
  const [links, setLinks] = useState<SocialLinks>(getSocialLinks());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLinks(getSocialLinks());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      saveSocialLinks(links);
      notify("Ijtimoiy tarmoqlar havolalari muvaffaqiyatli saqlandi ✓");
    } catch {
      notify("Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="proPanel panel" style={{ padding: "24px", maxWidth: "800px", margin: "0 auto 24px auto" }}>
      <div className="panelHead" style={{ marginBottom: "20px" }}>
        <div>
          <span className="proEyebrow eyebrow">IJTIMOIY TARMOQLAR BOSHQARUVI</span>
          <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "4px 0" }}>
            Ijtimoiy tarmoqlar havolalarini tahrirlash
          </h2>
          <p style={{ fontSize: "13px", color: "#786b70", marginTop: "4px" }}>
            Foydalanuvchilar profildagi "💬 Xizmat va Bog‘lanish" bo‘limidagi "Ijtimoiy tarmoqlar" tugmasini bosganda ochiladigan URL manzillarini ushbu shaklda yangilashingiz mumkin.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "18px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <b style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#dc2743" }}>📸</span> Instagram URL
          </b>
          <input
            type="url"
            value={links.instagram}
            onChange={(e) => setLinks({ ...links, instagram: e.target.value })}
            placeholder="https://www.instagram.com/..."
            required
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border-color, #f0dfe3)",
              background: "var(--bg-card, #ffffff)",
              color: "var(--text-main, #1f191b)",
              fontSize: "13.5px",
              width: "100%",
            }}
          />
          <small style={{ color: "#786b70", fontSize: "11.5px" }}>
            Instagram rasmiy sahifasi URL manzili
          </small>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <b style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#2AABEE" }}>✈️</span> Telegram URL
          </b>
          <input
            type="url"
            value={links.telegram}
            onChange={(e) => setLinks({ ...links, telegram: e.target.value })}
            placeholder="https://t.me/..."
            required
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border-color, #f0dfe3)",
              background: "var(--bg-card, #ffffff)",
              color: "var(--text-main, #1f191b)",
              fontSize: "13.5px",
              width: "100%",
            }}
          />
          <small style={{ color: "#786b70", fontSize: "11.5px" }}>
            Telegram rasmiy kanali yoki profili URL manzili
          </small>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <b style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🎵</span> TikTok URL
          </b>
          <input
            type="url"
            value={links.tiktok}
            onChange={(e) => setLinks({ ...links, tiktok: e.target.value })}
            placeholder="https://www.tiktok.com/@..."
            required
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border-color, #f0dfe3)",
              background: "var(--bg-card, #ffffff)",
              color: "var(--text-main, #1f191b)",
              fontSize: "13.5px",
              width: "100%",
            }}
          />
          <small style={{ color: "#786b70", fontSize: "11.5px" }}>
            TikTok profili URL manzili
          </small>
        </label>

        <div style={{ marginTop: "8px", display: "flex", gap: "12px" }}>
          <button
            type="submit"
            className="proPrimary adminPrimary"
            disabled={saving}
            style={{
              padding: "12px 28px",
              borderRadius: "14px",
              background: "#b95a70",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {saving ? "Saqlanmoqda…" : "Havolalarni saqlash ✓"}
          </button>
        </div>
      </form>
    </section>
  );
}
