// RadioFR service worker — app-shell offline support only.
//
// Scope, deliberately narrow: this must NEVER intercept audio/video stream
// requests (byte-range requests for a live/seekable media element behave
// badly through the Cache API and a single dropped/garbled response would
// break playback — the one thing this app can't afford to regress). It only
// makes the app itself (HTML/JS/CSS/icons) load when there's no connection,
// so a user who opens the PWA offline sees the real UI (Favoris, Radio tab,
// Configuration) instead of the browser's own "no internet" page.
const CACHE_NAME = "radiofr-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

function isStreamish(request, url) {
  if (request.headers.has("range")) return true; // byte-range = media seeking
  if (request.destination === "audio" || request.destination === "video") return true;
  // Our own API routes are always dynamic (search results, proxied audio) —
  // never cache them, always hit the network.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never touch POST/etc.

  const url = new URL(request.url);
  if (isStreamish(request, url)) return; // let the browser handle it natively

  const sameOrigin = url.origin === self.location.origin;

  // Navigations (the app shell itself): network-first, falling back to
  // whatever was last cached so the app still opens with no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Same-origin static build output / public assets: cache-first (they're
  // either content-hashed or genuinely static), refreshed in the background.
  if (sameOrigin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/textures/") ||
      /\.(png|jpg|jpeg|svg|ico|webmanifest|json|woff2?)$/i.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Station/podcast artwork on other hosts (Google favicons, radio-browser
  // logo store, etc.): cache-first too, so Favoris still shows real logos
  // offline instead of broken images — opaque cross-origin responses are
  // fine to cache, they just can't be inspected.
  if (!sameOrigin && request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // Everything else (other API calls, cross-origin scripts…): default
  // network behavior, no interception.
});
