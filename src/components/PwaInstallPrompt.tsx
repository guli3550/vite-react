import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = "guli_pwa_install_dismissed_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.Telegram?.WebApp?.initData) return;

    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (until > Date.now()) return;
    } catch {}

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
      window.setTimeout(() => setVisible(true), 1800);
    };

    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !installEvent) return null;

  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        setVisible(false);
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
        } catch {}
      }
    } catch {
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {}
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
      <button
        type="button"
        className="guliPwaInstallButton"
        onClick={() => void install()}
        disabled={busy}
      >
        {busy ? "..." : "O‘rnatish"}
      </button>
      <button
        type="button"
        className="guliPwaInstallClose"
        onClick={later}
        aria-label="Keyinroq"
      >
        ×
      </button>
    </aside>
  );
}
