import React, { useRef, useState } from "react";
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
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;
  if (setting && setting.is_enabled === false) return null;

  const direction = setting?.direction === "right" ? "right" : "left";
  const duration = Math.max(10, Math.min(180, setting?.duration_seconds || (rowNumber === 2 ? 42 : rowNumber === 3 ? 36 : 34)));

  // Ensure sufficient item quantity for seamless wrap-around loop across wide monitors
  let displayList = [...items];
  while (displayList.length < 5) {
    displayList = [...displayList, ...items];
  }

  const animationName = direction === "right" ? `guliMarqueeRight_${rowNumber}` : `guliMarqueeLeft_${rowNumber}`;

  return (
    <div
      className="guli-social-marquee-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
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
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        @keyframes guliMarqueeRight_${rowNumber} {
          0% {
            transform: translate3d(-50%, 0, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .guli-social-marquee-track-${rowNumber} {
            animation-play-state: paused !important;
          }
        }
        .guli-social-promo-pill:hover {
          transform: translateY(-2px) scale(1.03);
        }
        .guli-social-promo-pill:active {
          transform: scale(0.96);
        }
      `}</style>

      <div
        ref={trackRef}
        className={`guli-social-marquee-track-${rowNumber}`}
        style={{
          display: "flex",
          gap: "12px",
          width: "max-content",
          willChange: "transform",
          animationName,
          animationDuration: `${duration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {/* First Half */}
        {displayList.map((item, idx) => (
          <SocialPromoButton
            key={`r${rowNumber}-a-${item.id}-${idx}`}
            item={item}
            isDark={isDark}
          />
        ))}

        {/* Second Half (duplicate for seamless wrap-around loop) */}
        {displayList.map((item, idx) => (
          <SocialPromoButton
            key={`r${rowNumber}-b-${item.id}-${idx}`}
            item={item}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
};
