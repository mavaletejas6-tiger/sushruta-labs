/* Virtual Patient Digital Twin — service worker (offline-first, demo).
   Strategy: cache-first for the app shell, network fallback, navigation fallback
   to index.html. Every asset is cached individually so one missing file can never
   abort the whole install (important for offline-first reliability). */
const CACHE = 'vptwin-v7';
const CORE = [
  './','./index.html','./patient.html','./doctor.html','./caregiver.html',
  './verification.html','./certificate.html',
   './privacy.html','./terms.html','./signin.html',
  './manifest.json',
   './css/style.css','./css/responsive.css','./css/print.css','./css/accessibility-fixes.css',
  './js/app.js','./js/demo-data.js','./js/storage.js','./js/sync.js','./js/risk.js',
   './js/auth.js','./js/notifications.js','./js/speech.js',
  './js/assistant.js','./js/qr.js','./js/certificate.js',
  './js/patient.js','./js/doctor.js','./js/caregiver.js','./js/clinical.js',
  './data/patients.json','./data/medicines.json','./data/visits.json',
  './data/wearable-data.json','./data/knowledge-base.json',
  // Brand: precached so the logo still renders on a cold offline start, when the
  // runtime fetch handler below never gets a chance to cache them.
  './assets/images/sushruta-labs-mark.svg',
  './assets/images/sushruta-labs-horizontal.svg',
  './assets/images/sushruta-labs-logo.svg',
  './assets/icons/icon-96.png','./assets/icons/icon-192.png',
  './assets/icons/icon-512.png','./assets/icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // add individually + swallow failures: never let one 404 break offline support
      Promise.all(CORE.map(u => c.add(u).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never intercept cross-origin calls (e.g. optional Ollama at localhost:11434).
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: false }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline — demo asset unavailable.', {
          status: 503, headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
