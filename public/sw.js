// NEXT_PUBLIC_COMMIT_SHA is injected at build time via next.config.mjs env
// Falls back to "dev" for local development
const COMMIT_SHA = self.__COMMIT_SHA__ || "dev";
const CACHE_NAME = `magellain-${COMMIT_SHA}`;

// Static paths to cache on install
const STATIC_PATHS = [
  "/",
  "/home",
  "/map",
  "/weather",
  "/chat",
  "/races",
  "/performance",
  "/menu",
  "/menu/help",
  "/menu/about",
  "/offline",
  "/manifest.json",
];

// Install event: cache static paths
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PATHS);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and non-GET requests
  if (!url.origin.includes(self.location.origin) && request.method !== "GET") {
    return;
  }

  // Navigation requests: network-first, fallback to cached page or /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(request).then((response) => {
            if (response) {
              return response;
            }
            // Fall back to /offline page
            return caches.match("/offline").then((offlineResponse) => {
              return (
                offlineResponse ||
                new Response("Offline", { status: 503 })
              );
            });
          });
        })
    );
    return;
  }

  // API requests: network-first, cache successful responses, serve from cache on failure
  if (
    url.pathname.includes("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("noaa.gov") ||
    url.hostname.includes("ndbc.noaa.gov")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses (2xx status)
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return (
              response ||
              new Response(
                JSON.stringify({ error: "Network error, no cache available" }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              )
            );
          });
        })
    );
    return;
  }

  // Static assets (images, fonts, _next/static): cache-first strategy
  if (
    url.pathname.includes("/_next/static/") ||
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first, cache on success
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
