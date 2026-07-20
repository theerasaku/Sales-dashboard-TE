// Service worker — โครงพื้นฐาน (ของจริงทำใน Phase 3.3)
// กลยุทธ์: network-first สำหรับ navigation, cache-first สำหรับ static asset

const CACHE = 'te-dashboard-v0.1.0';

const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ห้าม cache การเรียก API
  if (req.url.includes('/rest/v1/') || req.url.includes('/auth/v1/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
