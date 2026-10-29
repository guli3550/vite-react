export interface GuliBeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

type InstallListener = (event: GuliBeforeInstallPromptEvent | null) => void;

let deferredInstallEvent: GuliBeforeInstallPromptEvent | null = null;
const listeners = new Set<InstallListener>();

function notify() {
  listeners.forEach((listener) => listener(deferredInstallEvent));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallEvent = event as GuliBeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallEvent = null;
    notify();
  });
}

export function getGuliInstallPrompt(): GuliBeforeInstallPromptEvent | null {
  return deferredInstallEvent;
}

export function subscribeGuliInstallPrompt(listener: InstallListener): () => void {
  listeners.add(listener);
  listener(deferredInstallEvent);
  return () => listeners.delete(listener);
}

/** Opens the browser's native PWA install dialog after a direct user action. */
export async function promptGuliInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredInstallEvent;
  if (!event) return "unavailable";

  // A browser install event is one-shot; clear it before prompting to avoid
  // multiple UI surfaces attempting to consume the same event.
  deferredInstallEvent = null;
  notify();

  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}
