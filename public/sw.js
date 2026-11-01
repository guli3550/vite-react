const CACHE_NAME = "guli-shell-v1";
// Banner and product pictures are uploaded once under unique file names with a
// one-year cache lifetime, so a cache-first copy can never be stale.
const IMAGE_CACHE = "guli-images-v1";
const IMAGE_CACHE_LIMIT = 120;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.indexOf("guli-images-") === 0 && name !== IMAGE_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

function isStorageImage(request, url) {
  return (
    request.destination === "image" &&
    /\.supabase\.(co|in)$/i.test(url.hostname) &&
    url.pathname.indexOf("/storage/v1/object/public/") === 0
  );
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  const extra = keys.length - IMAGE_CACHE_LIMIT;
  for (let i = 0; i < extra; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function cacheFirstImage(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const hit = await cache.match(request.url);
    if (hit) return hit;

    // A CORS request lets us see the status, so an error page is never cached.
    const response = await fetch(request.url, { mode: "cors", credentials: "omit" });
    if (response && response.ok) {
      await cache.put(request.url, response.clone());
      trimImageCache(cache).catch(() => {});
    }
    return response;
  } catch (error) {
    // Cache unavailable or CORS refused: behave exactly like a normal image request.
    return fetch(request);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isStorageImage(request, url)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // Do not intercept API, Telegram, Google, or other cross-origin traffic.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first navigation keeps the storefront current while satisfying
  // the service-worker requirement used by PWA/TWA installability checks.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || Response.error())
      )
    );
  }
});
