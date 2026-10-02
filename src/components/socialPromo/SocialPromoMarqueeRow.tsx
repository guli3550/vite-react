import React, { useEffect, useMemo, useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting } from "../../types/socialPromo";
import { SocialPromoButton } from "./SocialPromoButton";
import {
  buildDisplayList,
  marqueeAnimationName,
  marqueeAnimationValue,
  minCardsForWidth,
  resolveRowSetting,
} from "../../lib/socialPromoMotion";

interface SocialPromoMarqueeRowProps {
  rowNumber: 1 | 2 | 3;
  items: SocialPromoItem[];
  setting?: SocialPromoRowSetting;
  isDark?: boolean;
  /** External pause (e.g. the expandable panel is closed). */
  paused?: boolean;
}

function readViewportWidth(): number {
  if (typeof window === "undefined") return 390;
  return window.innerWidth || 390;
}

function useViewportWidth(): number {
  const [width, setWidth] = useState<number>(readViewportWidth);
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setWidth(readViewportWidth()), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return width;
}

export const SocialPromoMarqueeRow: React.FC<SocialPromoMarqueeRowProps> = ({
  rowNumber,
  items,
  setting,
  isDark = false,
  paused = false,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const viewportWidth = useViewportWidth();

  // Admin value (seconds) -> safe 5-180 range; DB value always beats the code default.
  const resolved = resolveRowSetting(setting, rowNumber);

  // Repeat cards until one group is at least as wide as the screen (no empty tail on desktop).
  const displayList = useMemo(
    () => buildDisplayList(items ?? [], minCardsForWidth(viewportWidth)),
    [items, viewportWidth]
  );

  if (!items?.length || !resolved.isEnabled) return null;

  // Keep each configured row on one horizontal track. The marquee remains active
  // across mobile WebViews as requested; it must never wrap into extra visual rows.

  const isRunning = !paused && !isPaused;

  const renderCards = (suffix: string) =>
    displayList.map((item, idx) => (
      <SocialPromoButton key={`r${rowNumber}-${suffix}-${item.id}-${idx}`} item={item} isDark={isDark} />
    ));

  // Hover pause is for real mice only: touch emulates mouseenter and would leave the row paused.
  const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setIsPaused(true);
  };
  const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setIsPaused(false);
  };
  // Keyboard focus pauses; a tap-focus (touch) does not.
  const onFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    try {
      if (e.target.matches(":focus-visible")) setIsPaused(true);
    } catch {
      // :focus-visible unsupported -> never pause on focus
    }
  };
  const onBlurCapture = () => setIsPaused(false);

  return (
    <div
      className="guli-social-marquee-container"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
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
        @keyframes ${marqueeAnimationName(rowNumber, "left")} {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes ${marqueeAnimationName(rowNumber, "right")} {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        .guli-social-promo-pill:hover { transform: translateY(-2px) scale(1.03); }
        .guli-social-promo-pill:active { transform: scale(0.96); }

        /* Keep this explicitly configured storefront marquee moving even when
           the global reduced-motion rule would otherwise freeze it at 0.01ms. */
        @media (prefers-reduced-motion: reduce) {
          .guli-social-marquee-track-${rowNumber} {
            animation-duration: ${resolved.durationSeconds}s !important;
            animation-iteration-count: infinite !important;
          }
        }
      `}</style>

      <div
        className={`guli-social-marquee-track guli-social-marquee-track-${rowNumber}`}
        data-duration-seconds={resolved.durationSeconds}
        data-direction={resolved.direction}
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 0,
          width: "max-content",
          minWidth: "max-content",
          willChange: isRunning ? "transform" : "auto",
          animation: marqueeAnimationValue(rowNumber, resolved.direction, resolved.durationSeconds),
          animationPlayState: isRunning ? "running" : "paused",
        }}
      >
        <div
          className="guli-social-marquee-group"
          style={{ display: "flex", flex: "0 0 auto", gap: "12px", paddingRight: "12px" }}
        >
          {renderCards("a")}
        </div>
        <div
          className="guli-social-marquee-group"
          aria-hidden="true"
          style={{ display: "flex", flex: "0 0 auto", gap: "12px", paddingRight: "12px" }}
        >
          {renderCards("b")}
        </div>
      </div>
    </div>
  );
};
