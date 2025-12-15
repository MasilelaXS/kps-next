
// Service Worker for KPS Pest Control System
// Production-Ready Offline Support
// 
// Version is now controlled by the server via `/api/version`.
// The service worker will fetch the version during install/activation
// and derive cache names dynamically. This removes the need to
// manually update a version constant inside this file.

let APP_VERSION = 'dev';
let CACHE_NAME = `kps-cache-${APP_VERSION}`;
let RUNTIME_CACHE = `kps-runtime-${APP_VERSION}`;
let STATIC_CACHE = `kps-static-${APP_VERSION}`;

// Critical pages to precache on install
// Service worker will cache all _next/static/* chunks automatically as they're requested
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/pco/dashboard',
  '/pco/schedule',
  '/pco/report/new',
  '/pco/report/bait-inspection',
  '/pco/report/fumigation',
  '/pco/report/signature',
  '/pco/report/submit',
  '/admin/dashboard',
  '/manifest.json',
  '/icons/192.png',
  '/icons/512.png'
];

// Helper to fetch version from server
const fetchAppVersion = async () => {
  try {
    const resp = await fetch('/api/version');
    if (!resp.ok) return 'dev';
    const json = await resp.json();
    return json.version || 'dev';
  } catch (err) {
    console.error('[SW] Failed to fetch app version:', err);
    return 'dev';
  }
};

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil((async () => {
    try {
      // Fetch current version from server
      const version = await fetchAppVersion();
      APP_VERSION = version;
      CACHE_NAME = `kps-cache-${APP_VERSION}`;
      RUNTIME_CACHE = `kps-runtime-${APP_VERSION}`;
      STATIC_CACHE = `kps-static-${APP_VERSION}`;
      console.log('[SW] Using app version:', APP_VERSION);

      const cache = await caches.open(CACHE_NAME);
      console.log('[SW] Opened cache:', CACHE_NAME);
      
      // Precache assets one by one to see which ones fail
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
          console.log('[SW] Cached:', asset);
        } catch (err) {
          console.warn('[SW] Failed to cache:', asset, err);
        }
      }
      
      console.log('[SW] Precaching complete');
      await self.skipWaiting();
      console.log('[SW] Service worker activated');
    } catch (err) {
      console.error('[SW] Install failed:', err);
    }
  })());
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil((async () => {
    // Re-fetch version to be safe
    const version = await fetchAppVersion();
    APP_VERSION = version;
    const currentCaches = [`kps-cache-${APP_VERSION}`, `kps-runtime-${APP_VERSION}`, `kps-static-${APP_VERSION}`];

    // Delete ALL old caches - aggressive cleanup
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => {
      if (!currentCaches.includes(name)) {
        console.log('[SW] Deleting old cache:', name);
        return caches.delete(name);
      }
    }));
    
    // Force reload all clients to get fresh pages
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      console.log('[SW] Reloading client:', client.url);
      client.navigate(client.url);
    });
    
    console.log('[SW] Service worker activated and claiming clients');
    return self.clients.claim();
  })());
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (except for API calls to our backend)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Strategy 1: API Requests - Network First, Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    // Don't cache POST/PUT/DELETE requests (report submissions)
    if (request.method !== 'GET') {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET requests
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] API cache hit:', request.url);
              return cachedResponse;
            }
            // No cache available
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Offline - no cached data available',
                offline: true 
              }),
              { 
                headers: { 'Content-Type': 'application/json' },
                status: 503
              }
            );
          });
        })
    );
    return;
  }

  // Strategy 2: Navigation Requests - Network First, Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Cache successful pages
        if (response.status === 200) {
          console.log('[SW] Caching navigation page:', request.url);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline - serve from cache
        console.log('[SW] Network failed for navigation, trying cache:', request.url);
        
        // Try to find the page in any version of the cache
        const cacheNames = await caches.keys();
        const pageCaches = cacheNames.filter(name => name.startsWith('kps-cache-'));
        
        for (const cacheName of pageCaches) {
          const cache = await caches.open(cacheName);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            console.log('[SW] ✓ Page served from cache:', request.url);
            return cachedResponse;
          }
        }
        
        console.warn('[SW] ✗ Page not in cache:', request.url);
        // Fallback to root page from any cache
        for (const cacheName of pageCaches) {
          const cache = await caches.open(cacheName);
          const rootPage = await cache.match('/');
          if (rootPage) {
            console.log('[SW] ✓ Serving root page as fallback');
            return rootPage;
          }
        }
        
        console.error('[SW] ✗ No pages cached, showing offline message');
        return new Response('Offline - please visit the app online first', {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    })());
    return;
  }

  // Strategy 3: Next.js Static Assets (_next/static/*) - Cache First, Aggressive Caching
  // These files are versioned by Next.js, so we can cache them permanently until app version changes
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith((async () => {
      // Try all possible cache versions to find the chunk
      const cacheNames = await caches.keys();
      const staticCaches = cacheNames.filter(name => name.startsWith('kps-static-'));
      
      // Check all static caches for the chunk
      for (const cacheName of staticCaches) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          console.log('[SW] ✓ Chunk served from cache:', url.pathname.split('/').pop());
          return cachedResponse;
        }
      }

      // Not in any cache - try network
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.status === 200) {
          // Cache in the current version's cache
          const currentCache = await caches.open(STATIC_CACHE);
          await currentCache.put(request, networkResponse.clone());
          console.log('[SW] ✓ Cached chunk from network:', url.pathname.split('/').pop());
        }
        return networkResponse;
      } catch (err) {
        // Network failed and not in cache
        console.error('[SW] ✗ Chunk not available offline:', url.pathname.split('/').pop());
        return new Response('', { status: 404 });
      }
    })());
    return;
  }

  // Strategy 3b: Next.js Data (_next/data/*) - Network First
  if (url.pathname.includes('/_next/data/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Strategy 4: Other Static Assets - Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((response) => {
        if (response.status === 200 && 
            (request.destination === 'style' || 
             request.destination === 'script' || 
             request.destination === 'image' ||
             request.destination === 'font')) {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        console.log('[SW] Asset not available offline:', request.url);
        return new Response('', { status: 404 });
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'KPS Notification',
    body: 'You have a new notification',
    icon: '/icons/192.png',
    badge: '/icons/192.png',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || {},
        tag: payload.data?.type || 'notification',
        requireInteraction: false,
        vibrate: [200, 100, 200]
      };
    } catch (error) {
      console.error('[SW] Error parsing push notification:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      vibrate: notificationData.vibrate
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Navigate to appropriate page based on notification type
  if (data.type === 'assignment') {
    targetUrl = '/pco/schedule';
  } else if (data.type === 'report_declined') {
    targetUrl = '/pco/dashboard';
  } else if (data.type === 'report_submitted') {
    targetUrl = '/admin/reports';
  } else if (data.type === 'system_update') {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
