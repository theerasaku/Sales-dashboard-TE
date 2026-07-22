// F8 — PWA: ติดตั้งเป็นแอป · แจ้งเวอร์ชันใหม่ · บอกเมื่อออฟไลน์ (step 3.3)
//
// ทำไมต้องมีแถบพวกนี้ ไม่ปล่อยให้เงียบ ๆ:
//
// 1) "ออฟไลน์" — service worker ทำให้ "เปิดแอปได้" ตอนไม่มีเน็ต แต่ "บันทึกไม่ได้"
//    ถ้าไม่บอก ทีมขายที่อยู่หน้างานจะกรอกฟอร์มยาว ๆ แล้วกดบันทึกไม่ผ่าน เสียงานทั้งชุด
//    → ต้องเตือนตั้งแต่ตอนเน็ตหลุด ไม่ใช่ตอนกดบันทึกแล้วค่อยขึ้น error
//
// 2) "มีเวอร์ชันใหม่" — sw.js เรียก skipWaiting() ทำให้ service worker ตัวใหม่
//    ยึดหน้าไปทันที แต่ JS module ที่โหลดเข้าหน่วยความจำไปแล้วยังเป็นตัวเก่า
//    ผู้ใช้จึงอยู่ในสภาพ "ครึ่งเก่าครึ่งใหม่" จนกว่าจะรีเฟรช → ต้องบอกให้กดโหลดใหม่
//
// 3) "ติดตั้งเป็นแอป" — Chrome/Android ยิง event ให้ · แต่ **iOS ไม่มี event นี้เลย**
//    ต้องบอกวิธีกดเองด้วยคำพูด ไม่งั้นคนใช้ iPhone จะไม่มีทางรู้ว่าติดตั้งได้

const LS_HIDE_IOS = 'te-dashboard:hide-ios-install';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;          // ของ iOS Safari โดยเฉพาะ

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ รายงานตัวเองเป็น Mac — ต้องดูว่ามีระบบสัมผัสไหมถึงแยกออก
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let bar = null;
let installEvent = null;

// ⭐ ลำดับความสำคัญของแถบ — มีที่ให้แสดงทีละอันเท่านั้น
//
// 🔴 บั๊กที่เทสต์จับได้: Chrome ยิง beforeinstallprompt ตอนไหนก็ได้
//    แถบ "ติดตั้งเป็นแอปได้" เลยไปทับคำเตือน "ออฟไลน์ · บันทึกไม่ได้" ที่ขึ้นอยู่ก่อน
//    → คนใช้งานอยู่หน้างานเห็นแต่คำชวนติดตั้ง ไม่รู้ว่ากรอกฟอร์มไปก็บันทึกไม่ได้
//
// กติกา: คำเตือนที่ทำให้เสียงานสำคัญกว่าคำชวนเสมอ ของสำคัญน้อยกว่าจะไม่ได้แสดง
const PRI = { offline: 3, update: 2, online: 2, install: 1 };
let curPri = 0;

function host() {
  if (bar) return bar;
  bar = document.getElementById('pwaBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pwaBar';
    bar.className = 'pwabar';
    bar.hidden = true;
    document.body.appendChild(bar);
  }
  return bar;
}

/**
 * แสดงแถบแจ้งเตือน 1 อัน — ของสำคัญกว่าเท่านั้นที่แทรกของเดิมได้
 * @param what  ชื่อเรื่องใน PRI ('offline' | 'update' | 'online' | 'install')
 * @param kind  'warn' | 'info' (แค่หน้าตา)
 * @param html  เนื้อความ (ประกอบเองในไฟล์นี้เท่านั้น ไม่รับข้อความจากผู้ใช้ → ไม่มีทาง XSS)
 * @param actions [{label, onClick, primary}]
 * @returns true ถ้าได้แสดงจริง
 */
