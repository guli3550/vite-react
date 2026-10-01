import React, { useEffect, useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting, SocialPromosApiResponse } from "../../types/socialPromo";
import { SocialPromoMarqueeRow } from "./SocialPromoMarqueeRow";
import { buildApiUrl } from "../../lib/apiOrigin";
import type { Language } from "../../utils/translations";

interface SocialPromoSectionProps {
  language?: Language;
  isDark?: boolean;
}

const FALLBACK_SETTINGS: SocialPromoRowSetting[] = [
  { row_number: 1, is_enabled: true, direction: "left", duration_seconds: 34 },
  { row_number: 2, is_enabled: true, direction: "right", duration_seconds: 42 },
  { row_number: 3, is_enabled: true, direction: "left", duration_seconds: 36 },
];

export const SocialPromoSection: React.FC<SocialPromoSectionProps> = ({
  language = "uz",
  isDark = false,
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  const [items, setItems] = useState<SocialPromoItem[]>([]);
  const [settings, setSettings] = useState<SocialPromoRowSetting[]>(FALLBACK_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchSocialPromos() {
      try {
        const url = buildApiUrl("/api/social-promos");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network response was not ok");
        const json: SocialPromosApiResponse = await res.json();
        if (isMounted && json?.success && json?.data) {
          if (Array.isArray(json.data.items)) setItems(json.data.items);
          if (Array.isArray(json.data.settings) && json.data.settings.length > 0) setSettings(json.data.settings);
        }
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSocialPromos();

    // Listen for custom event from admin panel to refresh immediately
    const handleRefresh = () => fetchSocialPromos();
    window.addEventListener("guli_refresh_social_promos", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("guli_refresh_social_promos", handleRefresh);
    };
  }, []);

  if (!isLoading && items.length === 0) return null;

  const row1Items = items.filter((it) => it.row_number === 1);
  const row2Items = items.filter((it) => it.row_number === 2);
  const row3Items = items.filter((it) => it.row_number === 3);

  const row1Setting = settings.find((s) => s.row_number === 1);
  const row2Setting = settings.find((s) => s.row_number === 2);
  const row3Setting = settings.find((s) => s.row_number === 3);

  return (
    <section
      className="guli-social-promo-section"
      aria-label="Social media links marquee"
      style={{
        width: "100%",
        marginTop: "24px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          marginBottom: "4px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: isDark ? "rgba(225, 29, 72, 0.9)" : "#be185d",
            }}
          >
            {isRu
              ? "ОФИЦИАЛЬНЫЕ СООБЩЕСТВА"
              : isEn
              ? "OFFICIAL COMMUNITIES"
              : "RASMIY HAMJAMIYAT"}
          </span>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 800,
              margin: "2px 0 0",
              color: isDark ? "#ffffff" : "#1f191b",
              letterSpacing: "-0.01em",
            }}
          >
            {isRu
              ? "Мы в социальных сетях"
              : isEn
              ? "Follow us on Social Media"
              : "Biz ijtimoiy tarmoqlarda"}
          </h3>
        </div>

        <span
          style={{
            fontSize: "11px",
            color: isDark ? "#c4a3ad" : "#64748b",
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
            padding: "4px 8px",
            borderRadius: "10px",
            fontWeight: 650,
          }}
        >
          {isRu ? "3 канала" : isEn ? "3 channels" : "3 ta tarmoq"}
        </span>
      </div>

      {/* 3-Row Animated Marquee Tracks */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
          opacity: isLoading && items.length === 0 ? 0.6 : 1,
          transition: "opacity 0.25s ease",
        }}
      >
        {/* ROW 1: Right-to-Left (left) */}
        <SocialPromoMarqueeRow
          rowNumber={1}
          items={row1Items}
          setting={row1Setting}
          isDark={isDark}
        />

        {/* ROW 2: Left-to-Right (right) */}
        <SocialPromoMarqueeRow
          rowNumber={2}
          items={row2Items}
          setting={row2Setting}
          isDark={isDark}
        />

        {/* ROW 3: Right-to-Left (left) */}
        <SocialPromoMarqueeRow
          rowNumber={3}
          items={row3Items}
          setting={row3Setting}
          isDark={isDark}
        />
      </div>
    </section>
  );
};
