const CACHE_NAME = "guli-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept API, Telegram, Google, Supabase, or other cross-origin traffic.
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
