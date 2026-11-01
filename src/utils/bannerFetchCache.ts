/**
 * Home hero-banner cache (stale-while-revalidate).
 *
 * Problem this solves
 * -------------------
 * The storefront used to call GET /api/banners with `cache: "no-store"` on every
 * open, so on a slow connection the hero area stayed empty until the API answered,
 * every slide image was fetched again, and a failed request wiped the banners.
 *
 * How it works
 * ------------
 * 1. The last good manifest is kept in localStorage. On the next open the hero
 *    renders from it immediately (no network wait) and the first image is
 *    preloaded before React even mounts.
 * 2. In the background we revalidate with `cache: "no-cache"`: the browser sends
 *    If-None-Match and the server answers 304 when nothing changed (a few bytes).
 * 3. If the admin changed anything the manifest differs, so we store it, warm the
 *    new images and fire the existing `guli_banners_updated` event; the app then
 *    re-reads the manifest and the hero updates without a reload.
 * 4. Banner uploads are stored as -400/-800/-1600 WebP variants. We pick the
 *    variant that fits the screen and connection instead of always shipping 1600px.
 *
 * Requests carrying `?fresh=1` (used by the admin panel) always bypass the cache.
 */

const CACHE_KEY = "guli_home_banners_v1";
const UPDATED_EVENT = "guli_banners_updated";
const CHECK_INTERVAL_MS = 20_000;
const FETCH_TIMEOUT_MS = 25_000;
const BANNER_PATH = /\/api\/banners\/?$/;
const VARIANT_RE = /^(https?:\/\/[^?#]*\/banners\/[^?#]*?)-(?:400|800|1600)\.webp(\?[^#]*)?$/i;

type CacheEntry = { body: string; savedAt: number };
type ConnectionInfo = { saveData?: boolean; effectiveType?: string };
type BannerPayload = { success?: unknown; data?: unknown };
type BannerRow = Record<string, unknown>;

let rawFetch: typeof fetch | null = null;
let installed = false;
let knownUrl = "";
let lastCheck = 0;
let inflight: Promise<boolean> | null = null;
let memoryEntry: CacheEntry | null = null;

const warmed = new Set<string>();
const pinned: HTMLImageElement[] = [];

function parsePayload(body: string): BannerPayload | null {
  try {
    const json = JSON.parse(body) as BannerPayload | null;
    if (json && json.success === true && Array.isArray(json.data)) return json;
  } catch {
    /* not JSON */
  }
  return null;
}

function readEntry(): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry = JSON.parse(raw) as Partial<CacheEntry> | null;
      if (entry && typeof entry.body === "string" && parsePayload(entry.body)) {
        return { body: entry.body, savedAt: Number(entry.savedAt) || 0 };
      }
    }
  } catch {
    /* storage unavailable or corrupted: fall back to memory */
  }
  return memoryEntry;
}

function writeEntry(body: string): void {
  memoryEntry = { body, savedAt: Date.now() };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(memoryEntry));
  } catch {
    /* private mode / quota: memory copy is still used for this session */
  }
}

function connectionInfo(): ConnectionInfo {
  const nav = navigator as Navigator & { connection?: ConnectionInfo };
  return nav.connection || {};
}

function isVerySlow(): boolean {
  const c = connectionInfo();
  return c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

function preferredWidth(): number {
  const c = connectionInfo();
  const cssWidth = Math.max(window.innerWidth || 0, 320);
  let target = cssWidth * Math.min(window.devicePixelRatio || 1, 2);
  if (isVerySlow()) target = Math.min(target, 400);
  else if (c.effectiveType === "3g") target = Math.min(target, 800);
  if (target <= 400) return 400;
  if (target <= 800) return 800;
  return 1600;
}

/** Rewrites banner image URLs to the best-fitting uploaded variant for this device. */
function forDevice(body: string): string {
  const payload = parsePayload(body);
  if (!payload) return body;
  const width = preferredWidth();
  const data = (payload.data as BannerRow[]).map((item) => {
    const url = item && typeof item.imageUrl === "string" ? item.imageUrl : "";
    const match = VARIANT_RE.exec(url);
    return match ? { ...item, imageUrl: `${match[1]}-${width}.webp${match[2] || ""}` } : item;
  });
  return JSON.stringify({ ...payload, data });
}

function addLink(rel: string, href: string, attrs: Record<string, string> = {}): HTMLLinkElement | null {
  if (!document.head) return null;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  for (const [key, value] of Object.entries(attrs)) link.setAttribute(key, value);
  document.head.appendChild(link);
  return link;
}

function whenIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(task, { timeout: 4000 });
  else window.setTimeout(task, 1500);
}

