// F1 — App Shell + Login + router (Phase 1.2)
//
// ลำดับการทำงาน: initAdapter → เช็ก session
//   มี session   → เข้าแอป
//   ไม่มี        → หน้าเข้าสู่ระบบ (เข้าหน้าอื่นไม่ได้เลย)

import { CONFIG } from './config.js';
import { initAdapter, adapter } from './data/adapter.js';
import { initPWA } from './ui/pwa.js';

import dashboard  from './modules/dashboard.js';
import pending    from './modules/pending.js';
import book3      from './modules/book3.js';
import activities from './modules/activities.js';
import sources    from './modules/sources.js';
import review     from './modules/review.js';
import admin      from './modules/admin.js';

// Supplier (F9) พักไว้ก่อนตามที่เจ้าของสั่ง 23 ก.ค. 2569 — สเปคอยู่ใน CLAUDE.md หัวข้อ "แผนอัปเดตอนาคต"
// เข้า #suppliers ตรง ๆ จะเด้งกลับหน้าภาพรวมเอง (router ตกกลับ dashboard เมื่อไม่รู้จักชื่อหน้า)
const VIEWS = { dashboard, pending, book3, activities, sources, review, admin };

const el = {
  login:      document.getElementById('login'),
  loginForm:  document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPass:  document.getElementById('loginPass'),
  loginErr:   document.getElementById('loginErr'),
  loginBtn:   document.getElementById('loginBtn'),

  app:        document.getElementById('app'),
  content:    document.getElementById('content'),
  title:      document.getElementById('viewTitle'),
  sub:        document.getElementById('viewSub'),
  statusPill: document.getElementById('statusPill'),
  modeChip:   document.getElementById('modeChip'),

  verTag:     document.getElementById('verTag'),
  verPill:    document.getElementById('verPill'),

  whoAvatar:  document.getElementById('whoAvatar'),
  whoName:    document.getElementById('whoName'),
  whoMeta:    document.getElementById('whoMeta'),
};

let current = null;

// ---------- สลับหน้าจอ ----------

function showLogin() {
  el.app.hidden = true;
  el.login.hidden = false;
  el.loginEmail?.focus();
}

function showApp(user) {
  el.login.hidden = true;
  el.app.hidden = false;
  paintUser(user);
}

function paintUser(user) {
  if (!user) return;
  const name = user.full_name || user.email || '—';
  el.whoName.textContent = name;
  el.whoAvatar.textContent = (name.trim()[0] || '?').toUpperCase();
  el.whoName.title = user.email || '';

  const roleLabel = { admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้างาน' }[user.role] || 'ฝ่ายขาย';
  el.whoMeta.textContent = user.team ? `${roleLabel} · ${user.team}` : roleLabel;

  // ซ่อนแถบที่ใช้ไม่ได้ — แค่ไม่ให้รก ไม่ใช่มาตรการความปลอดภัย
  // ของจริงบังคับที่ DB (RLS + trigger) ต่อให้พิมพ์ #admin เองก็แก้อะไรไม่ได้
  document.querySelectorAll('[data-view="admin"]').forEach(b => {
    b.hidden = user.role !== 'admin';
  });
  // "รอตรวจ" เป็นงานของหัวหน้า — sale เห็นผลการตรวจได้ในหน้ารายละเอียดอยู่แล้ว
  document.querySelectorAll('[data-view="review"]').forEach(b => {
    b.hidden = !(user.role === 'admin' || user.role === 'manager');
  });
}

// ---------- router ----------

function setActive(name) {
  document.querySelectorAll('.nav-item, .bn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.view === name);
  });
}

