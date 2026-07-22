// Service worker — โครงพื้นฐาน (ของจริงทำใน Phase 3.3)
//
// กลยุทธ์: network-first ทุกอย่าง · ใช้ cache เมื่อเน็ตล่มเท่านั้น
//
// ⚠️ อย่าเปลี่ยนกลับไปเป็น cache-first จนกว่าจะถึง Phase 3.3
//    เคยใช้ cache-first แล้วทำให้ผู้ใช้ติดโค้ดเวอร์ชันเก่าถาวร (deploy ใหม่แล้วไม่อัปเดต)
//    เพราะ cache-first จะไม่ถามเซิร์ฟเวอร์เลยถ้าเจอไฟล์ใน cache
//
// ตอนทำ 3.3 ค่อยเปลี่ยนเป็น stale-while-revalidate เพื่อความเร็วบน 4G
// แต่ต้องมีกลไกแจ้งผู้ใช้ว่า "มีเวอร์ชันใหม่ กดรีเฟรช" ควบคู่ไปด้วย

const VERSION = 'v0.5.0';
const CACHE = `te-dashboard-${VERSION}`;

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
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())          // ใช้ตัวใหม่ทันที ไม่ต้องรอปิดแท็บ
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())        // ยึดแท็บที่เปิดอยู่มาคุมทันที
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ห้ามแตะการเรียก API — ข้อมูลต้องสดเสมอ และห้ามเก็บข้อมูลลูกค้าลง cache
  if (req.url.includes('/rest/v1/') || req.url.includes('/auth/v1/')) return;

  // ⚠️ ต้องบังคับตรวจกับเซิร์ฟเวอร์ทุกครั้งสำหรับโค้ดของแอป
  //    GitHub Pages ส่ง cache-control: max-age=600 → เบราว์เซอร์เสิร์ฟไฟล์เก่าจาก HTTP cache
  //    ได้นานถึง 10 นาที ทำให้ deploy แก้บั๊กแล้วผู้ใช้ยังเจอบั๊กเดิม (เจอมาแล้ว 2 รอบ)
  //    'no-cache' = ยังใช้ ETag ตรวจ ถ้าไฟล์ไม่เปลี่ยนเซิร์ฟเวอร์ตอบ 304 (เบามาก) แต่ถ้าเปลี่ยนได้ของใหม่ทันที
  const isAppCode = /\.(js|css|html)$/.test(new URL(req.url).pathname) || req.mode === 'navigate';

  e.respondWith(
    fetch(req, isAppCode ? { cache: 'no-cache' } : undefined)
      .then(res => {
        // เก็บสำเนาไว้ใช้ตอนออฟไลน์
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // เน็ตล่ม → ใช้ของใน cache · ถ้าเป็นการเปิดหน้าเว็บก็ตกกลับไปที่ index.html
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
