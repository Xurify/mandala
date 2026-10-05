/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;
const SHELL = 'mandala-shell-';
const CACHE = `${SHELL}${version}`;
// The coach worker bundles the 6 MB model runtime. Only people who use Bindu should download it.
const ASSETS = [...build.filter((path) => !path.includes('/workers/')), ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			// Only previous app shells. Model weights live in IndexedDB; other caches stay.
			const hadOldCache = keys.some((key) => key.startsWith(SHELL) && key !== CACHE);
			for (const key of keys) {
				if (key.startsWith(SHELL) && key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
			if (!hadOldCache) return;
			const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of clientList) {
				client.postMessage({ type: 'mandala-updated' });
			}
		})
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.origin !== location.origin) return;

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request);
		})
	);
});
