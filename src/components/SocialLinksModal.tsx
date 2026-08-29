import React, { useState, useEffect } from "react";
import { getSocialLinks, SocialLinks } from "../utils/socialLinks";

interface SocialLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SocialLinksModal: React.FC<SocialLinksModalProps> = ({ isOpen, onClose }) => {
  const [links, setLinks] = useState<SocialLinks>(getSocialLinks());

  useEffect(() => {
    const handleUpdate = () => {
      setLinks(getSocialLinks());
    };
    window.addEventListener("guli_social_links_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("guli_social_links_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const handleOpenLink = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="modalBackdrop modalBackdropCenter" onMouseDown={onClose}>
      <div
        className="cardPaymentModal3D profileExtraModal"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "24px 20px",
          background: "var(--bg-card, #ffffff)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modalHeader" style={{ marginBottom: "12px", paddingBottom: "12px" }}>
          <div className="modalTitleWrap">
            <span className="modalEyebrow">RASMIY SAHIFALARIMIZ</span>
            <h2 style={{ fontSize: "20px", fontWeight: "800", marginTop: "2px" }}>
              Ijtimoiy tarmoqlar
            </h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label="Yopish"
          >
            ×
          </button>
        </div>

        <p className="modalIntroText" style={{ fontSize: "12.5px", marginBottom: "18px" }}>
          GULI Premium do‘konining rasmiy ijtimoiy tarmoqlariga a’zo bo‘ling va eng so‘nggi to‘plamlar hamda chegirmalardan xabardor bo‘ling:
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          {/* Instagram */}
          <button
            type="button"
            onClick={() => handleOpenLink(links.instagram)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              width: "100%",
              padding: "14px 16px",
              borderRadius: "18px",
              border: "1px solid var(--border-color, #f0e2e5)",
              background: "linear-gradient(135deg, rgba(253, 242, 244, 0.6) 0%, rgba(255, 255, 255, 1) 100%)",
              boxShadow: "0 4px 14px rgba(220, 39, 67, 0.06)",
              cursor: "pointer",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(220, 39, 67, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(220, 39, 67, 0.06)";
            }}
          >
            <div style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-modal-grad)" />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7ZM9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12Z"
                  fill="white"
                />
                <circle cx="17.2" cy="6.8" r="1.3" fill="white" />
                <defs>
                  <linearGradient id="ig-modal-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f09433" />
                    <stop offset="0.25" stopColor="#e6683c" />
                    <stop offset="0.5" stopColor="#dc2743" />
                    <stop offset="0.75" stopColor="#cc2366" />
                    <stop offset="1" stopColor="#bc1888" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <b style={{ fontSize: "15px", color: "var(--text-main, #1f191b)", fontWeight: 700 }}>
                  Instagram
                </b>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#dc2743",
                    background: "rgba(220, 39, 67, 0.08)",
                    padding: "3px 8px",
                    borderRadius: "999px",
                  }}
                >
                  @guli_3550_ ↗
                </span>
              </div>
              <small style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted, #786b70)", marginTop: "2px" }}>
                Foto va video to‘plamlar, story'lar
              </small>
            </div>
          </button>

