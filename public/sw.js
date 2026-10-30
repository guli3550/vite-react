const HOME_BANNER_CACHE_NAME = "guli-home-banners-v1";
const MAX_CACHED_HOME_BANNERS = 24;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key === "guli-shell-v1").map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isGuliBannerImage(url) {
  return url.protocol === "https:" &&
    url.pathname.includes("/storage/v1/object/public/product-images/banners/");
}

async function cacheBannerImage(url, cache) {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "reload" });
    if (response.ok && (response.type === "cors" || response.type === "basic") && (response.headers.get("content-type") || "").startsWith("image/")) {
      await cache.put(url, response.clone());
      return true;
    }
  } catch (error) {
    // Keep the previous cached image if a refresh fails or the device is offline.
  }
  return false;
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "GULI_CACHE_HOME_BANNERS" || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls.filter((value) => {
    try { return isGuliBannerImage(new URL(value)); } catch { return false; }
  }))].slice(0, MAX_CACHED_HOME_BANNERS);

  event.waitUntil((async () => {
    const cache = await caches.open(HOME_BANNER_CACHE_NAME);
    const keep = new Set(urls);
    const existing = await cache.keys();
    await Promise.all(existing.filter((request) => !keep.has(request.url)).map((request) => cache.delete(request)));
    await Promise.allSettled(urls.map((url) => cacheBannerImage(url, cache)));
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache only Guli's immutable, versioned banner images on Supabase Storage.
  // Other Supabase assets, videos, API calls and third-party traffic are untouched.
  if (isGuliBannerImage(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(HOME_BANNER_CACHE_NAME);
      const cached = await cache.match(request, { ignoreVary: true });
      if (cached) {
        // Banner URLs are immutable; the fresh manifest sends new URLs when an admin replaces an image.
        return cached;
      }
      const response = await fetch(request);
      if (response.ok && (response.type === "cors" || response.type === "basic") && (response.headers.get("content-type") || "").startsWith("image/")) {
        await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  // Do not intercept API, Telegram, Google, Supabase or other cross-origin traffic.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Network-first navigation keeps the storefront current and supports offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || Response.error())
      )
    );
  }
});
