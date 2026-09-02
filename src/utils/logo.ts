import { useState, useEffect } from "react";

export const DEFAULT_LOGO = "/guli_logo.jpg";
export const LOGO_STORAGE_KEY = "guli_custom_logo";

export function getAppLogo(): string {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY) || DEFAULT_LOGO;
  } catch {
    return DEFAULT_LOGO;
  }
}

export function setAppLogo(logoUrl: string): void {
  try {
    const val = logoUrl.trim() || DEFAULT_LOGO;
    localStorage.setItem(LOGO_STORAGE_KEY, val);
    window.dispatchEvent(new CustomEvent("guli_logo_updated", { detail: val }));
    window.dispatchEvent(new Event("guli_settings_updated"));
  } catch (e) {
    console.error("Failed to save app logo:", e);
  }
}

export function useAppLogo(): string {
  const [logo, setLogo] = useState<string>(getAppLogo);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      setLogo(e?.detail || getAppLogo());
    };
    window.addEventListener("guli_logo_updated", handleUpdate);
    window.addEventListener("guli_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("guli_logo_updated", handleUpdate);
      window.removeEventListener("guli_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return logo;
}
