const CACHE = 'expenses-v1';
const PRECACHE = [
    './',
    './index.html',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Never cache Google Apps Script API calls
    if (url.includes('script.google.com') || url.includes('exchangerate-api.com')) {
        return;
    }

    // CDN assets (Chart.js, Google Fonts): cache-first
    if (url.includes('cdn.jsdelivr.net') || url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com')) {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
                return res;
            }))
        );
        return;
    }

    // App shell (HTML): network-first, fall back to cache
    if (e.request.mode === 'navigate' || url.includes('index.html')) {
        e.respondWith(
            fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
                return res;
            }).catch(() => caches.match(e.request))
        );
        return;
    }
});
