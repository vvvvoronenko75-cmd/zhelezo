/* Офлайн-кэш приложения «Железо».
   Стратегия: сеть в первую очередь, кэш — запасной путь. Так в зале без связи
   приложение открывается из кэша, а дома подхватывает свежую версию. */
const CACHE = 'zhelezo-v11';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  /* no-cache: тянем из сети с перепроверкой, а не из HTTP-кэша браузера (Pages держит файлы 10 минут) */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
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
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  /* Свои файлы запрашиваем с перепроверкой (ETag): иначе «сначала сеть» молча
     получает старьё из HTTP-кэша браузера и обновление не доезжает до телефона */
  const netReq = sameOrigin ? new Request(req, { cache: 'no-cache' }) : req;
  e.respondWith(
    fetch(netReq)
      .then(res => {
        /* Кладём в кэш только свои файлы: шрифты со стороннего домена не трогаем */
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
