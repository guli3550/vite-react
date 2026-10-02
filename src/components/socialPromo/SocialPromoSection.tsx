import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting, SocialPromosApiResponse } from "../../types/socialPromo";
import { SocialPromoMarqueeRow } from "./SocialPromoMarqueeRow";
import { buildApiUrl } from "../../lib/apiOrigin";
import type { Language } from "../../utils/translations";

interface SocialPromoSectionProps {
  language?: Language;
  isDark?: boolean;
}

const ROWS: ReadonlyArray<1 | 2 | 3> = [1, 2, 3];
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
  const [isLoading, setIsLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const response = await fetch(buildApiUrl("/api/social-promos"), { cache: "no-store" });
      if (!response.ok) throw new Error("Social promo request failed");
      const json: SocialPromosApiResponse = await response.json();
      if (currentRequest !== requestId.current || !json?.success || !json.data) return;
      if (Array.isArray(json.data.items)) setItems(json.data.items);
      if (Array.isArray(json.data.settings) && json.data.settings.length > 0) {
        setSettings(json.data.settings);
      }
    } catch {
      // Keep current content on refresh errors; initial empty state stays hidden.
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("guli_refresh_social_promos", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      requestId.current += 1;
      window.removeEventListener("guli_refresh_social_promos", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const visibleRows = ROWS.map((rowNumber) => {
    const setting = settings.find((entry) => entry.row_number === rowNumber);
    return {
      rowNumber,
      items: items.filter((item) => item.row_number === rowNumber),
      setting,
    };
  }).filter(({ items: rowItems, setting }) => rowItems.length > 0 && setting?.is_enabled !== false);

  if (!isLoading && visibleRows.length === 0) return null;

  return (
    <section
      className="guli-social-promo-section"
      aria-label={isRu ? "Социальные сети GULI" : isEn ? "GULI social media" : "GULI ijtimoiy tarmoqlari"}
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        marginTop: "0",
        marginBottom: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
          minWidth: 0,
          opacity: isLoading && items.length === 0 ? 0.6 : 1,
          transition: "opacity 0.25s ease",
        }}
      >
        {visibleRows.map(({ rowNumber, items: rowItems, setting }) => (
          <SocialPromoMarqueeRow
            key={rowNumber}
            rowNumber={rowNumber}
            items={rowItems}
            setting={setting}
            isDark={isDark}
          />
        ))}
      </div>
    </section>
  );
};
