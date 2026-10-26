// Service worker: abre o app sem rede e guarda a última coleta de notícias.
const VERSION = 'mirante-v7';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/piazzolla-latin-opsz-normal.woff2', 'fonts/piazzolla-latin-ext-wght-normal.woff2',
  'fonts/schibsted-grotesk-latin-wght-normal.woff2', 'fonts/schibsted-grotesk-latin-ext-wght-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Notícias e páginas: rede primeiro, cópia salva quando não houver conexão.
  if (url.pathname.includes('/data/') || url.pathname.endsWith('version.json') || e.request.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname)) {
    // o app pede as notícias com "?t=..." para furar o cache do site; a cópia offline fica numa chave só
    const key = url.search ? new Request(url.origin + url.pathname) : e.request;
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); }
          return res;
        })
        .catch(() => caches.match(key, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }
  // Fontes e ícones: cache primeiro.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
