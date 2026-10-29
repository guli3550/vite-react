export interface GuliInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

let deferredPrompt: GuliInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as GuliInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifySubscribers();
  });
}

export function getGuliInstallPrompt(): GuliInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeToGuliInstallPrompt(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  subscriber();
  return () => subscribers.delete(subscriber);
}

export async function promptGuliInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";

  try {
    await event.prompt();
    const choice = await event.userChoice;
    deferredPrompt = null;
    notifySubscribers();
    return choice.outcome;
  } catch {
    deferredPrompt = null;
    notifySubscribers();
    return "unavailable";
  }
}

export function isGuliStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}
