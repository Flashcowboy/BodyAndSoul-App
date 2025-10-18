// Minimal, safe service worker: precache shell, runtime cache for static assets.
const CACHE_VERSION = 'v1.0.1';
const PRECACHE = `precache-${CACHE_VERSION}`;
const RUNTIME = `runtime-${CACHE_VERSION}`;

// Keep the precache list small: UI shell only (no audio files)
const PRECACHE_URLS = [
	'/',
	'/index.html',
	'/styles.css',
	'/main.js',
	'/firebase-config.js',
	'/manifest.json',
	'/assets/images/logo_192.png',
	'/assets/images/logo_512.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	const currentCaches = [PRECACHE, RUNTIME];
	event.waitUntil(
		caches.keys().then((cacheNames) =>
			Promise.all(
				cacheNames.map((cacheName) => {
					if (!currentCaches.includes(cacheName)) {
						return caches.delete(cacheName);
					}
				})
			)
		).then(() => self.clients.claim())
	);
});

function shouldBypass(request) {
	const url = new URL(request.url);
	// Bypass: Firestore, Firebase, audio media, range requests
	if (/firebase(?:io)?\.com|gstatic\.com|googleapis\.com/.test(url.hostname)) return true;
	if (url.pathname.startsWith('/assets/audio/')) return true;
	if (request.headers.get('range')) return true;
	return false;
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET' || shouldBypass(request)) return;

	// Network-first for HTML; Cache-first for static assets
	if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(RUNTIME).then((cache) => cache.put(request, copy));
					return response;
				})
				.catch(() => caches.match(request))
		);
		return;
	}

	// Cache-first with stale-while-revalidate for images/css/js
	if (['image', 'style', 'script', 'font'].includes(request.destination)) {
		event.respondWith(
			caches.match(request).then((cached) => {
				const fetchPromise = fetch(request)
					.then((response) => {
						const copy = response.clone();
						caches.open(RUNTIME).then((cache) => cache.put(request, copy));
						return response;
					})
					.catch(() => cached);
				return cached || fetchPromise;
			})
		);
	}
});

