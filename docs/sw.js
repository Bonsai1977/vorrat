// Service Worker: Die App funktioniert dadurch auch ohne Internet.
// Antwortet sofort aus dem Zwischenspeicher und holt im Hintergrund die neueste Version.
// Bei Änderungen an der App VERSION hochzählen.
const VERSION = 'vorrat-v2';
const DATEIEN = [
  './', 'index.html', 'app.css', 'manifest.webmanifest', 'vendor/zxing.min.js',
  'js/app.js', 'js/api.js', 'js/speicher.js', 'js/dialog.js', 'js/scanner.js', 'js/bearbeiten.js',
  'js/views/uebersicht.js', 'js/views/vorrat.js', 'js/views/hinzufuegen.js',
  'js/views/einkaufsliste.js', 'js/views/einstellungen.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nur eigene Dateien; Open Food Facts usw. gehen direkt ins Internet
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const gespeichert = await cache.match(e.request, { ignoreSearch: true });
      const ausDemNetz = fetch(e.request)
        .then((antwort) => {
          if (antwort.ok) cache.put(e.request, antwort.clone());
          return antwort;
        })
        .catch(() => null);
      if (gespeichert) {
        e.waitUntil(ausDemNetz);
        return gespeichert;
      }
      return (await ausDemNetz) || (await cache.match('index.html')) || Response.error();
    })
  );
});
