<parameter name="content">import { useEffect, useRef, useState } from "react";
import { Truck, ShieldCheck, HeartHandshake } from "lucide-react";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";
import "./GuliStartupSplash.css";

/**
 * GuliStartupSplash — purely visual, non-blocking startup overlay.
 *
 * It never gates the real application: <App/> mounts and starts its own
 * initialization (catalog, auth state, Telegram, Supabase, etc.) at the
 * exact same time this overlay is painted on top of it. This component
 * only controls how long the *overlay* stays visible before fading away.
 *
 * Dismiss timing:
 *  - Never later than MAX_MS after mount (hard safety cap).
 *  - Not before MIN_MS, so the brand animation has time to play once the
 *    browser has actually painted a frame (two rAFs = paint confirmed).
 *  - Respects prefers-reduced-motion by shortening both bounds and
 *    skipping transform-based animation (see CSS).
 */

const BENEFITS = [
  { Icon: Truck, label: "Tez yetkazib berish" },
  { Icon: ShieldCheck, label: "Xavfsiz savdo" },
  { Icon: HeartHandshake, label: "Siz uchun ehtiyotkorlik bilan" },
];

export function GuliStartupSplash() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false); // true just before hide -> swaps status copy
  const timers = useRef<number[]>([]);
  const raf = useRef<number[]>([]);

  useEffect(() => {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const MIN_MS = reduceMotion ? 300 : 1100;
    const MAX_MS = reduceMotion ? 650 : 1800;
    const FADE_MS = reduceMotion ? 120 : 380;

    const addTimer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    const startLeave = () => {
      setReady(true);
      // brief "welcome" swap before the overlay actually fades
      addTimer(() => {
        setLeaving(true);
        addTimer(() => setMounted(false), FADE_MS);
      }, reduceMotion ? 80 : 260);
    };

    const startedAt = Date.now();
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        // Browser has painted at least one real frame of the app underneath.
        const elapsed = Date.now() - startedAt;
        addTimer(startLeave, Math.max(0, MIN_MS - elapsed));
      });
      raf.current.push(id2);
    });
    raf.current.push(id1);

    // Hard safety cap regardless of rAF/timer state.
    addTimer(startLeave, MAX_MS);

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      raf.current.forEach((r) => cancelAnimationFrame(r));
      timers.current = [];
      raf.current = [];
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`guliSplash${leaving ? " guliSplashLeaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="GULI Market yuklanmoqda"
    >
      <div className="guliSplashGlow" aria-hidden="true" />

      <div className="guliSplashBody">
        <div className="guliSplashLogoWrap">
          <img
            src={GULI_LOGO_BASE64}
            alt="GULI"
            className="guliSplashLogo"
            draggable={false}
          />
        </div>

        <div className="guliSplashBrand">GULI MARKET</div>
        <div className="guliSplashTagline">Go‘zallik har doim siz bilan</div>

        <div className="guliSplashBenefits">
          {BENEFITS.map(({ Icon, label }) => (
            <div className="guliSplashBenefit" key={label}>
              <span className="guliSplashBenefitIcon">
                <Icon size={16} strokeWidth={2.1} />
              </span>
              <span className="guliSplashBenefitLabel">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="guliSplashFooter">
        <div className="guliSplashProgressTrack" aria-hidden="true">
          <div className="guliSplashProgressBar" />
        </div>
        <div className="guliSplashStatus">
          {ready ? "Guli Market’ga xush kelibsiz!" : "Tizim yuklanmoqda…"}
        </div>
      </div>
    </div>
  );
}

export default GuliStartupSplash;