/** Preloads the first slide at high priority, then the remaining slides when idle. */
function warmImages(body: string): void {
  const payload = parsePayload(forDevice(body));
  if (!payload) return;
  const urls = (payload.data as BannerRow[])
    .filter((row) => row && row.active !== false && typeof row.imageUrl === "string" && row.imageUrl)
    .map((row) => String(row.imageUrl));
  const first = urls[0];
  if (!first) return;
  const rest = urls.slice(1);

  const loadRest = () => {
    for (const url of rest) {
      if (warmed.has(url)) continue;
      warmed.add(url);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      pinned.push(img);
    }
    if (pinned.length > 12) pinned.splice(0, pinned.length - 12);
  };

  if (isVerySlow()) {
    // Data saver / 2G: only the first slide is worth the bytes.
    if (!warmed.has(first)) {
      warmed.add(first);
      addLink("preload", first, { as: "image", fetchpriority: "high" });
    }
    return;
  }

  if (warmed.has(first)) {
    whenIdle(loadRest);
    return;
  }
  warmed.add(first);
  try {
    const origin = new URL(first, window.location.href).origin;
    if (origin !== window.location.origin) addLink("preconnect", origin);
  } catch {
    /* malformed URL: skip preconnect */
  }
  const link = addLink("preload", first, { as: "image", fetchpriority: "high" });
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    whenIdle(loadRest);
  };
  if (link) {
    link.addEventListener("load", go);
    link.addEventListener("error", go);
  }
  window.setTimeout(go, 6000);
}

function notifyIfChanged(changed: boolean): void {
  if (changed) window.dispatchEvent(new Event(UPDATED_EVENT));
}

/** Background revalidation. Resolves true when the manifest actually changed. */
function revalidate(url: string, force: boolean): Promise<boolean> {
  const doFetch = rawFetch;
  if (!doFetch) return Promise.resolve(false);
  if (inflight) return inflight;
  if (!force && Date.now() - lastCheck < CHECK_INTERVAL_MS) return Promise.resolve(false);
  lastCheck = Date.now();

  const task = (async () => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : 0;
    try {
      const res = await doFetch(url, {
        cache: "no-cache",
        headers: { Accept: "application/json" },
        signal: controller ? controller.signal : undefined,
      });
      if (!res.ok) return false;
      const body = await res.text();
      if (!parsePayload(body)) return false;
      const previous = readEntry();
      if (previous && previous.body === body) return false;
      writeEntry(body);
      warmImages(body);
      return true;
    } catch {
      return false;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  })();

  inflight = task;
  void task.then(() => {
    if (inflight === task) inflight = null;
  });
  return task;
}

function resolveBannerUrl(input: RequestInfo | URL, init?: RequestInit): string | null {
  try {
    const method = String(
      (init && init.method) || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET"),
    ).toUpperCase();
    if (method !== "GET") return null;
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!BANNER_PATH.test(url.pathname) || url.searchParams.has("fresh")) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function jsonResponse(body: string): Response {
  return new Response(forDevice(body), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Installs the cache in front of window.fetch. Call once, before the first render
 * and before any other code wraps window.fetch.
 */
export function installBannerFetchCache(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const passThrough = window.fetch.bind(window);
  rawFetch = passThrough;

  const cached = readEntry();
  if (cached) warmImages(cached.body);

  const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target = resolveBannerUrl(input, init);
    if (!target) return passThrough(input, init);
    knownUrl = target;

    const entry = readEntry();
    if (entry) {
      void revalidate(target, false).then(notifyIfChanged);
      return Promise.resolve(jsonResponse(entry.body));
    }

    // First visit (nothing cached yet): go to the network once and remember the result.
    return passThrough(target, { cache: "no-cache", headers: { Accept: "application/json" } }).then(async (res) => {
      if (!res.ok) return res;
      const body = await res.clone().text();
      if (!parsePayload(body)) return res;
      writeEntry(body);
      lastCheck = Date.now();
      warmImages(body);
      return jsonResponse(body);
    });
  };

  try {
    window.fetch = wrapped;
  } catch {
    installed = false;
    rawFetch = null;
    return;
  }

  const recheck = () => {
    if (knownUrl) void revalidate(knownUrl, false).then(notifyIfChanged);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recheck();
  });
  window.addEventListener("online", recheck);
}

/** Called by the admin panel after a successful save so this device updates at once. */
export function refreshHomeBanners(apiBase: string): Promise<void> {
  const base = String(apiBase || "").replace(/\/+$/, "");
  const url = `${base}/api/banners`;
  if (!knownUrl) knownUrl = url;
  return revalidate(url, true).then(notifyIfChanged);
}
