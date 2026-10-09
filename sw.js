const CACHE_NAME = "workout-plan-v10";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// Install — cache each file individually so one missing file can't break the install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        APP_FILES.map(f => cache.add(f).catch(() => console.warn("SW: could not cache", f)))
      ))
      .then(() => self.skipWaiting())
  );
});

// Activate — remove old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== "workout-fonts").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const host = new URL(req.url).hostname;

  // Google Fonts: cache so the typography also works offline
  if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com") {
    event.respondWith(
      caches.open("workout-fonts").then(c => c.match(req).then(hit => {
        const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }
  if (host !== location.hostname) return;

  // Pages: network first (so updates show up), fall back to cache when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else: cache first, then network (and remember it)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
