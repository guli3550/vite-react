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
  isDark = false,
}) => {
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
          if (Array.isArray(json.data.settings)) setSettings(json.data.settings);
        }
      } catch {
        // Do not show hard-coded destinations if the API is unavailable.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSocialPromos();
    const handleRefresh = () => fetchSocialPromos();
    window.addEventListener("guli_refresh_social_promos", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("guli_refresh_social_promos", handleRefresh);
    };
  }, []);

  const row1Items = items.filter((it) => it.row_number === 1);
  const row2Items = items.filter((it) => it.row_number === 2);
  const row3Items = items.filter((it) => it.row_number === 3);
  const row1Setting = settings.find((s) => s.row_number === 1);
  const row2Setting = settings.find((s) => s.row_number === 2);
  const row3Setting = settings.find((s) => s.row_number === 3);

  if (!items.length || ![row1Items, row2Items, row3Items].some((row) => row.length)) return null;

  return (
    <section
      className="guli-social-promo-section"
      aria-label="Social media links marquee"
      style={{
        width: "100%",
        marginTop: "6px",
        marginBottom: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
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
        <SocialPromoMarqueeRow rowNumber={1} items={row1Items} setting={row1Setting} isDark={isDark} />
        <SocialPromoMarqueeRow rowNumber={2} items={row2Items} setting={row2Setting} isDark={isDark} />
        <SocialPromoMarqueeRow rowNumber={3} items={row3Items} setting={row3Setting} isDark={isDark} />
      </div>
    </section>
  );
};
