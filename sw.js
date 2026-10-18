/* packapp Service Worker: App offline starten, Wetter und Karte immer live. */
const CACHE = "packapp-v22";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "./fonts/barlow-condensed-500.woff2", "./fonts/barlow-condensed-600.woff2", "./fonts/barlow-condensed-700.woff2",
  "./fonts/source-sans-3-400.woff2", "./fonts/source-sans-3-500.woff2", "./fonts/source-sans-3-600.woff2",
  "./fonts/ibm-plex-mono-400.woff2", "./fonts/ibm-plex-mono-500.woff2"];
const CDN = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(CDN.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App-Seite: zuerst Netz (für Updates), offline aus dem Cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Statische Dateien, (auch Schriften), Leaflet und Lawinen-Regionen: zuerst Cache
  const isStatic = url.origin === self.location.origin || url.hostname === "unpkg.com" ||
    url.hostname === "regions.avalanches.org";
  if (isStatic) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      }))
    );
  }
  // Alles andere (Wetter, Wellen, Ortsnamen, Kartenkacheln) geht direkt ins Netz.
});
