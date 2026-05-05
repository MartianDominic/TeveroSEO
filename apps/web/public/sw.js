/**
 * Service Worker for TeveroSEO Client Portal
 *
 * Caching strategy:
 * - Static assets (CSS, JS, fonts): Cache First
 * - API calls: Network First (never cache sensitive data)
 * - HTML pages: Network First with offline fallback
 *
 * Per T-90-13: Cache only static assets, never cache API responses
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `tevero-portal-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  "/portal",
  "/offline.html",
];

// Asset patterns to cache
const CACHEABLE_PATTERNS = [
  /\/_next\/static\//,
  /\.woff2?$/,
  /\.css$/,
  /\/icons\//,
];

// Patterns to never cache (API, auth)
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /\/auth\//,
  /clerk/,
];

/**
 * Install event - cache static assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        // Non-fatal: some assets may not exist yet
        console.warn("[SW] Failed to cache some static assets:", error);
      });
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("tevero-portal-") && name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

/**
 * Fetch event - handle requests with appropriate strategy
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API or auth requests (T-90-13 mitigation)
  if (NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: "Offline" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Cache-first for static assets
  if (CACHEABLE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Update cache in background
          fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful HTML responses
        if (response.ok && request.headers.get("accept")?.includes("text/html")) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Try cache, then offline page
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          // Return offline page for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/offline.html");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

/**
 * Message event - handle skip waiting
 */
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
