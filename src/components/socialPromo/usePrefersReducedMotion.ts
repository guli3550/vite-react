import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/** Live value of the OS-level "reduce motion" preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    onChange();
    try {
      mql.addEventListener("change", onChange);
    } catch {
      // Very old WebViews: the preference is simply read once.
    }
    return () => {
      try {
        mql.removeEventListener("change", onChange);
      } catch {
        // ignore
      }
    };
  }, []);

  return reduced;
}