          {/* Telegram */}
          <button
            type="button"
            onClick={() => handleOpenLink(links.telegram)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              width: "100%",
              padding: "14px 16px",
              borderRadius: "18px",
              border: "1px solid var(--border-color, #e1eef7)",
              background: "linear-gradient(135deg, rgba(238, 247, 253, 0.6) 0%, rgba(255, 255, 255, 1) 100%)",
              boxShadow: "0 4px 14px rgba(42, 171, 238, 0.06)",
              cursor: "pointer",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(42, 171, 238, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(42, 171, 238, 0.06)";
            }}
          >
            <div style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#2AABEE" />
                <path
                  d="M5.5 11.8L16.8 7.2C17.3 7 17.8 7.3 17.6 7.9L15.7 16.8C15.6 17.3 15.1 17.5 14.6 17.2L11.5 14.9L10 16.3C9.8 16.5 9.6 16.6 9.4 16.6L9.6 13.8L14.7 9.2C14.9 9 14.6 8.8 14.4 8.9L8.1 12.9L5.4 12C4.9 11.9 4.9 11.3 5.5 11.8Z"
                  fill="white"
                />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <b style={{ fontSize: "15px", color: "var(--text-main, #1f191b)", fontWeight: 700 }}>
                  Telegram
                </b>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0088cc",
                    background: "rgba(42, 171, 238, 0.1)",
                    padding: "3px 8px",
                    borderRadius: "999px",
                  }}
                >
                  @pijama3550 ↗
                </span>
              </div>
              <small style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted, #786b70)", marginTop: "2px" }}>
                Rasmiy kanal va yangi assortimentlar
              </small>
            </div>
          </button>

          {/* TikTok */}
          <button
            type="button"
            onClick={() => handleOpenLink(links.tiktok)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              width: "100%",
              padding: "14px 16px",
              borderRadius: "18px",
              border: "1px solid var(--border-color, #e8e8e8)",
              background: "linear-gradient(135deg, rgba(245, 245, 247, 0.7) 0%, rgba(255, 255, 255, 1) 100%)",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
              cursor: "pointer",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.05)";
            }}
          >
            <div style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="7" fill="#111111" />
                <path
                  d="M16.6 8.2C15.5 8.2 14.5 7.7 13.8 6.9V14.1C13.8 16.8 11.6 19 8.9 19C6.2 19 4 16.8 4 14.1C4 11.4 6.2 9.2 8.9 9.2C9.2 9.2 9.6 9.2 9.9 9.3V11.5C9.6 11.4 9.2 11.4 8.9 11.4C7.4 11.4 6.2 12.6 6.2 14.1C6.2 15.6 7.4 16.8 8.9 16.8C10.4 16.8 11.6 15.6 11.6 14.1V4H13.8C13.8 5.4 14.9 6.5 16.3 6.6V8.2H16.6Z"
                  fill="#25F4EE"
                />
                <path
                  d="M16.3 7.8C15.3 7.8 14.3 7.3 13.6 6.5V13.7C13.6 16.4 11.4 18.6 8.7 18.6C6 18.6 3.8 16.4 3.8 13.7C3.8 11 6 8.8 8.7 8.8C9 8.8 9.4 8.8 9.7 8.9V11.1C9.4 11 9 11 8.7 11C7.2 11 6 12.2 6 13.7C6 15.2 7.2 16.4 8.7 16.4C10.2 16.4 11.4 15.2 11.4 13.7V3.6H13.6C13.6 5 14.7 6.1 16.1 6.2V7.8H16.3Z"
                  fill="#FE2C55"
                />
                <path
                  d="M16.5 8C15.4 8 14.4 7.5 13.7 6.7V13.9C13.7 16.6 11.5 18.8 8.8 18.8C6.1 18.8 3.9 16.6 3.9 13.9C3.9 11.2 6.1 9 8.8 9C9.1 9 9.5 9 9.8 9.1V11.3C9.5 11.2 9.1 11.2 8.8 11.2C7.3 11.2 6.1 12.4 6.1 13.9C6.1 15.4 7.3 16.6 8.8 16.6C10.3 16.6 11.5 15.4 11.5 13.9V3.8H13.7C13.7 5.2 14.8 6.3 16.2 6.4V8H16.5Z"
                  fill="white"
                />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <b style={{ fontSize: "15px", color: "var(--text-main, #1f191b)", fontWeight: 700 }}>
                  TikTok
                </b>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#111111",
                    background: "rgba(0, 0, 0, 0.08)",
                    padding: "3px 8px",
                    borderRadius: "999px",
                  }}
                >
                  @guli_3550 ↗
                </span>
              </div>
              <small style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted, #786b70)", marginTop: "2px" }}>
                Qisqa va qiziqarli video sharhlar
              </small>
            </div>
          </button>
        </div>

        <div className="modalFooterSingle" style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            type="button"
            className="btnPrimaryFull"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              background: "var(--primary, #b95a70)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