async function render(name) {
  const view = VIEWS[name];
  if (!view) return render('dashboard');

  current = name;
  setActive(name);
  el.title.textContent = view.title;
  el.sub.textContent   = view.subtitle;
  el.content.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';

  try {
    await view.render(el.content);
  } catch (e) {
    console.error(e);
    // เซสชันหมดกลางคัน → เด้งกลับหน้าล็อกอิน ไม่ปล่อยให้ค้างหน้าเปล่า
    if (String(e.message).includes('เซสชันหมดอายุ')) return signOut();
    el.content.innerHTML =
      `<div class="empty"><strong>โหลดหน้านี้ไม่สำเร็จ</strong>${escapeHtml(e.message)}</div>`;
  }

  if (location.hash.slice(1) !== name) location.hash = name;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function bindNav() {
  document.querySelectorAll('.nav-item, .bn').forEach(btn => {
    btn.addEventListener('click', () => render(btn.dataset.view));
  });
  window.addEventListener('hashchange', () => {
    if (el.app.hidden) return;                 // ยังไม่ล็อกอิน อย่าให้เปลี่ยนหน้าได้
    const name = location.hash.slice(1) || 'dashboard';
    if (name !== current) render(name);
  });
}

// ---------- auth ----------

function showLoginError(msg) {
  el.loginErr.textContent = msg;
  el.loginErr.hidden = false;
}

async function onLoginSubmit(e) {
  e.preventDefault();
  el.loginErr.hidden = true;

  const email = el.loginEmail.value.trim();
  const pass  = el.loginPass.value;
  if (!email || !pass) return showLoginError('กรอกอีเมลและรหัสผ่านให้ครบ');

  el.loginBtn.disabled = true;
  el.loginBtn.textContent = 'กำลังเข้าสู่ระบบ…';

  try {
    const s = await adapter.signIn(email, pass);
    el.loginPass.value = '';                   // อย่าค้างรหัสผ่านไว้ใน DOM
    showApp(s.user);
    await render(location.hash.slice(1) || 'dashboard');
  } catch (err) {
    console.warn('login failed:', err.message);
    showLoginError(err.message);
    el.loginPass.select();
  } finally {
    el.loginBtn.disabled = false;
    el.loginBtn.textContent = 'เข้าสู่ระบบ';
  }
}

async function signOut() {
  try { await adapter.signOut(); } catch (e) { console.warn(e); }
  current = null;
  el.content.innerHTML = '';
  location.hash = '';
  showLogin();
}

// ---------- boot ----------

async function boot() {
  // แสดงเวอร์ชันจริงที่เบราว์เซอร์กำลังรัน — ถ้าเลขไม่ตรงกับที่ deploy แปลว่ายังติดโค้ดเก่า
  const v = `v${CONFIG.VERSION}`;
  if (el.verTag)  el.verTag.textContent  = `${v} · Phase 1`;
  if (el.verPill) el.verPill.textContent = v;

  bindNav();
  el.loginForm.addEventListener('submit', onLoginSubmit);
  document.getElementById('logoutBtn')?.addEventListener('click', signOut);
  document.getElementById('logoutBtnTop')?.addEventListener('click', signOut);

  try {
    const info = await initAdapter();
    el.modeChip.textContent   = `mode: ${info.mode}`;
    el.statusPill.textContent = info.label;
    el.statusPill.className   = 'pill ok';
  } catch (e) {
    console.error(e);
    el.modeChip.textContent   = 'mode: error';
    el.statusPill.textContent = 'ต่อข้อมูลไม่ได้';
    el.statusPill.className   = 'pill err';
    showLoginError('ระบบตั้งค่าไม่ครบ: ' + e.message);
    return showLogin();
  }

  // มี session ค้างอยู่ไหม (เปิดเบราว์เซอร์ใหม่แล้วไม่ต้องล็อกอินซ้ำ)
  let session = null;
  try {
    session = await adapter.getSession();
  } catch (e) {
    showLoginError(e.message);                 // เช่น บัญชีถูกปิดใช้งาน
  }

  if (session?.user) {
    showApp(session.user);
    await render(location.hash.slice(1) || 'dashboard');
  } else {
    showLogin();
  }

  // PWA: ลงทะเบียน service worker + แถบ ออฟไลน์ / มีเวอร์ชันใหม่ / ติดตั้งเป็นแอป
  // เรียกท้ายสุดเสมอ — ถ้าตัวนี้พังต้องไม่ทำให้แอปเปิดไม่ขึ้น
  try { initPWA(); } catch (e) { console.warn('PWA init ไม่สำเร็จ:', e.message); }
}

console.info(`${CONFIG.APP_NAME} v${CONFIG.VERSION}`);
boot();
