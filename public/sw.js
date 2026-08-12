const CACHE_NAME = 'wox-stream-cache-v24';
const STATIC_ASSETS = [
  '/',
  '/style.css',
  '/favicon.svg',
  '/favicon.png',
  '/wox_logo.svg',
  '/wox_logo.jpg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Static Assets & App Shell: Stale-While-Revalidate
  if (
    url.includes('/style.css') ||
    url.includes('/favicon.') ||
    url.includes('/wox_logo.') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 2. Poster Images: Cache-First with Network Fallback
  if (
    url.includes('/api/image') ||
    url.includes('img.chhhn.com') ||
    url.includes('narto-drama.com') ||
    url.includes('netshort.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('img-proxy') ||
    url.endsWith('.webp') ||
    url.endsWith('.jpg') ||
    url.endsWith('.png')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        } catch (_) {
          return cached || new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="100%" height="100%" fill="#0a0a0f"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      })
    );
    return;
  }
});
