const CACHE_NAME = "app-cache-v1"; // cambiá el número si querés forzar update
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/image.png"
  // Podés agregar rutas críticas si querés precache
];

self.addEventListener("install", (event) => {
  console.log("[SW] Install new service worker");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // 👈 toma control inmediato
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker, cleaning old caches...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim(); // 👈 fuerza a los clientes a usar el nuevo
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return (
        resp ||
        fetch(event.request).then((response) => {
          return response;
        })
      );
    })
  );
});
