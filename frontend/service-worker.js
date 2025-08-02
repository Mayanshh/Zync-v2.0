// Zync Service Worker for Push Notifications
const CACHE_NAME = 'zync-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/app.js',
  '/icons/icon-192x192.png'
];

// Install event
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Push event
self.addEventListener('push', function(event) {
  const options = {
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      options.body = payload.body || payload.message || options.body;
      options.title = payload.title || 'Zync';
      options.data = payload.data || options.data;
    } catch (e) {
      options.body = event.data.text() || options.body;
      options.title = 'Zync';
    }
  }

  event.waitUntil(
    self.registration.showNotification(options.title || 'Zync', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});