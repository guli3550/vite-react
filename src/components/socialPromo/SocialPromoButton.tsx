import React from "react";
import type { SocialPromoItem } from "../../types/socialPromo";
import { PlatformLogoRenderer } from "./SocialPlatformLogos";

interface SocialPromoButtonProps {
  item: SocialPromoItem;
  className?: string;
  isDark?: boolean;
}

export const SocialPromoButton: React.FC<SocialPromoButtonProps> = ({
  item,
  className = "",
  isDark = false,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const url = item.target_url;
    if (!url) return;

    // Telegram Mini App native link opening support
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      if (url.startsWith("https://t.me/") || url.startsWith("tg://")) {
        try {
          if (typeof tg.openTelegramLink === "function") {
            e.preventDefault();
            tg.openTelegramLink(url);
            return;
          }
        } catch {}
      } else {
        try {
          if (typeof tg.openLink === "function") {
            e.preventDefault();
            tg.openLink(url);
            return;
          }
        } catch {}
      }
    }
  };

  return (
    <a
      href={item.target_url}
      target={item.open_in_new_tab ? "_blank" : "_self"}
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`guli-social-promo-pill ${className}`}
      title={item.title || item.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "9px",
        padding: "8px 16px 8px 10px",
        borderRadius: "9999px",
        backgroundColor: isDark ? "rgba(35, 23, 29, 0.94)" : "rgba(255, 255, 255, 0.96)",
        border: isDark
          ? "1px solid rgba(225, 29, 72, 0.28)"
          : "1px solid rgba(225, 29, 72, 0.16)",
        boxShadow: isDark
          ? "0 4px 14px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(225, 29, 72, 0.15)"
          : "0 4px 14px rgba(190, 24, 93, 0.08), 0 1px 2px rgba(0, 0, 0, 0.03)",
        color: isDark ? "#fbeff2" : "#1f191b",
        textDecoration: "none",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease, border-color 0.18s ease",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#fdf2f4",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
          flexShrink: 0,
        }}
      >
        <PlatformLogoRenderer platform={item.platform} logoUrl={item.logo_url} size={20} />
      </div>

      <span
        style={{
          fontSize: "12.5px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        {item.label}
      </span>

      <span
        style={{
          fontSize: "13px",
          opacity: 0.45,
          fontWeight: 800,
          marginLeft: "2px",
          transition: "transform 0.18s ease, opacity 0.18s ease",
        }}
      >
        ↗
      </span>
    </a>
  );
};
