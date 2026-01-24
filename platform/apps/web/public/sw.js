const VERSION = "campreserv-pwa-v2";
const PRECACHE_URLS = [
  "/",
  "/pwa/offline",
  "/pwa/guest",
  "/pwa/staff",
  "/pwa/sync-log",
  "/pwa/notifications",
  "/portal/store",
  "/portal/activities",
  "/manifest.webmanifest",
  "/pwa/pwa.css",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Runtime cache allowlist prefixes
const RUNTIME_CACHE_URL_PATTERNS = [
  "/api/sites/status",
  "/api/pricing",
  "/api/availability",
  "/api/ota",
  "/api/public-availability",
  "/api/kiosk",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(async () => {
        await self.clients.claim();
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((client) => client.postMessage({ type: "SW_ACTIVATED", version: VERSION }));
      }),
  );
});

const sameOrigin = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === self.location.origin;
  } catch {
    return false;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;
  if (request.method !== "GET") return;

  // HTML/navigation: network-first, fallback to offline page or cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/pwa/offline");
        }),
    );
    return;
  }

  // Same-origin static assets: cache-first.
  if (
    sameOrigin(url) &&
    (request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "image" ||
      request.destination === "font")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return res;
        });
      }),
    );
    return;
  }

  // Same-origin GET API calls: network-first with cache fallback, scoped to known runtime patterns.
  if (
    sameOrigin(url) &&
    url.includes("/api/") &&
    RUNTIME_CACHE_URL_PATTERNS.some((p) => url.includes(p))
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting().then(() => {
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage("SKIP_WAITING_ACK"));
      });
    });
  }
  if (event.data?.type === "TRIGGER_SYNC") {
    self.registration.sync?.register("sync-queues").catch(() => {});
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-queues") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_QUEUES" }));
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() || {};
    } catch {
      return { title: event.data?.text() || "Notification", body: "" };
    }
  })();
  const title = data.title || "Campreserv";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data.data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
