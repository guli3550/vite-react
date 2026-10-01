import React, { useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting } from "../../types/socialPromo";
import { SocialPromoButton } from "./SocialPromoButton";

interface SocialPromoMarqueeRowProps {
  rowNumber: 1 | 2 | 3;
  items: SocialPromoItem[];
  setting?: SocialPromoRowSetting;
  isDark?: boolean;
}

export const SocialPromoMarqueeRow: React.FC<SocialPromoMarqueeRowProps> = ({
  rowNumber,
  items,
  setting,
  isDark = false,
}) => {
  const [isPaused, setIsPaused] = useState(false);

  if (!items?.length || setting?.is_enabled === false) return null;

  const direction = setting?.direction === "right" ? "right" : "left";
  const duration = Math.max(5, Math.min(180, Number(setting?.duration_seconds) || (rowNumber === 2 ? 42 : rowNumber === 3 ? 36 : 34)));

  // Keep enough cards to cover wide screens, then duplicate one exact-width group.
  let displayList = [...items];
  while (displayList.length < 5) displayList = [...displayList, ...items];

  const animationName = direction === "right" ? `guliMarqueeRight_${rowNumber}` : `guliMarqueeLeft_${rowNumber}`;

  const renderCards = (suffix: string) => displayList.map((item, idx) => (
    <SocialPromoButton key={`r${rowNumber}-${suffix}-${item.id}-${idx}`} item={item} isDark={isDark} />
  ));

  return (
    <div
      className="guli-social-marquee-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      style={{
        width: "100%",
        overflow: "hidden",
        position: "relative",
        padding: "4px 0",
        touchAction: "pan-y",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%)",
        maskImage: "linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%)",
      }}
    >
      <style>{`
        @keyframes guliMarqueeLeft_${rowNumber} {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes guliMarqueeRight_${rowNumber} {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        .guli-social-promo-pill:hover { transform: translateY(-2px) scale(1.03); }
        .guli-social-promo-pill:active { transform: scale(0.96); }
      `}</style>

      <div
        className={`guli-social-marquee-track guli-social-marquee-track-${rowNumber}`}
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 0,
          width: "max-content",
          minWidth: "max-content",
          willChange: "transform",
          animation: `${animationName} ${duration}s linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        <div className="guli-social-marquee-group" style={{ display: "flex", flex: "0 0 auto", gap: "12px", paddingRight: "12px" }}>
          {renderCards("a")}
        </div>
        <div className="guli-social-marquee-group" aria-hidden="true" style={{ display: "flex", flex: "0 0 auto", gap: "12px", paddingRight: "12px" }}>
          {renderCards("b")}
        </div>
      </div>
    </div>
  );
};
