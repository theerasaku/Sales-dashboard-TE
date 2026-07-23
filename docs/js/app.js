// F1 — App Shell + Login + router (Phase 1.2)
//
// ลำดับการทำงาน: initAdapter → เช็ก session
//   มี session   → เข้าแอป
//   ไม่มี        → หน้าเข้าสู่ระบบ (เข้าหน้าอื่นไม่ได้เลย)

import { CONFIG } from './config.js';
import { initAdapter, adapter } from './data/adapter.js';
import { initPWA } from './ui/pwa.js';
import { applyTheme, openThemePicker } from './ui/theme.js';

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

  // ลืมรหัสผ่าน / ตั้งรหัสใหม่ (step 3.11)
  forgotLink:  document.getElementById('forgotLink'),
  resetForm:   document.getElementById('resetForm'),
  resetEmail:  document.getElementById('resetEmail'),
  resetErr:    document.getElementById('resetErr'),
  resetOk:     document.getElementById('resetOk'),
  resetBtn:    document.getElementById('resetBtn'),
  resetBack:   document.getElementById('resetBack'),
  newpassForm: document.getElementById('newpassForm'),
  newpass1:    document.getElementById('newpass1'),
  newpass2:    document.getElementById('newpass2'),
  newpassErr:  document.getElementById('newpassErr'),
  newpassOk:   document.getElementById('newpassOk'),
  newpassBtn:  document.getElementById('newpassBtn'),
};

let current = null;
let recoveryToken = null;   // token จากลิงก์ในเมล (ตอนตั้งรหัสผ่านใหม่)

// ---------- สลับหน้าจอ ----------

// สลับระหว่าง 3 ฟอร์มในหน้าล็อกอิน: เข้าสู่ระบบ / ขอลิงก์รีเซ็ต / ตั้งรหัสใหม่
function showLoginPanel(which) {
  el.login.hidden = false;
  el.app.hidden = true;
  el.loginForm.hidden   = which !== 'login';
  el.resetForm.hidden   = which !== 'reset';
  el.newpassForm.hidden = which !== 'newpass';
}

