import { useEffect, useState } from "react";
import { Truck, ShieldCheck, HeartHandshake } from "lucide-react";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";
import "./GuliStartupSplash.css";

/** GULI branded startup splash. App initializes underneath the overlay. */

const BENEFITS = [
  { Icon: Truck, label: "Tez yetkazib berish" },
  { Icon: ShieldCheck, label: "Xavfsiz savdo" },
  { Icon: HeartHandshake, label: "Siz uchun ehtiyotkorlik bilan" },
];

export function GuliStartupSplash() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false); // true just before hide -> swaps status copy


  useEffect(() => {
    // Keep the branded splash on screen for exactly 3 seconds.
    // App initialization starts underneath it immediately, so the 3-second
    // window is used for catalog/category/banner/image preloading.
    const DURATION_MS = 3000;
    const leaveTimer = window.setTimeout(() => {
      setReady(true);
      setLeaving(true);
      window.setTimeout(() => setMounted(false), 380);
    }, DURATION_MS);

    return () => {
      window.clearTimeout(leaveTimer);
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
