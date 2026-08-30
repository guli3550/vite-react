export type PlatformType = "telegram" | "android" | "windows" | "tv" | "browser";

export interface PlatformInfo {
  type: PlatformType;
  isTelegram: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  isTV: boolean;
  isTouch: boolean;
}

export function detectPlatform(): PlatformInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // 1. Telegram WebApp Check (specifically when opened via Telegram Bot / App)
  const tg = typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null;
  const urlParams = typeof window !== "undefined" ? (window.location.search + window.location.hash) : "";
  const hasTgUrlParam = Boolean(urlParams.includes("tgWebApp") || urlParams.includes("tgWebAppData"));
  const isTgPlatform = Boolean(tg?.platform && tg.platform !== "unknown");
  const hasInitData = Boolean(tg?.initData && tg.initData.length > 0) || Boolean(tg?.initDataUnsafe?.user);

  const isTelegram = Boolean(
    hasInitData || isTgPlatform || hasTgUrlParam || /Telegram/i.test(ua)
  );

  // 2. TV / Smart Display Check
  const isTV = Boolean(
    /SmartTV|SMART-TV|Tizen|Web0S|BRAVIA|NetCast|Android TV|GoogleTV|AppleTV|HbbTV|Xbox|PlayStation/i.test(ua) ||
    (typeof window !== "undefined" && window.innerWidth >= 2100 && !isTouch)
  );

  // 3. Android Mobile/Tablet Check
  const isAndroid = /Android/i.test(ua) && !isTV;

  // 4. Windows PC Check
  const isWindows = /Windows NT|Win64|Win32/i.test(ua) && !isTV;

  let type: PlatformType = "browser";
  if (isTelegram) {
    type = "telegram";
  } else if (isTV) {
    type = "tv";
  } else if (isAndroid) {
    type = "android";
  } else if (isWindows) {
    type = "windows";
  }

  return {
    type,
    isTelegram,
    isAndroid,
    isWindows,
    isTV,
    isTouch,
  };
}

export function initPlatformEnvironment() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const info = detectPlatform();
  const root = document.documentElement;

  // Set data-platform and classes on root
  root.setAttribute("data-platform", info.type);
  root.classList.remove("platform-telegram", "platform-android", "platform-windows", "platform-tv", "platform-browser");
  root.classList.add(`platform-${info.type}`);

  if (info.isTouch) {
    root.classList.add("is-touch");
  } else {
    root.classList.add("is-pointer");
  }

  // Specialized Telegram Web App initializations
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready?.();
      tg.expand?.();
      tg.enableClosingConfirmation?.();

      // Sync header and theme colors if available
      if (tg.setHeaderColor) {
        tg.setHeaderColor("#ffffff");
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor("#fff9fa");
      }

      // Calculate dynamic Telegram viewport height variable
      const setTgViewport = () => {
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        document.documentElement.style.setProperty("--tg-viewport-height", `${h}px`);
      };

      setTgViewport();
      tg.onEvent?.("viewportChanged", setTgViewport);
    } catch {}
  }

  // Adjust viewport height variable for all browsers (iOS/Android URL bar handling)
  const setAppHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--app-vh", `${vh}px`);
  };
  setAppHeight();
  window.addEventListener("resize", setAppHeight, { passive: true });
  window.addEventListener("orientationchange", setAppHeight, { passive: true });
}
