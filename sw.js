/**
 * Self Growth — Service Worker
 * Enables full offline functionality
 */

const CACHE_NAME = 'self-growth-v1';

const ASSETS = [
  '/Self-Growth/',
  '/Self-Growth/index.html',
  '/Self-Growth/styles.css',
  '/Self-Growth/script.js',
  '/Self-Growth/manifest.json',
];

/* ── Install: cache all assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first strategy ── */
self.addEventListener('fetch', event => {
  // Skip non-GET or chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/Self-Growth/index.html');
        }
      });
    })
  );
});
