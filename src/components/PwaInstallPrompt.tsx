import { useEffect, useState } from "react";
import { getGuliInstallPrompt, isGuliStandalone, promptGuliInstall, subscribeToGuliInstallPrompt, type GuliInstallPromptEvent } from "../lib/pwaInstall";
import "./PwaInstallPrompt.css";

const DISMISS_KEY = "guli_pwa_install_dismissed_until_v2";
const DISMISS_MS = 24 * 60 * 60 * 1000;

export function PwaInstallPrompt({ hidden = false }: { hidden?: boolean }) {
  const [installEvent, setInstallEvent] = useState<GuliInstallPromptEvent | null>(getGuliInstallPrompt());
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isGuliStandalone()) return;
    if (window.Telegram?.WebApp?.initData) return;

    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (until > Date.now()) return;
    } catch {}

    const unsubscribe = subscribeToGuliInstallPrompt(() => {
      const available = getGuliInstallPrompt();
      setInstallEvent(available);
      if (available) window.setTimeout(() => setVisible(true), 350);
    });
    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
      setBusy(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !visible || !installEvent || isGuliStandalone()) return null;

  const install = async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await promptGuliInstall();
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      setBusy(false);
      if (outcome === "dismissed") {
        setVisible(false);
        try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS)); } catch {}
      }
    }
  };

  const later = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS)); } catch {}
  };

  return (
    <aside className="guliPwaInstallPrompt" aria-label="GULI MARKET ilovasini o‘rnatish">
      <div className="guliPwaInstallIcon" aria-hidden="true">
        <img src="/guli-logo.png" alt="" />
      </div>
      <div className="guliPwaInstallCopy">
        <strong>GULI MARKET'ni o‘rnating</strong>
        <span>Sevimli do‘koningiz har doim yoningizda — tez, qulay va bir zumda!</span>
      </div>
      <button type="button" className="guliPwaInstallButton" onClick={() => void install()} disabled={busy}>
        {busy ? <span className="guliPwaInstallSpinner" aria-label="O‘rnatilmoqda" /> : "O‘rnatish"}
      </button>
      <button type="button" className="guliPwaInstallClose" onClick={later} aria-label="Keyinroq">×</button>
    </aside>
  );
}
