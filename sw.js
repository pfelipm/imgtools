const CACHE_NAME = 'imgtools-cache-v2.0.0-beta.9';
const SHARED_CACHE_KEY = './__shared-image__';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key.startsWith('imgtools-cache-') && key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.origin === self.location.origin && url.searchParams.get('share-target') === '1') {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const rawFiles = formData.getAll('image').filter((f) => f && typeof f.arrayBuffer === 'function');
                if (rawFiles.length > 0) {
                    const cache = await caches.open(CACHE_NAME);
                    const sharedKeyUrl = new URL(SHARED_CACHE_KEY, self.location.href).href;
                    const firstFile = rawFiles[0];
                    await cache.put(
                        new Request(sharedKeyUrl),
                        new Response(firstFile, {
                            headers: {
                                'Content-Type': firstFile.type || 'application/octet-stream',
                                'X-Shared-Name': encodeURIComponent(firstFile.name || 'shared-image'),
                                'X-Shared-Count': String(rawFiles.length)
                            }
                        })
                    );
                    if (rawFiles.length > 1) {
                        for (let i = 0; i < rawFiles.length; i++) {
                            const f = rawFiles[i];
                            const itemUrl = new URL(`${SHARED_CACHE_KEY}/${i}`, self.location.href).href;
                            await cache.put(
                                new Request(itemUrl),
                                new Response(f, {
                                    headers: {
                                        'Content-Type': f.type || 'application/octet-stream',
                                        'X-Shared-Name': encodeURIComponent(f.name || `shared-image-${i + 1}`)
                                    }
                                })
                            );
                        }
                    }
                }
            } catch (err) {
                // Continuar la redirección aunque la entrada compartida sea inválida
            }
            return Response.redirect(new URL('./?shared=1', self.location.href).href, 303);
        })());
        return;
    }

    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const isNavigate = event.request.mode === 'navigate';
        const cached = await cache.match(event.request, { ignoreSearch: isNavigate });
        if (cached) {
            return cached;
        }

        if (isNavigate && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
            const indexFallback = await cache.match('./index.html');
            if (indexFallback) {
                return indexFallback;
            }
        }

        try {
            const response = await fetch(event.request);
            if (response && response.status === 200 && response.type === 'basic') {
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch (err) {
            if (isNavigate) {
                const offlineShell = await cache.match('./index.html');
                if (offlineShell) {
                    return offlineShell;
                }
            }
            throw err;
        }
    })());
});
