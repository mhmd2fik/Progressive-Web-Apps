// Service Worker - Advanced Caching Strategy
// Implements: Cache-first, Network-first, and Stale-While-Revalidate strategies

const CACHE_VERSION = 'v1';
const CACHE_NAME = `notepad-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notepad-runtime-${CACHE_VERSION}`;
const API_CACHE = `notepad-api-${CACHE_VERSION}`;

const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/service-worker-register.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ============== Installation ==============
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching essential files');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// ============== Activation ==============
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== RUNTIME_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ============== Fetch Event ==============
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // API requests - Network first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // HTML documents - Network first
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets - Cache first
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // Default - Stale while revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
});

// ============== Caching Strategies ==============

/**
 * Cache First Strategy
 * Good for: Static assets, images, fonts
 */
async function cacheFirstStrategy(request) {
    try {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);

        if (cached) {
            return cached;
        }

        const response = await fetch(request);
        
        if (response.ok) {
            const cloned = response.clone();
            cache.put(request, cloned);
        }

        return response;
    } catch (error) {
        console.error('Cache first strategy failed:', error);
        return createOfflineResponse();
    }
}

/**
 * Network First Strategy
 * Good for: API calls, HTML documents, fresh content
 */
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);

        if (response.ok) {
            // Cache successful responses
            const cache = await caches.open(API_CACHE);
            const cloned = response.clone();
            cache.put(request, cloned);
            return response;
        }

        // If response not ok, try cache
        const cache = await caches.open(API_CACHE);
        return cache.match(request) || createOfflineResponse();

    } catch (error) {
        console.error('Network request failed:', error);
        
        // Try cache as fallback
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }

        return createOfflineResponse();
    }
}

/**
 * Stale While Revalidate Strategy
 * Good for: Generally good performance
 */
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                const cloned = response.clone();
                cache.put(request, cloned);
            }
            return response;
        })
        .catch(() => createOfflineResponse());

    return cached || fetchPromise;
}

// ============== Utility Functions ==============

function isStaticAsset(url) {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function createOfflineResponse() {
    return new Response(
        `<!DOCTYPE html>
         <html>
         <head>
             <title>Offline</title>
             <style>
                 body { font-family: Arial; text-align: center; padding: 50px; }
                 h1 { color: #666; }
             </style>
         </head>
         <body>
             <h1>📴 You're Offline</h1>
             <p>This app works offline! Your notes are safely stored locally.</p>
             <p>Reconnect to sync your changes.</p>
         </body>
         </html>`,
        {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
                'Content-Type': 'text/html; charset=UTF-8'
            })
        }
    );
}

// ============== Background Sync (for future enhancement) ==============
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notes') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SYNC_REQUEST',
                        payload: {}
                    });
                });
            })
        );
    }
});

// ============== Push Notifications (for future enhancement) ==============
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || 'New update available',
        icon: '/images/icon.png',
        badge: '/images/badge.png'
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'NotePad', options)
    );
});

console.log('Service Worker loaded and ready');
