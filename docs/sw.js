// Service worker (step 3.3 — F8 PWA)
//
// กลยุทธ์: network-first ทุกอย่าง · ใช้ cache เมื่อเน็ตล่มเท่านั้น
//
// ⚠️ ห้ามเปลี่ยนเป็น cache-first เด็ดขาด
//    เคยใช้ cache-first แล้วผู้ใช้ติดโค้ดเวอร์ชันเก่าถาวร (deploy ใหม่แล้วหน้าไม่เปลี่ยน)
//    เพราะ cache-first จะไม่ถามเซิร์ฟเวอร์เลยถ้าเจอไฟล์ใน cache
//    ระบบนี้เป็นเครื่องมือทำงาน ไม่ใช่เว็บอ่านข่าว — ข้อมูลผิดเพราะโค้ดเก่าแพงกว่าโหลดช้า 200ms
//
// สิ่งที่ cache มีไว้ทำอย่างเดียว: เปิดแอปได้ตอนเน็ตล่ม (ลิฟต์ ชั้นใต้ดิน ต่างจังหวัด)

const VERSION = 'v0.10.0';
const CACHE = `te-dashboard-${VERSION}`;

// โหลดล่วงหน้าตอนติดตั้ง — ต้องครบทุกไฟล์ที่แอปต้องใช้ ไม่งั้นเน็ตล่มครั้งแรกจะเปิดไม่ขึ้น
// (ของเดิมใส่แค่ 6 ไฟล์ → ต้องเคยเปิดหน้านั้นมาก่อนถึงจะใช้ออฟไลน์ได้)
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',

  './js/app.js',
  './js/config.js',
  './js/data/adapter.js',
  './js/data/supabase-adapter.js',
  './js/data/local-adapter.js',
  './js/data/import-map.js',

  './js/modules/dashboard.js',
  './js/modules/pending.js',
  './js/modules/book3.js',
  './js/modules/activities.js',
  './js/modules/sources.js',
  './js/modules/suppliers.js',
  './js/modules/review.js',
  './js/modules/admin.js',
  './js/modules/ai-intake.js',

  './js/ui/datepicker.js',
  './js/ui/loglist.js',
  './js/ui/signoff.js',
  './js/ui/pwa.js',

  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // ⚠️ ห้ามใช้ c.addAll(SHELL) — ถ้ามีไฟล์เดียวใน list ที่ 404
    //    addAll จะ reject ทั้งชุด แล้ว service worker ติดตั้งไม่สำเร็จเลย
    //    (ไอคอน 404 เคยค้างอยู่ในโปรเจกต์นี้ตั้งแต่ 1.2 — ถ้าใช้ addAll จะพังทั้ง PWA)
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();                  // ใช้ตัวใหม่ทันที ไม่ต้องรอปิดทุกแท็บ
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();                // ยึดแท็บที่เปิดอยู่มาคุมทันที
  })());
});

// หน้าเว็บถามเวอร์ชันได้ (ใช้ตอนแจ้งว่ามีของใหม่)
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source?.postMessage({ type: 'version', version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🔒 ห้ามแตะการเรียก API เด็ดขาด
  //    1) ข้อมูลต้องสดเสมอ — ยอดขายที่ค้างจาก cache ทำให้ตัดสินใจผิด
  //    2) ห้ามเก็บข้อมูลลูกค้าลง Cache Storage ซึ่งอยู่บนเครื่องแบบไม่มีวันหมดอายุ
  //       เครื่องที่ใช้ร่วมกัน/ทำหาย = ข้อมูลลูกค้าอ่านได้โดยไม่ต้องล็อกอิน
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;
  if (url.origin !== self.location.origin) return;   // ของนอกบ้านปล่อยผ่าน ไม่เก็บ

  // ⚠️ ต้องบังคับตรวจกับเซิร์ฟเวอร์ทุกครั้งสำหรับโค้ดของแอป
  //    GitHub Pages ส่ง cache-control: max-age=600 → เบราว์เซอร์เสิร์ฟไฟล์เก่าจาก HTTP cache
  //    ได้นานถึง 10 นาที ทำให้ deploy แก้บั๊กแล้วผู้ใช้ยังเจอบั๊กเดิม (เจอมาแล้ว 2 รอบ)
  //    'no-cache' = ยังใช้ ETag ตรวจ ถ้าไฟล์ไม่เปลี่ยนเซิร์ฟเวอร์ตอบ 304 (เบามาก)
  const isAppCode = /\.(js|css|html|json)$/.test(url.pathname) || req.mode === 'navigate';

  e.respondWith(
    fetch(req, isAppCode ? { cache: 'no-cache' } : undefined)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        // เน็ตล่ม → ใช้ของใน cache
        const hit = await caches.match(req);
        if (hit) return hit;
        // เปิดหน้าเว็บ (หรือกดลิงก์ที่มี #hash) → ตกกลับไปที่ index.html เสมอ
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