function showLogin() {
  el.app.hidden = true;
  el.login.hidden = false;
  showLoginPanel('login');
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
  // ตั้งค่าระบบ: admin (จัดการทั้งหมด) + manager (เห็นเป้ารายทีมของตัวเอง) · sale ไม่เห็น
  document.querySelectorAll('[data-view="admin"]').forEach(b => {
    b.hidden = !(user.role === 'admin' || user.role === 'manager');
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

/** อ่าน error ที่ Supabase แนบมาใน hash ตอนลิงก์ recovery หมดอายุ/ผิด — คืนข้อความไทย หรือ null */
function readHashError() {
  try {
    const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const raw = h.get('error_description') || h.get('error');
    if (!raw) return null;
    const t = decodeURIComponent(raw).toLowerCase();
    if (t.includes('expired') || t.includes('otp'))
      return 'ลิงก์ตั้งรหัสผ่านหมดอายุแล้ว — กด "ลืมรหัสผ่าน?" เพื่อขอลิงก์ใหม่';
    return 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง — กด "ลืมรหัสผ่าน?" เพื่อขอลิงก์ใหม่';
  } catch { return null; }
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

// ---------- ลืมรหัสผ่าน / ตั้งรหัสใหม่ (step 3.11) ----------

function bindPasswordReset() {
  el.forgotLink?.addEventListener('click', () => {
    el.resetErr.hidden = true; el.resetOk.hidden = true;
    el.resetEmail.value = el.loginEmail.value.trim();   // เผื่อกรอกอีเมลไว้แล้ว
    showLoginPanel('reset');
    el.resetEmail.focus();
  });
  el.resetBack?.addEventListener('click', () => showLoginPanel('login'));

  el.resetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.resetErr.hidden = true; el.resetOk.hidden = true;
    const email = el.resetEmail.value.trim();
    if (!email) { el.resetErr.textContent = 'กรอกอีเมลก่อน'; el.resetErr.hidden = false; return; }

    el.resetBtn.disabled = true; el.resetBtn.textContent = 'กำลังส่ง…';
    try {
      await adapter.requestPasswordReset(email);
      // 🔒 ไม่บอกว่าอีเมลมีในระบบไหม — กันคนไล่เดาบัญชี
      el.resetOk.innerHTML = 'ถ้ามีบัญชีที่ใช้อีเมลนี้ ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว<br>'
        + '<span class="t2">เปิดเมลแล้วกดลิงก์ (เช็กในกล่อง Junk/Spam ด้วย)</span>';
      el.resetOk.hidden = false;
    } catch (err) {
      el.resetErr.textContent = err.message; el.resetErr.hidden = false;
    } finally {
      el.resetBtn.disabled = false; el.resetBtn.textContent = 'ส่งลิงก์ไปที่อีเมล';
    }
  });

  el.newpassForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.newpassErr.hidden = true; el.newpassOk.hidden = true;
    const p1 = el.newpass1.value, p2 = el.newpass2.value;
    if (p1.length < 6) { el.newpassErr.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; el.newpassErr.hidden = false; return; }
    if (p1 !== p2)     { el.newpassErr.textContent = 'รหัสผ่านสองช่องไม่ตรงกัน'; el.newpassErr.hidden = false; return; }

    el.newpassBtn.disabled = true; el.newpassBtn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.updatePassword(p1, recoveryToken);
      el.newpass1.value = ''; el.newpass2.value = '';
      recoveryToken = null;
      history.replaceState(null, '', location.pathname);   // ลบ token ออกจาก URL
      el.newpassOk.textContent = '✓ ตั้งรหัสผ่านใหม่แล้ว — เข้าสู่ระบบด้วยรหัสใหม่ได้เลย';
      el.newpassOk.hidden = false;
      setTimeout(() => showLoginPanel('login'), 1800);
    } catch (err) {
      el.newpassErr.textContent = err.message; el.newpassErr.hidden = false;
    } finally {
      el.newpassBtn.disabled = false; el.newpassBtn.textContent = 'บันทึกรหัสผ่านใหม่';
    }
  });
}

// ---------- boot ----------

async function boot() {
  // แสดงเวอร์ชันจริงที่เบราว์เซอร์กำลังรัน — ถ้าเลขไม่ตรงกับที่ deploy แปลว่ายังติดโค้ดเก่า
  const v = `v${CONFIG.VERSION}`;
  if (el.verTag)  el.verTag.textContent  = `${v} · Phase 1`;
  if (el.verPill) el.verPill.textContent = v;

  applyTheme();   // ตั้ง data-theme/accent ให้ตรงกับที่จำไว้ (สคริปต์ inline ใน head ทำแล้ว · เรียกซ้ำกันพลาด)
  bindNav();
  el.loginForm.addEventListener('submit', onLoginSubmit);
  bindPasswordReset();
  document.getElementById('logoutBtn')?.addEventListener('click', signOut);
  document.getElementById('logoutBtnTop')?.addEventListener('click', signOut);
  document.getElementById('themeBtn')?.addEventListener('click', openThemePicker);

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

  // กดลิงก์ตั้งรหัสผ่านใหม่จากเมลกลับมา → มี token recovery ใน URL → โชว์ฟอร์มตั้งรหัสใหม่ก่อนเลย
  try {
    recoveryToken = await adapter.readRecoveryToken();
    if (recoveryToken) { showLoginPanel('newpass'); el.newpass1?.focus(); return; }
  } catch { /* ไม่ใช่ลิงก์ recovery ก็ทำงานต่อปกติ */ }

  // ลิงก์ recovery หมดอายุ/ไม่ถูกต้อง → Supabase เด้งกลับพร้อม #error=... บอกผู้ใช้ให้ชัด
  // (กันเคสกดลิงก์เก่าแล้วเห็นแต่หน้า login เฉย ๆ ไม่รู้ว่าเกิดอะไร)
  const hashErr = readHashError();
  if (hashErr) { showLogin(); showLoginError(hashErr); history.replaceState(null, '', location.pathname); }

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
