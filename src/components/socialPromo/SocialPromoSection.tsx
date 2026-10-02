import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SocialPromoItem, SocialPromoRowSetting, SocialPromosApiResponse } from "../../types/socialPromo";
import { SocialPromoMarqueeRow } from "./SocialPromoMarqueeRow";
import { buildApiUrl } from "../../lib/apiOrigin";
import type { Language } from "../../utils/translations";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import {
  MIN_REFRESH_GAP_MS,
  REFRESH_INTERVAL_MS,
  createLatestGate,
  findRowSetting,
  resolveRowSetting,
  revealDelayMs,
  transitionTotalMs,
} from "../../lib/socialPromoMotion";

interface SocialPromoSectionProps {
  language?: Language;
  isDark?: boolean;
}

const ROWS: ReadonlyArray<1 | 2 | 3> = [1, 2, 3];

// Open: panel height grows, each row is wiped in from the left (left -> right) one after another and
// its first chips pop in sequentially. Close: same thing in reverse row order.
// The reduced-motion block deliberately out-specifies the global `* { animation/transition: 0.01ms
// !important }` rule in src/responsive.css so that a light opacity fade still works there.
const SECTION_CSS = `
  .guli-sp-root { width: 100%; max-width: 100%; box-sizing: border-box; margin: 20px 0 12px; overflow-x: clip; }
  .guli-sp-bar {
    display: flex; align-items: center; box-sizing: border-box; max-width: 100%;
    padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
  }
  .guli-sp-trigger {
    display: inline-flex; align-items: center; gap: 10px; min-height: 44px; max-width: 100%;
    padding: 8px 16px 8px 14px; border-radius: 9999px; cursor: pointer;
    font: inherit; font-size: 13px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  }
  .guli-sp-trigger:focus-visible { outline: 2px solid #e11d48; outline-offset: 3px; }
  .guli-sp-trigger-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .guli-sp-trigger-arrow { display: inline-block; font-size: 15px; transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
  .guli-sp-root[data-open="true"] .guli-sp-trigger-arrow { transform: translateX(5px); }

  .guli-sp-panel {
    display: grid; grid-template-rows: 0fr; visibility: hidden; pointer-events: none;
    transition: grid-template-rows 0.36s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 0.62s;
  }
  .guli-sp-root[data-open="true"] .guli-sp-panel {
    grid-template-rows: 1fr; visibility: visible;
    transition: grid-template-rows 0.36s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 0s;
  }
  .guli-sp-root[data-open="true"][data-settled="true"] .guli-sp-panel { pointer-events: auto; }
  .guli-sp-panel-inner { min-height: 0; overflow: hidden; }
  .guli-sp-rows { display: flex; flex-direction: column; gap: 10px; padding: 12px 0 8px; }

  .guli-sp-row {
    opacity: 0; clip-path: inset(-12px 100% -12px 0);
    transition: clip-path 0.46s cubic-bezier(0.16, 1, 0.3, 1) var(--sp-rd, 0ms), opacity 0.3s ease var(--sp-rd, 0ms);
  }
  .guli-sp-root[data-open="true"] .guli-sp-row { opacity: 1; clip-path: inset(-12px 0 -12px 0); }

  .guli-sp-root[data-open="true"] .guli-social-promo-pill {
    animation: guliSpChipIn 0.44s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: calc(var(--sp-rd, 0ms) + var(--sp-ci, 0) * 55ms);
  }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(1) { --sp-ci: 0; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(2) { --sp-ci: 1; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(3) { --sp-ci: 2; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(4) { --sp-ci: 3; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(5) { --sp-ci: 4; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(6) { --sp-ci: 5; }
  .guli-sp-root .guli-social-marquee-group:first-child .guli-social-promo-pill:nth-child(n+7) { --sp-ci: 6; }
  @keyframes guliSpChipIn {
    from { opacity: 0; transform: translateX(-18px) scale(0.9); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }

  @media (max-width: 380px) {
    .guli-sp-trigger { font-size: 12.5px; padding: 8px 14px 8px 12px; gap: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .guli-sp-root .guli-sp-panel {
      opacity: 0;
      transition-property: opacity, visibility !important;
      transition-duration: 0.25s, 0s !important;
      transition-delay: 0s, 0.25s !important;
      transition-timing-function: ease !important;
    }
    .guli-sp-root[data-open="true"] .guli-sp-panel { opacity: 1; transition-delay: 0s, 0s !important; }
    .guli-sp-root .guli-sp-row { opacity: 1; clip-path: none !important; transition: none !important; }
    .guli-sp-root[data-open="true"] .guli-social-promo-pill { animation: none !important; }
    .guli-sp-root .guli-sp-trigger-arrow { transition: none !important; }
  }
`;

