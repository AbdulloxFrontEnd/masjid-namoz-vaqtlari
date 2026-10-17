const CACHE_NAME = 'masjid-namoz-v18-darkfix';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './css/style.css',
  './css/leaflet.css',
  './css/MarkerCluster.css',
  './css/MarkerCluster.Default.css',
  './js/leaflet.js',
  './js/leaflet.markercluster.js',
  './js/app.js',
  './data/masjidlar.json',
  './data/imomlar.json',
  './icons/mosque_pin.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // CRITICAL PERFORMANCE FIX: Never intercept or write external map tiles to disk CacheStorage during map pan!
  // Let the browser's native C++ HTTP memory cache handle map tiles at 144 FPS.
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-First strategy for same-origin app files (always fresh online, works 100% offline)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

