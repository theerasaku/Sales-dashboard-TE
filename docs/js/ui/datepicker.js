// ปฏิทินเลือกวันที่ — popup เล็ก ๆ กดเลือกได้เลย
//
// ทำไมไม่ใช้ <input type="date"> เฉย ๆ:
//   1. ปฏิทินในตัวของเบราว์เซอร์แสดง **ปี ค.ศ.** (2026) — ทีมขายอ่านเป็น พ.ศ. เคยชิน
//   2. บน desktop ต้องจิ้มไอคอนเล็ก ๆ ด้านขวาเท่านั้นถึงจะเปิด
//
// กติกาที่ห้ามพลาด: **แสดง พ.ศ. · เก็บ ค.ศ.**
//   ค่าที่ส่งเข้า DB ต้องเป็น 'YYYY-MM-DD' ค.ศ. เสมอ (ตรงกับ column date ของ Postgres)
//   ถ้าเผลอเก็บ 2569 การเรียง/เทียบวันจะพังทั้งระบบ

const TH_MON_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MON_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                      'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayISO = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
};

/** '2026-08-15' → '15 ส.ค. 2569' (ค่าที่คนอ่าน) */
export function thaiDate(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${Number(d)} ${TH_MON_SHORT[Number(mo) - 1]} ${Number(y) + 543}`;
}

/**
 * สร้าง markup ของช่องวันที่ (hidden = ค่าจริงที่ส่งเข้า DB · text = ที่คนเห็น)
 *
 * ⚠️ ส่ง name = '' เมื่อช่องนี้อยู่ข้างในฟอร์มอื่นที่ใช้ FormData
 *    ไม่งั้นค่าจะถูกส่งไปเป็นคอลัมน์ที่ไม่มีจริงแล้ว PostgREST ตอบ 400
 *    (เช่นช่องวันที่ของบันทึกติดตาม ซึ่งอยู่ใน <form> เดียวกับฟอร์มงาน 42 ช่อง)
 */
export function dateField(name, value, opt = {}) {
  const v = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : '';
  return `<span class="dp">
    <input type="hidden"${name ? ` name="${esc(name)}"` : ''} value="${esc(v)}"${opt.id ? ` id="${esc(opt.id)}"` : ''}${opt.cls ? ` class="${esc(opt.cls)}"` : ''}>
    <input type="text" class="dp-view" readonly
           value="${esc(thaiDate(v))}" placeholder="${esc(opt.placeholder || 'เลือกวันที่')}"
           aria-haspopup="dialog" aria-label="${esc(opt.label || 'เลือกวันที่')}">
    <button type="button" class="dp-x" tabindex="-1" title="ล้างวันที่"${v ? '' : ' hidden'}>×</button>
  </span>`;
}

// ── popup ตัวเดียวใช้ร่วมกันทั้งหน้า ──
let pop = null;
let bound = null;        // .dp ที่กำลังเปิดอยู่
let viewY = 0, viewM = 0;

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.className = 'dp-pop';
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  document.body.appendChild(pop);

  pop.addEventListener('mousedown', (e) => e.preventDefault());   // กันช่องกรอกเสีย focus
  pop.addEventListener('click', onPopClick);
  pop.addEventListener('change', onPopChange);
  return pop;
}

function close() {
  if (pop) pop.hidden = true;
  bound = null;
}

function valueOf(dp) { return dp.querySelector('input[type=hidden]').value || ''; }

function setValue(dp, v) {
  const hid = dp.querySelector('input[type=hidden]');
  const view = dp.querySelector('.dp-view');
  const x = dp.querySelector('.dp-x');
  hid.value = v || '';
  view.value = thaiDate(v);
  if (x) x.hidden = !v;
  // ให้โค้ดอื่นที่ดักฟัง change ทำงานได้เหมือน input ปกติ
  hid.dispatchEvent(new Event('change', { bubbles: true }));
}

function render() {
  const cur = valueOf(bound);
  const today = todayISO();
  const first = new Date(viewY, viewM, 1);
  const lead = first.getDay();                       // อาทิตย์ = 0
  const days = new Date(viewY, viewM + 1, 0).getDate();
  const nowY = new Date().getFullYear();

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="dp-d dp-pad"></span>';
  for (let d = 1; d <= days; d++) {
    const v = iso(viewY, viewM, d);
    const cls = ['dp-d'];
    if (v === cur)   cls.push('on');
    if (v === today) cls.push('today');
    cells += `<button type="button" class="${cls.join(' ')}" data-d="${v}">${d}</button>`;
  }

  const years = [];
  for (let y = nowY - 5; y <= nowY + 5; y++) {
    years.push(`<option value="${y}"${y === viewY ? ' selected' : ''}>${y + 543}</option>`);
  }

  pop.innerHTML = `
    <div class="dp-head">
      <button type="button" class="dp-nav" data-mv="-1" title="เดือนก่อนหน้า">‹</button>
      <select class="dp-sel" data-sel="m" aria-label="เดือน">
        ${TH_MON_FULL.map((n, i) => `<option value="${i}"${i === viewM ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
      <select class="dp-sel" data-sel="y" aria-label="ปี พ.ศ.">${years.join('')}</select>
      <button type="button" class="dp-nav" data-mv="1" title="เดือนถัดไป">›</button>
    </div>
    <div class="dp-dow">${TH_DOW.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="dp-grid">${cells}</div>
    <div class="dp-foot">
      <button type="button" class="dp-btn" data-set="${today}">วันนี้</button>
      <button type="button" class="dp-btn" data-clear>ล้าง</button>
    </div>`;
}

function place(dp) {
  const r = dp.getBoundingClientRect();
  pop.hidden = false;
  const ph = pop.offsetHeight, pw = pop.offsetWidth;
  // เปิดลงล่างก่อน ถ้าล่างไม่พอค่อยพลิกขึ้นบน
  const below = window.innerHeight - r.bottom;
  const top = (below < ph + 8 && r.top > ph + 8) ? r.top - ph - 6 : r.bottom + 6;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
  // fixed เพราะ popup ต้องลอยพ้นกล่อง modal ที่มี overflow:auto ไม่งั้นโดนตัดขอบ
  pop.style.top = `${Math.max(8, top)}px`;
  pop.style.left = `${left}px`;
}

function open(dp) {
  ensurePop();
  bound = dp;
  const v = valueOf(dp);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayISO();
  viewY = Number(base.slice(0, 4));
  viewM = Number(base.slice(5, 7)) - 1;
  render();
  place(dp);
}

function onPopClick(e) {
  const day = e.target.closest('[data-d]');
  if (day) { setValue(bound, day.dataset.d); return close(); }

  const set = e.target.closest('[data-set]');
  if (set) { setValue(bound, set.dataset.set); return close(); }

  if (e.target.closest('[data-clear]')) { setValue(bound, ''); return close(); }

  const mv = e.target.closest('[data-mv]');
  if (mv) {
    viewM += Number(mv.dataset.mv);
    if (viewM < 0)  { viewM = 11; viewY--; }
    if (viewM > 11) { viewM = 0;  viewY++; }
    render();
    place(bound);
  }
}

function onPopChange(e) {
  const sel = e.target.closest('[data-sel]');
  if (!sel) return;
  if (sel.dataset.sel === 'm') viewM = Number(sel.value);
  else viewY = Number(sel.value);
  render();
  place(bound);
}

// ── ตัวจับเหตุการณ์ระดับหน้า (ผูกครั้งเดียว ใช้ได้กับช่องที่สร้างทีหลังด้วย) ──
let wired = false;
export function initDatePicker() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', (e) => {
    const x = e.target.closest('.dp-x');
    if (x) {
      e.preventDefault();
      setValue(x.closest('.dp'), '');
      return close();
    }

    const view = e.target.closest('.dp-view');
    if (view) {
      e.preventDefault();
      const dp = view.closest('.dp');
      if (bound === dp && pop && !pop.hidden) return close();   // กดซ้ำ = ปิด
      return open(dp);
    }

    if (pop && !pop.hidden && !e.target.closest('.dp-pop')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop && !pop.hidden) close();
  });

  // เลื่อนจอ/ย่อขยาย แล้ว popup จะลอยผิดที่ — ปิดไปเลยง่ายกว่าและไม่หลอกตา
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
}
