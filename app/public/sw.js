// Service worker: navegação em network-first (com o '/' em cache como fallback offline),
// assets do Next em /_next/static (nomes com hash, cache-first) e tiles do CARTO em cache-first.
// Todo o resto (RSC, /api/plan, este próprio arquivo) segue direto para a rede.
const VERSION = 'v4';
const PAGE_CACHE = `routes-pages-${VERSION}`;
const ASSET_CACHE = `routes-assets-${VERSION}`;
const TILE_CACHE = `routes-tiles-${VERSION}`;
const CURRENT_CACHES = [PAGE_CACHE, ASSET_CACHE, TILE_CACHE];
const TILE_HOST_SUFFIX = 'basemaps.cartocdn.com';
const MAX_TILES = 2000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGE_CACHE)
      .then(cache => cache.add('/'))
      .catch(err => console.error('[sw] install: não foi possível pré-cachear "/"', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !CURRENT_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(navigate(request));
    } else if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request.url, ASSET_CACHE));
    }
  } else if (url.hostname.endsWith(TILE_HOST_SUFFIX)) {
    event.respondWith(cacheFirst(request.url, TILE_CACHE));
  }
});

async function navigate(request) {
  try {
    const response = await fetch(request.url);
    if (response.ok) {
      // O app tem uma única página, então só o '/' é guardado para uso offline.
      // O clone é feito agora: depois que a resposta é devolvida, o body já não pode ser clonado
      const copy = response.clone();
      caches.open(PAGE_CACHE).then(cache => cache.put('/', copy))
        .catch(err => console.error('[sw] cache da página falhou', err));
    }
    return response;
  } catch (err) {
    console.warn('[sw] navegação sem rede, usando "/" em cache', err);
    return (await caches.match('/', { cacheName: PAGE_CACHE })) || Response.error();
  }
}

async function cacheFirst(url, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url);
    if (cached) return cached;

    const response = await fetch(url);
    // Nunca guarda HTML sob uma URL de asset: um script que receba HTML falha com "strict MIME type"
    const isHtml = (response.headers.get('content-type') || '').includes('text/html');
    if (response.ok && !isHtml) {
      cache.put(url, response.clone()).catch(err => console.error('[sw] cache.put falhou', url, err));
      if (cacheName === TILE_CACHE) trim(cache);
    }
    return response;
  } catch (err) {
    console.error('[sw] cache-first falhou', url, err);
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
