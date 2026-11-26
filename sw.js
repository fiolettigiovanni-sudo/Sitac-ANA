const CACHE_NAME = 'sitac-mappe-operative-v2';

const CORE_ASSETS = [
  './',
  './mappa.html',
  './manifest.json',
  './assets/logo-192.png',
  './css/mappa.css',
  './js/config-simboli.js',
  './js/cloud-eventi.js',
  './js/gps-meteo.js',
  './js/disegno-mappa.js'
];

// Installazione: salva in cache i file principali dell'app modulare
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Attivazione: elimina le vecchie cache (es. v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-First per dati/cloud/GeoJSON, Cache-First con aggiornamento per risorse statiche
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Chiamate dinamiche (Apps Script, Open-Meteo, WMS esterni): sempre rete con fallback cache
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('open-meteo.com') ||
    url.pathname.includes('/geojson/')
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Risorse statiche locali e simboli: Cache-First + salvataggio dinamico (es. icona symbols/sym_*.png al primo uso)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});