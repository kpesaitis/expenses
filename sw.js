const CACHE = 'expenses-v2';
const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
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

    // Never cache API calls
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

    // App shell: stale-while-revalidate — serve cache instantly, update in background
    if (e.request.mode === 'navigate' || url.includes('index.html')) {
        e.respondWith(
            caches.open(CACHE).then(cache =>
                cache.match(e.request).then(cached => {
                    const fetchPromise = fetch(e.request).then(res => {
                        cache.put(e.request, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }
});
