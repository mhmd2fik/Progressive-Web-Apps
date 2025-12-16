const CACHE_NAME = 'notepad-pwa-cache-v3'; // Version increment is crucial for updates!
const APP_SHELL_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
    // REMOVED: '/service-worker-register.js'
];

// 1. Installation: Pre-cache the App Shell
self.addEventListener('install', (event) => {
    console.log('[SW] Install Event: Caching App Shell');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL_ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. Activation: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate Event: Cleaning old caches');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event: Intercept all requests (Cache-First Strategy)
self.addEventListener('fetch', (event) => {
    // Strategy: Cache-First for static assets and navigations
    const isAsset = APP_SHELL_ASSETS.includes(new URL(event.request.url).pathname);
    const isNavigation = event.request.mode === 'navigate';

    if (isAsset || isNavigation) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Return the cached asset if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // If not in cache, try the network
                return fetch(event.request).catch(() => {
                    if (isNavigation) {
                        console.log('[SW] Navigation failed and no cache. Showing default fail.');
                    }
                });
            })
        );
    } 
    // Data requests (to /api/...) are handled directly by app.js/IndexedDB
});

// 4. Background Sync (Crucial for Offline Data Sync)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-notes') {
        console.log('[SW] Background Sync triggered: Attempting data synchronization...');
        event.waitUntil(syncPendingNotes()); 
    }
});

function syncPendingNotes() {
    // Helper function placeholder to communicate back to the main app logic
    return new Promise(resolve => {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'SYNC_TRIGGERED' });
            });
            resolve();
        });
    });
}