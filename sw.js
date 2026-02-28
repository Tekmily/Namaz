const STATIC_CACHE_NAME = "namaz-static-v1";
const RUNTIME_CACHE_NAME = "namaz-runtime-v1";

const STATIC_ASSETS = [
  "/Namaz/",
  "/Namaz/index.html",
  "/Namaz/style.css",
  "/Namaz/script.js",
  "/Namaz/tr.json",
  "/Namaz/en.json",
  "/Namaz/prayer-apis.json",
  "/Namaz/manifest.json",
  "/Namaz/icon-192.png",
  "/Namaz/icon-512.png"
];

// Kurulum - statik dosyaları cache'e al
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Yeni sürüm geldiyse eski cache'leri temizle
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== STATIC_CACHE_NAME && key !== RUNTIME_CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch stratejisi
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Sadece GET istekleri
  if (request.method !== "GET") {
    return;
  }

  // Statik dosyalar için cache first
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/Namaz/")) {
      event.respondWith(
        caches.match(request).then(cached => {
          if (cached) {
            return cached;
          }
          return fetch(request).then(response => {
            return caches.open(STATIC_CACHE_NAME).then(cache => {
              cache.put(request, response.clone());
              return response;
            });
          });
        })
      );
      return;
    }
  }

  // AlAdhan ve diğer namaz API'leri için stale-while-revalidate
  if (
    url.hostname === "api.aladhan.com" ||
    url.hostname === "api.pray.zone" ||
    url.hostname === "muslimsalat.com"
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const networkFetch = fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              return cached || Response.error();
            });

          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Diğer istekler için basit network-first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});
