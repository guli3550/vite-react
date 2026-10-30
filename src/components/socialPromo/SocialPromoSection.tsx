import React from "react";
import { SOCIAL_PROMO_ITEMS, SOCIAL_PROMO_SETTINGS } from "../../data/socialPromoSnapshot";
import { SocialPromoMarqueeRow } from "./SocialPromoMarqueeRow";
import type { Language } from "../../utils/translations";

interface SocialPromoSectionProps {
  language?: Language;
  isDark?: boolean;
  variant?: "pill" | "highlight";
  maxRows?: number;
}

/**
 * Profile social links are intentionally a local, read-only snapshot.
 * No public/admin API calls, refresh events, timers or visibility listeners.
 * The snapshot mirrors the saved Supabase configuration from 2026-10-30.
 */
export const SocialPromoSection: React.FC<SocialPromoSectionProps> = ({
  language = "uz",
  isDark = false,
  variant = "pill",
  maxRows,
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";
  const effectiveMaxRows = maxRows || (variant === "highlight" ? 1 : 3);

  const visibleRows = SOCIAL_PROMO_SETTINGS
    .map((setting) => ({
      rowNumber: setting.row_number,
      setting,
      items: SOCIAL_PROMO_ITEMS.filter(
        (item) => item.row_number === setting.row_number && item.is_active && item.mobile_visible
      ),
    }))
    .filter(({ items, setting }) => items.length > 0 && setting.is_enabled)
    .slice(0, effectiveMaxRows);

  if (visibleRows.length === 0) return null;

  return (
    <section
      className={`guli-social-promo-section ${variant === "highlight" ? "is-highlight-mode" : ""}`}
      aria-label={isRu ? "Социальные сети GULI" : isEn ? "GULI social media" : "GULI ijtimoiy tarmoqlari"}
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        marginTop: "0px",
        marginBottom: "0px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: variant === "highlight" ? "6px" : "10px",
          width: "100%",
          minWidth: 0,
        }}
      >
        {visibleRows.map(({ rowNumber, items, setting }) => (
          <SocialPromoMarqueeRow
            key={rowNumber}
            rowNumber={rowNumber}
            items={items}
            setting={setting}
            isDark={isDark}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
};
