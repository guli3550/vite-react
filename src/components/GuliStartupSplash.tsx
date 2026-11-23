import { useEffect, useState } from "react";
import { Truck, ShieldCheck, Gift } from "lucide-react";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";
import {
  computeNextSplashProgress,
  getStartupProgressState,
} from "../utils/startupProgress";
import "./GuliStartupSplash.css";

const BENEFITS = [
  { Icon: Truck, label: "Tez yetkazib berish" },
  { Icon: ShieldCheck, label: "Xavfsiz savdo" },
  { Icon: Gift, label: "Siz uchun" },
];

const MIN_VISIBLE_MS = 700;
const SAFETY_TIMEOUT_MS = 5500;

export function GuliStartupSplash() {
  const initial = getStartupProgressState();
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [targetProgress, setTargetProgress] = useState(() => Math.max(15, initial.progress));
  const [progress, setProgress] = useState(() => Math.max(12, Math.min(100, initial.progress || 12)));
  const [statusLabel, setStatusLabel] = useState(() => initial.label || "Ilova ishga tushmoqda...");
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    let unmountTimer: number | null = null;
    let finished = false;

    const triggerLeave = () => {
      if (finished) return;
      finished = true;
      setLeaving(true);
      unmountTimer = window.setTimeout(() => setMounted(false), 380);
    };

    const syncFromState = (nextProgress?: number, nextLabel?: string) => {
      if (typeof nextProgress === "number" && Number.isFinite(nextProgress)) {
        const clamped = Math.max(0, Math.min(100, nextProgress));
        setTargetProgress((prev) => Math.max(prev, clamped));
      }
      if (typeof nextLabel === "string" && nextLabel.trim()) {
        setStatusLabel(nextLabel.trim());
      }
    };

    const latest = getStartupProgressState();
    syncFromState(latest.progress, latest.label);

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ progress?: number; label?: string }>).detail;
      syncFromState(detail?.progress, detail?.label);
    };

    window.addEventListener("guli_startup_progress", onProgress);

    const safetyTimer = window.setTimeout(() => {
      setTargetProgress(100);
      setProgress(100);
      setStatusLabel("Guli Market'ga xush kelibsiz!");
      triggerLeave();
    }, SAFETY_TIMEOUT_MS);

    return () => {
      window.removeEventListener("guli_startup_progress", onProgress);
      window.clearTimeout(safetyTimer);
      if (unmountTimer !== null) window.clearTimeout(unmountTimer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((prev) => computeNextSplashProgress(prev, targetProgress));
    }, 50);
    return () => window.clearInterval(timer);
  }, [targetProgress]);

  useEffect(() => {
    if (targetProgress < 100 || progress < 100) return;

    const elapsed = Date.now() - mountedAt;
    const leaveDelay = Math.max(180, MIN_VISIBLE_MS - elapsed);
    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, leaveDelay);
    const unmountTimer = window.setTimeout(() => {
      setMounted(false);
    }, leaveDelay + 380);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [targetProgress, progress, mountedAt]);

  if (!mounted) return null;

  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const isReady = roundedProgress >= 100;

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
            alt="Guli Market"
            className="guliSplashLogo"
            loading="eager"
            decoding="sync"
            draggable={false}
          />
        </div>
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

        <div className="guliSplashFooter">
          <div className="guliSplashStatusRow">
            <span className="guliSplashStatus">
              {isReady ? "Guli Market'ga xush kelibsiz!" : statusLabel}
            </span>
            <span className="guliSplashPercent">{roundedProgress}%</span>
          </div>
          <div
            className="guliSplashProgressTrack"
            role="progressbar"
            aria-label="GULI Market yuklanish jarayoni"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={roundedProgress}
          >
            <div
              className="guliSplashProgressBar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuliStartupSplash;
