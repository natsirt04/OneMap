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

const CACHE_VERSION = "onemap-ref-v1";

// Files that make up the static shell. Note: js/config.js is intentionally
// listed so the app shell works offline, but it is git-ignored, so it only
// exists locally / wherever you deploy it.
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./manifest.json",
  "./assets/icon.svg",
];

// Install: pre-cache the shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
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
