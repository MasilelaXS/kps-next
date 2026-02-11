/**
 * KPS Pest Control - Service Worker
 * Handles offline caching and background sync
 * Version-aware to work with app updates
 */

// Get version from build (will be injected during build)
const APP_VERSION = '{{VERSION}}'; // Placeholder replaced during build
const CACHE_NAME = `kps-v${APP_VERSION}`;
const DATA_CACHE_NAME = `kps-data-v${APP_VERSION}`;

// Files to cache for offline use
const FILES_TO_CACHE = [
  '/',
  '/login',
  '/pco/dashboard',
  '/offline',
  '/icons/192.png',
  '/icons/512.png',
  '/manifest.json'
];

// API endpoints to cache (for offline fallback)
const CACHE_API_PATTERNS = [
  /\/api\/pco\/assignments/,
  /\/api\/pco\/clients/,
  /\/api\/chemicals/,
];

/**
 * Install event - cache static resources
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(FILES_TO_CACHE).catch((error) => {
        console.error('[ServiceWorker] Cache addAll failed:', error);
        // Don't fail the install if some files can't be cached
        return Promise.resolve();
      });
    }).then(() => {
      // Force this service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', APP_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old version caches
          if (cacheName.startsWith('kps-') && cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle version.json - always fetch fresh
  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ version: APP_VERSION }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Handle app shell
  event.respondWith(handleAppShellRequest(request));
});

/**
 * Handle API requests - network first, fallback to cache
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful GET requests for offline fallback
    if (request.method === 'GET' && response.ok) {
      const shouldCache = CACHE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
      
      if (shouldCache) {
        const cache = await caches.open(DATA_CACHE_NAME);
        cache.put(request, response.clone());
      }
    }
    
    return response;
  } catch (error) {
    // Network failed - try cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[ServiceWorker] Serving from cache:', url.pathname);
        return cachedResponse;
      }
    }
    
    // Return offline error
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Network unavailable. You are offline.',
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle app shell requests - cache first, fallback to network
 */
async function handleAppShellRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Both cache and network failed
    console.error('[ServiceWorker] Fetch failed:', error);
    
    // Return offline page if available
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Last resort - return error
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Message event - handle commands from app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting requested');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[ServiceWorker] Clear cache requested');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.filter(name => name.startsWith('kps-')).map(name => caches.delete(name))
        );
      })
    );
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});

/**
 * Background sync event - sync queued offline data
 */
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

/**
 * Sync offline queue with server
 */
async function syncOfflineQueue() {
  try {
    // This will be handled by the offlineSync.ts manager
    // Service worker just triggers the event
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_QUEUE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

console.log('[ServiceWorker] Loaded version:', APP_VERSION);
