import React, { useEffect, useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting, SocialPromosApiResponse } from "../../types/socialPromo";
import { SocialPromoMarqueeRow } from "./SocialPromoMarqueeRow";
import { buildApiUrl } from "../../lib/apiOrigin";
import type { Language } from "../../utils/translations";

interface SocialPromoSectionProps {
  language?: Language;
  isDark?: boolean;
}

// Fallback seed in case of network latency
const FALLBACK_ITEMS: SocialPromoItem[] = [
  // Row 1
  {
    id: "f-1",
    title: "Instagram",
    platform: "instagram",
    label: "Instagram · @guli_market",
    target_url: "https://www.instagram.com/guli_market",
    row_number: 1,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-2",
    title: "Telegram",
    platform: "telegram",
    label: "Telegram · Rasmiy kanal",
    target_url: "https://t.me/guli_market",
    row_number: 1,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-3",
    title: "YouTube",
    platform: "youtube",
    label: "YouTube · Guli Market TV",
    target_url: "https://www.youtube.com/@guli_market",
    row_number: 1,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-4",
    title: "Telegram Bot",
    platform: "telegram",
    label: "Telegram · Buyurtmalar boti",
    target_url: "https://t.me/guli_market_bot",
    row_number: 1,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },

  // Row 2
  {
    id: "f-5",
    title: "Instagram Obzor",
    platform: "instagram",
    label: "Instagram · Yangi kolleksiya",
    target_url: "https://www.instagram.com/guli_market",
    row_number: 2,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-6",
    title: "Telegram Hamjamiyat",
    platform: "telegram",
    label: "Telegram · Mijozlar guruhi",
    target_url: "https://t.me/guli_market_chat",
    row_number: 2,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-7",
    title: "YouTube Moda",
    platform: "youtube",
    label: "YouTube · Moda va stillar",
    target_url: "https://www.youtube.com/@guli_market",
    row_number: 2,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-8",
    title: "Instagram Reels",
    platform: "instagram",
    label: "Instagram · Eksklyuziv Reels",
    target_url: "https://www.instagram.com/guli_market/reels",
    row_number: 2,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },

  // Row 3
  {
    id: "f-9",
    title: "Telegram Support",
    platform: "telegram",
    label: "Telegram · 24/7 Qo‘llab-quvvatlash",
    target_url: "https://t.me/guli_support",
    row_number: 3,
    sort_order: 10,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-10",
    title: "Instagram VIP",
    platform: "instagram",
    label: "Instagram · Maxsus chegirmalar",
    target_url: "https://www.instagram.com/guli_market",
    row_number: 3,
    sort_order: 20,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-11",
    title: "YouTube Shorts",
    platform: "youtube",
    label: "YouTube · Mahsulot videolari",
    target_url: "https://www.youtube.com/@guli_market/shorts",
    row_number: 3,
    sort_order: 30,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
  {
    id: "f-12",
    title: "Telegram News",
    platform: "telegram",
    label: "Telegram · Hafta yangiliklari",
    target_url: "https://t.me/guli_news",
    row_number: 3,
    sort_order: 40,
    is_active: true,
    open_in_new_tab: true,
    mobile_visible: true,
  },
];

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
          if (Array.isArray(json.data.items)) {
            setItems(json.data.items);
          }
          if (Array.isArray(json.data.settings)) {
            setSettings(json.data.settings);
          }
        }
      } catch {
        // Keep the profile usable; do not display hard-coded links when the API is unavailable.
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
