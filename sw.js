/* =========================================================================
   sw.js — minimal service worker (makes the app an installable PWA)
   -------------------------------------------------------------------------
   Strategy:
     - Pre-cache the app "shell" (HTML/CSS/JS/icon) so it opens offline.
     - For navigation/app files: network-first, falling back to cache. This
       avoids serving a stale page after you edit the code.
     - We intentionally DO NOT cache OneMap tiles or API calls — those need
       to be live, and tiles would bloat the cache quickly.

   Bump CACHE_VERSION whenever you change the shell files to force an update.
   ========================================================================= */

const CACHE_VERSION = "onemap-ref-v2";

// Files that make up the static shell. js/config.js is optional: it only
// exists when you use the local token fallback, so we cache it best-effort
// (allSettled) instead of failing the whole install when it is absent.
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/token.js",
  "./js/app.js",
  "./js/config.js",
  "./manifest.json",
  "./assets/icon.svg",
];

// Install: pre-cache the shell. allSettled so a missing optional file (e.g.
// config.js on a serverless deploy) doesn't abort the install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
  );
  self.skipWaiting();
});

// Activate: delete old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Fetch: only handle our own same-origin GET requests. Everything else
// (OneMap tiles + APIs on www.onemap.gov.sg) goes straight to the network.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // let the browser handle cross-origin (OneMap) requests normally
  }

  // Never cache the token endpoint — bearer tokens must always be live.
  if (url.pathname.startsWith("/api/")) {
    return; // network-only passthrough
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update the cache copy in the background.
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline fallback
  );
});
