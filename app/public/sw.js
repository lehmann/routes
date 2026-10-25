// Service worker: app shell em network-first (fallback offline) e tiles do CARTO em cache-first
const VERSION = 'v1';
const SHELL_CACHE = `routes-shell-${VERSION}`;
const TILE_CACHE = `routes-tiles-${VERSION}`;
const TILE_HOST_SUFFIX = 'basemaps.cartocdn.com';
const MAX_TILES = 2000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.add('/').catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname.endsWith(TILE_HOST_SUFFIX)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // Refaz o request pela URL: reenviar o request de navegação faz o Chrome falhar com ERR_CACHE_MISS
    const response = await fetch(request.url);
    if (response.ok) {
      cache.put(request.url, response.clone());
      return response;
    }
  } catch {
    // sem rede: cai no cache abaixo
  }
  // Respostas não-ok (ex.: 5xx do túnel) também caem no cache, para não entregar HTML de erro a módulos JS
  const cached = await cache.match(request.url)
    ?? (request.mode === 'navigate' ? await cache.match('/') : undefined);
  return cached ?? Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trim(cache);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) {
    await cache.delete(keys[0]);
    return trim(cache);
  }
}
