// F1 — App Shell + router
// Phase 0: โครงเปล่า สลับ view ได้ + init adapter ได้ (login เติมใน 1.2)

import { CONFIG } from './config.js';
import { initAdapter } from './data/adapter.js';

import dashboard  from './modules/dashboard.js';
import pending    from './modules/pending.js';
import book3      from './modules/book3.js';
import activities from './modules/activities.js';
import sources    from './modules/sources.js';
import suppliers  from './modules/suppliers.js';

const VIEWS = { dashboard, pending, book3, activities, sources, suppliers };

const el = {
  content:    document.getElementById('content'),
  title:      document.getElementById('viewTitle'),
  sub:        document.getElementById('viewSub'),
  statusPill: document.getElementById('statusPill'),
  modeChip:   document.getElementById('modeChip'),
};

let current = null;

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
    el.content.innerHTML =
      `<div class="empty"><strong>โหลดหน้านี้ไม่สำเร็จ</strong>${e.message}</div>`;
  }

  if (location.hash.slice(1) !== name) location.hash = name;
}

function bindNav() {
  document.querySelectorAll('.nav-item, .bn').forEach(btn => {
    btn.addEventListener('click', () => render(btn.dataset.view));
  });
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1) || 'dashboard';
    if (name !== current) render(name);
  });
}

async function boot() {
  bindNav();

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
  }

  await render(location.hash.slice(1) || 'dashboard');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

console.info(`${CONFIG.APP_NAME} v${CONFIG.VERSION}`);
boot();
