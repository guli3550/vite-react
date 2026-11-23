export const THEME_TRANSITION_DURATION_MS = 560;
export const REELS_TRANSITION_DURATION_MS = 540;

export type ThemeMode = "light" | "dark";

export interface SurfaceChromeColors {
  header: string;
  background: string;
  themeColor: string;
}

export const LIGHT_SURFACE_COLORS: SurfaceChromeColors = {
  header: "#ffffff",
  background: "#fff9fa",
  themeColor: "#fff9fa",
};

export const DARK_SURFACE_COLORS: SurfaceChromeColors = {
  header: "#1c1317",
  background: "#140e11",
  themeColor: "#140e11",
};

export const REELS_SURFACE_COLORS: SurfaceChromeColors = {
  header: "#000000",
  background: "#000000",
  themeColor: "#000000",
};

export interface ColorTransitionPlan {
  themeChanged: boolean;
  reelsExited: boolean;
  reelsEntered: boolean;
  needsColorTransition: boolean;
  direction: "to-dark" | "to-light" | null;
}

export function resolveSurfaceChromeColors(
  theme: ThemeMode,
  page: string,
): SurfaceChromeColors {
  if (page === "reels") return REELS_SURFACE_COLORS;
  return theme === "dark" ? DARK_SURFACE_COLORS : LIGHT_SURFACE_COLORS;
}

export function analyzeColorTransition(
  prevTheme: ThemeMode,
  nextTheme: ThemeMode,
  prevPage: string,
  nextPage: string,
): ColorTransitionPlan {
  const themeChanged = prevTheme !== nextTheme;
  const reelsExited = prevPage === "reels" && nextPage !== "reels";
  const reelsEntered = prevPage !== "reels" && nextPage === "reels";
  const needsColorTransition = themeChanged || reelsExited || reelsEntered;

  let direction: "to-dark" | "to-light" | null = null;
  if (themeChanged) {
    direction = nextTheme === "dark" ? "to-dark" : "to-light";
  } else if (reelsExited && nextTheme === "light") {
    direction = "to-light";
  } else if (reelsEntered && nextTheme === "light") {
    direction = "to-dark";
  }

  return {
    themeChanged,
    reelsExited,
    reelsEntered,
    needsColorTransition,
    direction,
  };
}

export function prefersReducedMotionEnabled(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function syncBrowserAndTelegramChrome(theme: ThemeMode, page: string): void {
  if (typeof document === "undefined") return;
  const colors = resolveSurfaceChromeColors(theme, page);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", colors.themeColor);
  }

  try {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          setHeaderColor?: (color: string) => void;
          setBackgroundColor?: (color: string) => void;
        };
      };
    }).Telegram?.WebApp;
    tg?.setHeaderColor?.(colors.header);
    tg?.setBackgroundColor?.(colors.background);
  } catch {
    // Ignore unsupported Telegram WebApp client versions
  }
}

export function flushElementStyles(el: HTMLElement): number {
  return el.offsetHeight;
}