function show(what, kind, html, actions = []) {
  const pri = PRI[what] || 1;
  const el = host();
  if (!el.hidden && pri < curPri) return false;   // มีของสำคัญกว่าค้างอยู่ อย่าไปทับ

  curPri = pri;
  el.className = `pwabar pwabar-${kind}`;
  el.dataset.what = what;
  el.hidden = false;
  el.innerHTML = `<span class="pwabar-msg">${html}</span><span class="pwabar-act"></span>`;
  const act = el.querySelector('.pwabar-act');
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-sm ${a.primary ? 'btn-primary' : 'btn-ghost'}`;
    b.textContent = a.label;
    b.addEventListener('click', a.onClick);
    act.appendChild(b);
  }
  syncNotch(true);
  return true;
}

/**
 * แถบอยู่บนสุดของหน้าใน flow ปกติ → มันดันเนื้อหาลงมาเอง ไม่ต้องเผื่อที่ให้
 *
 * 🔴 ที่ต้องจัดการคือ "ระยะรอยบาก" เท่านั้น
 *    ปกติ .topbar เป็นคนกันระยะให้ด้วย --safe-t
 *    แต่พอแถบนี้โผล่ มันกลายเป็นของบนสุดแทน → ถ้าไม่ปิด --safe-t ของส่วนที่เหลือ
 *    จะเว้นที่ซ้ำสองชั้น เกิดช่องว่างเปล่า 47px กลางหน้าบน iPhone
 */
function syncNotch(visible) {
  const root = document.documentElement.style;
  if (visible) root.setProperty('--safe-t', '0px');
  else root.removeProperty('--safe-t');
}

function hide() {
  const el = host();
  el.hidden = true;
  el.innerHTML = '';
  delete el.dataset.what;
  curPri = 0;                                     // ปลดล็อกให้ของถัดไปแสดงได้
  syncNotch(false);
}

// ══════════════════════════════════════════════════════════
// 1) ออนไลน์ / ออฟไลน์
// ══════════════════════════════════════════════════════════

let wasOffline = false;

// ⚠️ ข้อจำกัดที่ต้องรู้: navigator.onLine บอกแค่ "เครื่องต่อเน็ตอยู่ไหม"
//    ไม่ได้บอกว่า "อินเทอร์เน็ตใช้ได้จริงไหม" — ต่อ wifi ที่ล็อกอินไม่ผ่าน
//    หรือเน็ตมือถือสัญญาณอ่อนจนยิงไม่ออก ค่านี้ยังเป็น true อยู่ดี แถบจึงไม่ขึ้น
//    เคสนั้นผู้ใช้จะเจอ error ตอนกดบันทึกแทน (adapter โยนออกมาเป็นภาษาไทยอยู่แล้ว)
//    ถ้าวันหนึ่งอยากให้แม่นกว่านี้ ต้องให้ adapter บอกมาว่ายิง request ไม่ผ่าน แล้วค่อยขึ้นแถบ
function paintNetwork() {
  if (!navigator.onLine) {
    wasOffline = true;
    show('offline', 'warn',
      '<strong>ออฟไลน์</strong> — ดูข้อมูลที่โหลดไว้แล้วได้ แต่<strong>บันทึกไม่ได้</strong> อย่าเพิ่งกรอกฟอร์มยาว ๆ');
    return;
  }
  if (wasOffline) {
    wasOffline = false;
    // ต้อง hide() ก่อน ไม่งั้นแถบ "ออฟไลน์" (สำคัญกว่า) จะกันตัวเองไม่ให้ถูกแทนที่แล้วค้างอยู่
    // ทั้งที่เน็ตกลับมาแล้ว — เตือนผิดยิ่งกว่าไม่เตือน
    if (host().dataset.what === 'offline') hide();
    show('online', 'info', '<strong>ต่อเน็ตได้แล้ว</strong> — โหลดหน้าใหม่เพื่อดึงข้อมูลล่าสุด', [
      { label: 'โหลดใหม่', primary: true, onClick: () => location.reload() },
      { label: 'ไว้ก่อน', onClick: hide },
    ]);
  }
}

// ══════════════════════════════════════════════════════════
// 2) ติดตั้งเป็นแอป
// ══════════════════════════════════════════════════════════

function offerInstall() {
  if (isStandalone()) return;                    // ติดตั้งไปแล้ว

  // Chrome / Edge / Android — ระบบยิง event มาให้ กดปุ่มเดียวจบ
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                          // กันไม่ให้เบราว์เซอร์ขึ้นแถบของตัวเองซ้อน
    installEvent = e;
    // ถ้าตอนนี้กำลังเตือนเรื่องออฟไลน์อยู่ show() จะปฏิเสธเอง (สำคัญน้อยกว่า)
    show('install', 'info', '<strong>ติดตั้งเป็นแอปได้</strong> — เปิดเร็วขึ้นและใช้เต็มจอ', [
      { label: 'ติดตั้ง', primary: true, onClick: async () => {
          hide();
          installEvent?.prompt();
          installEvent = null;
        } },
      { label: 'ไม่ต้อง', onClick: hide },
    ]);
  });

  // iOS ไม่มี beforeinstallprompt — ต้องบอกวิธีกดเอง
  // ขึ้นครั้งเดียวพอ ปิดแล้วจำไว้ ไม่ใช่ตามตื๊อทุกครั้งที่เปิด
  if (isIOS()) {
    let hidden = false;
    try { hidden = localStorage.getItem(LS_HIDE_IOS) === '1'; } catch {}
    if (hidden) return;
    setTimeout(() => {
      show('install', 'info',
        'ติดตั้งเป็นแอปได้ — กดปุ่ม <strong>แชร์</strong> ด้านล่าง แล้วเลือก <strong>เพิ่มไปยังหน้าจอโฮม</strong>', [
        { label: 'รับทราบ', onClick: () => {
            try { localStorage.setItem(LS_HIDE_IOS, '1'); } catch {}
            hide();
          } },
      ]);
    }, 3000);                                     // ให้หน้าโหลดเสร็จก่อน ค่อยรบกวน
  }
}

// ══════════════════════════════════════════════════════════
// 3) service worker + แจ้งเวอร์ชันใหม่
// ══════════════════════════════════════════════════════════

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // file:// และ http:// ธรรมดาจดทะเบียนไม่ได้ (ยกเว้น localhost ที่เบราว์เซอร์ยกเว้นให้)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  // มี controller อยู่ก่อนแล้ว = เคยติดตั้ง service worker มาก่อน
  // ถ้าเดี๋ยว controller เปลี่ยน แปลว่า "อัปเดต" ไม่ใช่ "ติดตั้งครั้งแรก" → ค่อยเตือน
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;                   // ครั้งแรก ไม่ต้องกวน
    show('update', 'info', '<strong>มีเวอร์ชันใหม่</strong> — โหลดใหม่เพื่อใช้ของล่าสุด', [
      { label: 'โหลดใหม่', primary: true, onClick: () => location.reload() },
      { label: 'ไว้ก่อน', onClick: hide },
    ]);
  });

  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    // เปิดแอปค้างไว้ทั้งวัน (ทีมขายเปิดทิ้งไว้บนมือถือ) — ตรวจของใหม่ให้เองชั่วโมงละครั้ง
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (e) {
    console.warn('ลงทะเบียน service worker ไม่สำเร็จ:', e.message);
  }
}

export function initPWA() {
  window.addEventListener('online',  paintNetwork);
  window.addEventListener('offline', paintNetwork);
  if (!navigator.onLine) paintNetwork();          // เปิดแอปมาก็ไม่มีเน็ตอยู่แล้ว

  offerInstall();
  registerSW();
}

// export ไว้ให้เทสต์เรียกตรง ๆ ได้ โดยไม่ต้องปลอม event ของเบราว์เซอร์
export const __test = { show, hide, isIOS, isStandalone };
