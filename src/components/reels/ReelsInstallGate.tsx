import React, { useEffect, useState } from "react";
import { Reels3DIcon } from "../Nav3DIcons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export const ReelsInstallGate: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (installEvent) {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          setInstallEvent(null);
        }
      } else {
        window.alert("Chrome menyusi (⋮) → “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish” bandini tanlang. O‘rnatilgach, GULI MARKET’ni bosh ekrandan oching.");
      }
    } catch {
      window.alert("O‘rnatish oynasini ochib bo‘lmadi. Brauzer menyusidan “Ilovani o‘rnatish” bandini tanlang.");
    } finally {
      setBusy(false);
    }
  };

  if (isStandalone() || Boolean(window.Telegram?.WebApp?.initData)) return null;

  return (
    <main className="reelsContainer reelsEmptyView" style={{ display: "grid", placeItems: "center", padding: "24px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "24px", color: "#fff" }}>
        <div aria-hidden="true" style={{ width: "76px", height: "76px", display: "grid", placeItems: "center" }}>
          <Reels3DIcon active className="reelsInstallGateIcon" />
        </div>
        <h2 style={{ margin: 0, fontSize: "23px", lineHeight: 1.45, fontWeight: 800 }}>
          Reels ko‘rish uchun GULI MARKET’ni o‘rnating
        </h2>
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          aria-label="GULI MARKET’ni o‘rnatish"
          title="O‘rnatish"
          style={{ width: "min(100%, 390px)", minHeight: "54px", border: 0, borderRadius: "16px", background: "#ff477e", color: "#fff", display: "grid", placeItems: "center", cursor: busy ? "wait" : "pointer", boxShadow: "0 8px 24px rgba(255,71,126,.25)" }}
        >
          <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 17v3h14v-3" />
          </svg>
        </button>
      </div>
    </main>
  );
};
