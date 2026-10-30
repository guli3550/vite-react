export interface GuliInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: GuliInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as GuliInstallPromptEvent;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("Install prompt listener error:", err);
      }
    });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("App installed listener error:", err);
      }
    });
  });
}

export function getGuliInstallPrompt(): GuliInstallPromptEvent | null {
  return deferredPrompt;
}

export function isGuliStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isDisplayStandalone || isIosStandalone;
}

export async function promptGuliInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      return "accepted";
    }
    return "dismissed";
  } catch (err) {
    console.error("Error invoking PWA install prompt:", err);
    return "unavailable";
  }
}

export function subscribeToGuliInstallPrompt(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
