// NEXT_PUBLIC_COMMIT_SHA is injected at build time via next.config.mjs env
const COMMIT_SHA = self.__COMMIT_SHA__ || "dev";
const CACHE_NAME = `magellain-${COMMIT_SHA}`;

const STATIC_PATHS = [
  "/",
  "/home",
  "/map",
  "/weather",
  "/chat",
  "/races",
  "/races/import",
  "/route-planner",
  "/performance",
  "/menu",
  "/menu/help",
  "/menu/about",
  "/offline",
  "/manifest.json",
];

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS))
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Push Notification Handler ──────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "MagellAIn", body: "New notification", url: "/home" };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    // If not JSON, use text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "magellain-notification",
    requireInteraction: data.requireInteraction || false,
    data: { url: data.url || "/home" },
    actions: [
      { action: "view", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/home";

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// ─── Fetch Strategies ───────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.origin.includes(self.location.origin) && request.method !== "GET") return;

  // Navigation: network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) =>
          r || caches.match("/offline").then((o) => o || new Response("Offline", { status: 503 }))
        )
      )
    );
    return;
  }

  // API / external data: network-first, cache on success
  if (
    url.pathname.includes("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("noaa.gov") ||
    url.hostname.includes("ndbc.noaa.gov")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (r) =>
              r || new Response(JSON.stringify({ error: "Offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.includes("/_next/static/") ||
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (r) =>
          r ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
