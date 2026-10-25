// Service worker: app shell em network-first (fallback offline) e tiles do CARTO em cache-first
const VERSION = 'v2';
const SHELL_CACHE = `routes-shell-${VERSION}`;
const TILE_CACHE = `routes-tiles-${VERSION}`;
const TILE_HOST_SUFFIX = 'basemaps.cartocdn.com';
const MAX_TILES = 2000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.add('/').catch(err => console.error('[sw] install: cache.add("/") falhou', err)))
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
    event.respondWith(networkFirst(request).catch(err => {
      console.error('[sw] networkFirst lançou exceção', request.mode, request.url, err);
      return Response.error();
    }));
  } else if (url.hostname.endsWith(TILE_HOST_SUFFIX)) {
    event.respondWith(cacheFirst(request).catch(err => {
      console.error('[sw] cacheFirst lançou exceção', request.url, err);
      return Response.error();
    }));
  }
});

async function networkFirst(request) {
  const isNavigation = request.mode === 'navigate';
  try {
    // Navegação é refeita pela URL: reenviar o request de navegação faz o Chrome falhar com ERR_CACHE_MISS.
    // Os demais mantêm headers (ex.: RSC do Next, que sem eles devolve HTML no lugar do payload)
    const response = await fetch(isNavigation ? request.url : request);
    console.log('[sw] networkFirst fetch', request.mode, request.url, response.status, response.type, response.redirected);
    if (response.ok) {
      // Payload RSC não entra no cache da shell: senão o '/' offline passaria a servir RSC cru
      if (!request.headers.has('RSC')) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request.url, response.clone()).catch(err => console.error('[sw] cache.put falhou', request.url, err));
      }
      return response;
    }
    console.warn('[sw] networkFirst resposta não-ok, tentando cache', request.url, response.status);
  } catch (err) {
    console.warn('[sw] networkFirst sem rede, tentando cache', request.url, err);
  }
  // Respostas não-ok (ex.: 5xx do túnel) também caem no cache, para não entregar HTML de erro a módulos JS
  const cache = await caches.open(SHELL_CACHE).catch(() => null);
  const cached = cache && (await cache.match(request.url)
    ?? (isNavigation ? await cache.match('/') : undefined));
  return cached || Response.error();
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
  } catch (err) {
    console.error('[sw] cacheFirst fetch falhou', request.url, err);
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