export const SocialPromoSection: React.FC<SocialPromoSectionProps> = ({
  language = "uz",
  isDark = false,
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  const reducedMotion = usePrefersReducedMotion();
  const panelId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [items, setItems] = useState<SocialPromoItem[]>([]);
  const [settings, setSettings] = useState<SocialPromoRowSetting[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [settled, setSettled] = useState<boolean>(false);

  const gateRef = useRef(createLatestGate());
  const lastSignatureRef = useRef<string>("");
  const lastLoadAtRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  const load = useCallback(async (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastLoadAtRef.current < MIN_REFRESH_GAP_MS) return;
    lastLoadAtRef.current = now;
    const token = gateRef.current.next();
    try {
      const res = await fetch(buildApiUrl("/api/social-promos"), { cache: "no-store" });
      if (!res.ok) throw new Error("Network response was not ok");
      const json: SocialPromosApiResponse = await res.json();
      // Out-of-order or post-unmount responses must never overwrite newer data.
      if (!mountedRef.current || !gateRef.current.isLatest(token)) return;
      if (!json?.success || !json.data) return;
      const nextItems = Array.isArray(json.data.items) ? json.data.items : null;
      const nextSettings = Array.isArray(json.data.settings) ? json.data.settings : null;
      const signature = JSON.stringify([nextItems, nextSettings]);
      if (signature === lastSignatureRef.current) return; // unchanged: do not restart animations
      lastSignatureRef.current = signature;
      if (nextItems) setItems(nextItems);
      if (nextSettings && nextSettings.length > 0) setSettings(nextSettings);
    } catch {
      // Keep what is already on screen; the next refresh retries.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(true);

    // Same-window admin save, other devices (interval), tab/app coming back to the foreground.
    const onRefreshEvent = () => {
      void load(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const onFocus = () => {
      void load(false);
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, REFRESH_INTERVAL_MS);

    window.addEventListener("guli_refresh_social_promos", onRefreshEvent);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener("guli_refresh_social_promos", onRefreshEvent);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const rows = ROWS.map((rowNumber) => ({
    rowNumber,
    rowItems: items.filter((it) => it.row_number === rowNumber),
    rawSetting: findRowSetting(settings, rowNumber),
  })).filter((row) => row.rowItems.length > 0 && resolveRowSetting(row.rawSetting, row.rowNumber).isEnabled);
  const rowCount = rows.length;

  const rowCountRef = useRef<number>(rowCount);
  rowCountRef.current = rowCount;

  // Links stay inert until the open transition has finished, so a tap during the animation
  // cannot hit a chip that is still sliding in.
  useEffect(() => {
    setSettled(false);
    if (!open) return undefined;
    const timer = window.setTimeout(() => setSettled(true), transitionTotalMs(rowCountRef.current, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [open, reducedMotion]);

  // Escape and outside tap/click close the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const root = rootRef.current;
      const focusInside = !!root && root.contains(document.activeElement);
      setOpen(false);
      if (focusInside) triggerRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      const target = e.target;
      if (root && target instanceof Node && !root.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Nothing to show (still loading, empty, or all rows disabled): render nothing, and reset state.
  useEffect(() => {
    if (rowCount === 0) setOpen(false);
  }, [rowCount]);

  if (rowCount === 0) return null;

  const label = isRu ? "Соцсети" : isEn ? "Social media" : "Ijtimoiy tarmoqlar";
  const groupLabel = isRu ? "Мы в социальных сетях" : isEn ? "Follow us on social media" : "Biz ijtimoiy tarmoqlarda";
  const toggleLabel = open
    ? isRu
      ? "Закрыть социальные сети"
      : isEn
      ? "Close social media links"
      : "Ijtimoiy tarmoqlarni yopish"
    : isRu
    ? "Открыть социальные сети"
    : isEn
    ? "Open social media links"
    : "Ijtimoiy tarmoqlarni ochish";

  return (
    <section
      ref={rootRef}
      className="guli-sp-root guli-social-promo-section"
      data-open={open ? "true" : "false"}
      data-settled={settled ? "true" : "false"}
      aria-label="Social media links"
    >
      <style>{SECTION_CSS}</style>

      <div className="guli-sp-bar">
        <button
          ref={triggerRef}
          type="button"
          className="guli-sp-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={toggleLabel}
          onClick={() => setOpen((prev) => !prev)}
          style={{
            background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
            color: "#ffffff",
            border: "1px solid rgba(225, 29, 72, 0.5)",
            boxShadow: isDark ? "0 6px 18px rgba(225, 29, 72, 0.28)" : "0 6px 18px rgba(190, 24, 93, 0.22)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
          </svg>
          <span className="guli-sp-trigger-label">{label}</span>
          <span className="guli-sp-trigger-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>

      <div id={panelId} className="guli-sp-panel" role="group" aria-label={groupLabel} aria-hidden={!open}>
        <div className="guli-sp-panel-inner">
          <div className="guli-sp-rows">
            {rows.map((row, index) => (
              <div
                key={row.rowNumber}
                className="guli-sp-row"
                style={{ "--sp-rd": `${revealDelayMs(index, rowCount, open)}ms` } as React.CSSProperties}
              >
                <SocialPromoMarqueeRow
                  rowNumber={row.rowNumber}
                  items={row.rowItems}
                  setting={row.rawSetting}
                  isDark={isDark}
                  paused={!open}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
