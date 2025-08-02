const CACHE_NAME = 'zync-v1.3';
const STATIC_CACHE = 'zync-static-v1.3';
const DYNAMIC_CACHE = 'zync-dynamic-v1.3';
const SEO_CACHE = 'zync-seo-v1.3';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/humans.txt',
  '/about.html',
  '/terms.html'
];

// API endpoints to cache with network-first strategy
const CACHE_API_PATTERNS = [
  '/api/profile',
  '/api/posts',
  '/api/conversations'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    if (CACHE_API_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
      event.respondWith(networkFirstStrategy(request));
    } else {
      // Don't cache other API requests
      event.respondWith(fetch(request));
    }
    return;
  }

  // Handle static assets with cache-first strategy
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Handle other requests with network-first strategy
  event.respondWith(networkFirstStrategy(request));
});

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}