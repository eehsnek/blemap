const CACHE = "blemap-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "/frontend/app.html",
        "/frontend/app.css",
        "/frontend/assets/logo.jpeg",
        "/config.js",
      ])
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
