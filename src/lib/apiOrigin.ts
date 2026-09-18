/**
 * Canonical GULI API Origin Resolver.
 *
 * Source of truth hierarchy:
 * 1. import.meta.env.VITE_API_URL (explicit environment override, e.g. local dev)
 * 2. https://guli-gateway.parizodabaxtiyorov.workers.dev (Canonical Cloudflare Gateway proxy)
 *
 * Cloudflare Gateway proxies all requests upstream to Render with keep-alive & connection pooling,
 * preventing ECONNRESET and cold-start socket drops.
 */

export const CANONICAL_GATEWAY_URL = "https://guli-gateway.parizodabaxtiyorov.workers.dev";
export const LEGACY_RENDER_ORIGIN = "https://guli-lingerie-api.onrender.com";

export function getApiBaseUrl(): string {
  const envUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    const normalized = envUrl.trim().replace(/\/+$/, "");
    // Production must not silently fall back to the legacy Render origin.
    // That split-origin state is a major source of stale/CORS auth failures.
    if (!/guli-lingerie-api\.onrender\.com/i.test(normalized)) return normalized;
  }

  if (typeof window !== "undefined") {
    const winGlobal = (window as unknown as { __GULI_API_URL?: string }).__GULI_API_URL;
    if (winGlobal && typeof winGlobal === "string" && winGlobal.trim()) {
      return winGlobal.trim().replace(/\/+$/, "");
    }
  }

  return CANONICAL_GATEWAY_URL;
}

export const API_URL = getApiBaseUrl();

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
