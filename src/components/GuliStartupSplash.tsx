import { useEffect, useState } from "react";
import { Truck, ShieldCheck, Gift } from "lucide-react";
import "./GuliStartupSplash.css";

/**
 * GULI branded startup splash.
 *
 * The logo is intentionally NOT rendered here: the final background artwork
 * will contain the GULI logo as part of the image itself.
 */
const BENEFITS = [
  { Icon: Truck, label: "Tez yetkazib berish" },
  { Icon: ShieldCheck, label: "Xavfsiz savdo" },
  { Icon: Gift, label: "Siz uchun ehtiyotkorlik bilan" },
];

export function GuliStartupSplash() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const value = Number((event as CustomEvent<{ progress?: number }>).detail?.progress);
      if (!Number.isFinite(value)) return;
      setProgress((current) => Math.max(current, Math.min(100, value)));
    };

    window.addEventListener("guli_startup_progress", onProgress);

    // The splash has a fixed 3-second visual window. The progress bar itself
    // is NOT a looping animation: App reports real startup milestones.
    const DURATION_MS = 3000;
    const leaveTimer = window.setTimeout(() => {
      setProgress((current) => (current >= 100 ? 100 : current));
      setLeaving(true);
      window.setTimeout(() => setMounted(false), 380);
    }, DURATION_MS);

    return () => {
      window.removeEventListener("guli_startup_progress", onProgress);
      window.clearTimeout(leaveTimer);
    };
  }, []);

  if (!mounted) return null;

  const isReady = progress >= 100;

  return (
    <div
      className={`guliSplash${leaving ? " guliSplashLeaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="GULI Market yuklanmoqda"
    >
      <div className="guliSplashGlow" aria-hidden="true" />

      <div className="guliSplashBody">
        <div className="guliSplashBrand">GULI MARKET</div>
        <div className="guliSplashTagline">Go‘zallik har doim siz bilan</div>
        <div className="guliSplashHeart" aria-hidden="true">♥</div>

        <div className="guliSplashBenefits">
          {BENEFITS.map(({ Icon, label }) => (
            <div className="guliSplashBenefit" key={label}>
              <span className="guliSplashBenefitIcon">
                <Icon size={25} strokeWidth={1.8} />
              </span>
              <span className="guliSplashBenefitLabel">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="guliSplashFooter">
        <div
          className="guliSplashProgressTrack"
          role="progressbar"
          aria-label="GULI Market yuklanish jarayoni"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="guliSplashProgressBar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="guliSplashStatus">
          {isReady ? "Guli Market'ga xush kelibsiz!" : "Tizim yuklanmoqda..."}
        </div>
      </div>
    </div>
  );
}

export default GuliStartupSplash;
