const CACHE_NAME = 'loklok-image-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Intercept images from /api/image, Loklok CDN, Narto CDN, or googleusercontent
  if (url.includes('/api/image') || url.includes('img.chhhn.com') || url.includes('narto-drama.com') || url.includes('netshort.com') || url.includes('googleusercontent.com') || url.includes('img-proxy') || url.endsWith('.webp') || url.endsWith('.jpg') || url.endsWith('.png')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || Response.error();
        }
      })
    );
  }
});
