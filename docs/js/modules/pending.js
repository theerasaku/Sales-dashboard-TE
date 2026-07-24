// F4 — Pending Project UI (Phase 1.4)
//
// โครงหน้า: แถบกรอง → ตาราง (desktop) / การ์ด (มือถือ) → แผงรายละเอียดเต็มฟอร์ม
// ข้อมูลทั้งหมดผ่าน adapter เท่านั้น ห้ามเรียก Supabase ตรงจากไฟล์นี้

import { adapter } from '../data/adapter.js';
import { dateField, thaiDate, initDatePicker, todayISO } from '../ui/datepicker.js';
import { logListHtml, bindLogEditing } from '../ui/loglist.js';
import { signoffState, signoffBarHtml, bindSignoff, canSign,
         signoffHistoryHtml, bindSignoffHistory } from '../ui/signoff.js';
import { printPending } from '../ui/formprint.js';
import { openAIImport } from './ai-intake.js';

// ── ขั้นตอนงานขาย ── ยกจาก prototype v3 แต่เปลี่ยน hex เป็นตัวแปร CSS ตามกติกาธีม
export const STAGES = [
  { id: 'lead',    label: 'Lead ใหม่',           prob: 10  },
  { id: 'qualify', label: 'คัดกรอง/สำรวจ',        prob: 25  },
  { id: 'present', label: 'นำเสนอ/ออกแบบ',        prob: 40  },
  { id: 'quote',   label: 'เสนอราคา/ยื่นประมูล',   prob: 60  },
  { id: 'nego',    label: 'ต่อรอง/รอผล',          prob: 80  },
  { id: 'won',     label: 'ปิดได้ (ชนะ)',          prob: 100 },
  { id: 'lost',    label: 'แพ้/ยกเลิก',            prob: 0   },
];
const stageOf = (id) => STAGES.find(s => s.id === id) || STAGES[0];

// ── คอลัมน์ในตาราง (ซ่อน/แสดงได้ · จำไว้ใน localStorage) ──
const COLUMNS = [
  { key: 'pending_no',    label: 'PENDING NO.', w: 120 },
  { key: 'project_name',  label: 'ชื่องาน',      w: 260, always: true },
  { key: 'customer_name', label: 'ลูกค้า',       w: 180 },
  { key: 'value_baht',    label: 'มูลค่า (บาท)', w: 130, num: true },
  { key: 'stage',         label: 'ขั้นตอน',      w: 150 },
  { key: 'close_month',   label: 'คาดปิด',       w: 100 },
  { key: 'team',          label: 'ทีม',          w: 90  },
  { key: 'next_date',     label: 'ทำภายใน',      w: 110 },
  { key: 'last_log',      label: 'ความคืบหน้าล่าสุด', w: 240, nosort: true },
];

const LS_COLS = 'te-dashboard:pending-cols';
const LS_VIEW = 'te-dashboard:pending-view';

// ── ตัวช่วย ──
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const baht = (n) => Number(n || 0).toLocaleString('th-TH');

/** 5000000 → "5.0 ล้าน" (อ่านเร็วกว่าเลขเต็มบนมือถือ) */
const mbaht = (n) => {
  const v = Number(n || 0);
  return v >= 1e6 ? (v / 1e6).toFixed(1) + ' ล้าน' : v.toLocaleString('th-TH');
};

/**
 * เดือน ค.ศ. 'YYYY-MM' → ป้ายไทย พ.ศ. 'ก.ค. 69'
 * ⚠️ เก็บใน DB เป็น ค.ศ. เสมอ · แปลงเป็น พ.ศ. เฉพาะตอนแสดงผล
 *    ถ้าเก็บ 2569 เข้าไป การเรียงตามตัวอักษรจะพังทั้งระบบ
 */
const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return ym;
  return `${TH_MON[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}`;
}

/** รายการเดือนย้อนหลัง 6 → ไปข้างหน้า 24 เดือน สำหรับ dropdown */
function monthOptions(base = new Date()) {
  const out = [];
  const start = new Date(base.getFullYear(), base.getMonth() - 6, 1);
  for (let i = 0; i < 31; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ ym, label: monthLabel(ym) });
  }
  return out;
}

const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** ปุ่มช่วงเวลาสำเร็จรูป — คืน [from, to] เป็น 'YYYY-MM' */
function presetRange(kind, now = new Date()) {
  const y = now.getFullYear();
  switch (kind) {
    case 'this-month': return [ymOf(now), ymOf(now)];
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return [`${y}-${String(q * 3 + 1).padStart(2, '0')}`,
              `${y}-${String(q * 3 + 3).padStart(2, '0')}`];
    }
    // ครึ่งปีหลัง = ช่วงเป้า 80 ล้านบาท (ก.ค.–ธ.ค.)
    case 'h2':   return [`${y}-07`, `${y}-12`];
    case 'year': return [`${y}-01`, `${y}-12`];   // ทั้งปี
    default:     return ['', ''];
  }
}

// ── สถานะหน้าจอ (จำไว้ให้กลับมาแล้วเหมือนเดิม) ──
const DEFAULT_VIEW = {
  sort: 'updated_at', dir: 'desc', search: '', stage: '',
  from: '', to: '', status: 'active',
};

function loadView() {
  try {
    return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem(LS_VIEW) || '{}') };
  } catch {
    return { ...DEFAULT_VIEW };
  }
}
const saveView = (v) => { try { localStorage.setItem(LS_VIEW, JSON.stringify(v)); } catch {} };

function loadCols() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_COLS) || 'null');
    if (Array.isArray(saved)) return new Set(saved);
  } catch {}
  return new Set(COLUMNS.map(c => c.key));
}
const saveCols = (set) => { try { localStorage.setItem(LS_COLS, JSON.stringify([...set])); } catch {} };

// ── หน่วยย่อยของ UI ──

const stagePill = (id) => {
  const s = stageOf(id);
  return `<span class="tag" style="--tag-c:var(--stage-${s.id})">${esc(s.label)}</span>`;
};

/** งานที่เลยกำหนดต้องเห็นชัดจากตาราง ไม่ต้องเปิดเข้าไปดู */
function dueCell(d) {
  if (!d) return '';
  const today = new Date().toISOString().slice(0, 10);
  const late = d < today;
  return `<span class="${late ? 'due-late' : ''}">${esc(thaiDate(d) || d)}${late ? ' ⚠' : ''}</span>`;
}

/** บันทึกความคืบหน้าล่าสุด — เห็นจากตารางเลย ไม่ต้องเปิดเข้าไปทีละงาน */
function lastLogCell(row) {
  const l = row.last_log;
  // ปุ่มบันทึกเร็ว — งานประจำวันคือเพิ่มบันทึกบรรทัดเดียว ไม่ควรต้องเปิดฟอร์ม 42 ช่อง
  const btn = `<button type="button" class="btn-log" data-log="${esc(row.id)}"
                 title="บันทึกความคืบหน้าวันนี้">＋ บันทึก</button>`;
  if (!l) return `<div class="lastlog"><span class="nolog">— ยังไม่มีบันทึก —</span>${btn}</div>`;

  const text = l.response || l.next_doing || '';
  return `<div class="lastlog">
    <div class="lastlog-txt">
      <span class="lastlog-h">${esc(thaiDate(l.log_date) || l.log_date || '')}${l.by_name ? ' · ' + esc(l.by_name) : ''}</span>
      <span class="lastlog-t" title="${esc(text)}">${esc(text)}</span>
    </div>${btn}
  </div>`;
}

function cellOf(row, key) {
  switch (key) {
    case 'value_baht':  return baht(row.value_baht);
    case 'stage':       return stagePill(row.stage);
    case 'close_month': return esc(monthLabel(row.close_month));
    case 'team':        return esc(row.teams?.code || '');
    case 'next_date':   return dueCell(row.next_date);
    case 'last_log':    return lastLogCell(row);
    default:            return esc(row[key]);
  }
}

export default {
  title: 'Pending Project',
  subtitle: 'โครงการที่กำลังติดตาม',

  async render(root) {
    initDatePicker();
    const view = loadView();
    const cols = loadCols();
    let teams = [];
    try { teams = await adapter.listTeams(); } catch { /* ไม่มีทีมก็ยังใช้งานต่อได้ */ }

    root.innerHTML = `
      <div class="toolbar">
        <input class="inp inp-search" id="pSearch" type="search" placeholder="ค้นหาชื่องาน / ลูกค้า / PENDING NO.…"
               value="${esc(view.search)}" autocapitalize="off" spellcheck="false">

        <select class="inp" id="pStage" title="กรองตามขั้นตอน">
          <option value="">ทุกขั้นตอน</option>
          ${STAGES.map(s => `<option value="${s.id}" ${view.stage === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>

        <button class="btn btn-ai btn-sm" id="pAI" title="แปลงรูปฟอร์ม/โน้ต เป็นงานด้วย AI">🤖 AI Import</button>
        <button class="btn btn-primary btn-sm" id="pNew">+ เพิ่มงาน</button>
      </div>

      <div class="toolbar toolbar-sub">
        <span class="tl-label">เดือนที่คาดปิด</span>
        <select class="inp inp-sm" id="pFrom">
          <option value="">ตั้งแต่…</option>
          ${monthOptions().map(o => `<option value="${o.ym}" ${view.from === o.ym ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <span class="tl-label">ถึง</span>
        <select class="inp inp-sm" id="pTo">
          <option value="">…</option>
          ${monthOptions().map(o => `<option value="${o.ym}" ${view.to === o.ym ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>

        <button class="btn btn-ghost btn-sm" data-preset="this-month">เดือนนี้</button>
        <button class="btn btn-ghost btn-sm" data-preset="quarter">ไตรมาสนี้</button>
        <button class="btn btn-ghost btn-sm" data-preset="h2">ครึ่งปีหลัง</button>
        <button class="btn btn-ghost btn-sm" data-preset="year">ทั้งปี</button>
        <button class="btn btn-ghost btn-sm" data-preset="">ล้าง</button>

        <div class="segmented" id="pStatus" role="tablist" aria-label="สถานะงาน">
          <button type="button" data-status="active"   class="${view.status === 'active'   ? 'on' : ''}">กำลังทำ</button>
          <button type="button" data-status="archived" class="${view.status === 'archived' ? 'on' : ''}">
            Archive <span class="seg-badge" id="pArcCount" hidden></span>
          </button>
          <button type="button" data-status="all"      class="${view.status === 'all'      ? 'on' : ''}">ทั้งหมด</button>
        </div>

        <details class="colpick">
          <summary class="btn btn-ghost btn-sm">คอลัมน์</summary>
          <div class="colpick-menu">
            ${COLUMNS.map(c => `
              <label class="chk">
                <input type="checkbox" data-col="${c.key}" ${cols.has(c.key) ? 'checked' : ''}
                       ${c.always ? 'disabled' : ''}> ${esc(c.label)}
              </label>`).join('')}
          </div>
        </details>

        <button class="btn btn-ghost btn-sm" id="pCsv">⭳ CSV</button>
      </div>

      <div class="sum" id="pSum"></div>
      <div id="pList"><div class="skeleton">กำลังโหลด…</div></div>
      <div id="pPanel"></div>`;

    const $ = (id) => root.querySelector('#' + id);
    const listEl = $('pList');

    let rows = [];

    async function reload() {
      saveView(view);
      listEl.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';
      try {
        // ⚠️ Archive = งานที่จบแล้ว — "เดือนคาดปิด" ไม่มีความหมาย จึงไม่กรองเดือน
        //    (ไม่งั้น badge นับงานในคลังทั้งหมด แต่ลิสต์ถูกตัวกรองเดือนซ่อน → เลข 1 แต่ลิสต์ว่าง งง)
        const archived = view.status === 'archived';
        rows = await adapter.listPending({
          status: view.status,
          stage:  view.stage  || undefined,
          from:   archived ? undefined : (view.from || undefined),
          to:     archived ? undefined : (view.to   || undefined),
          search: view.search || undefined,
          sort: view.sort, dir: view.dir,
        });
      } catch (e) {
        listEl.innerHTML = `<div class="empty"><strong>โหลดข้อมูลไม่สำเร็จ</strong>${esc(e.message)}</div>`;
        $('pSum').textContent = '';
        return;
      }
      paint();
      refreshArcBadge();   // อัปเดตเลขบนแถบ Archive ทุกครั้ง (กดเก็บ/ปลุกกลับแล้วเลขตามทันที)
    }

    // ป้ายบอกว่ามีงานค้างใน Archive กี่งาน — เรียกทุก reload ให้ตรงเสมอ
    async function refreshArcBadge() {
      const el = $('pArcCount');
      if (!el) return;
      try {
        const n = await adapter.countPending('archived');
        el.textContent = n;
        el.hidden = !(n > 0);
      } catch { /* นับไม่ได้ก็ไม่เป็นไร ไม่ใช่ข้อมูลสำคัญ */ }
    }

    function paint() {
      const total = rows.reduce((a, r) => a + Number(r.value_baht || 0), 0);
      const won   = rows.filter(r => r.stage === 'won')
                        .reduce((a, r) => a + Number(r.value_baht || 0), 0);
      $('pSum').innerHTML = rows.length
        ? `พบ <b>${rows.length}</b> โครงการ · มูลค่ารวม <b>${mbaht(total)}</b> บาท` +
          (won ? ` · ปิดได้แล้ว <b>${mbaht(won)}</b> บาท` : '')
        : '';

      if (!rows.length) {
        const filtered = view.search || view.stage || view.from || view.to;
        listEl.innerHTML = `<div class="empty">
            <strong>ยังไม่มีงานที่ตรงกับเงื่อนไข</strong>
            ${filtered ? 'ลองล้างตัวกรอง หรือกด "+ เพิ่มงาน"'
                       : 'กด "+ เพิ่มงาน" เพื่อเริ่มบันทึกโครงการแรก'}
          </div>`;
        return;
      }

      const show = COLUMNS.filter(c => cols.has(c.key));
      const arrow = (k) => view.sort === k ? (view.dir === 'asc' ? ' ▲' : ' ▼') : '';

      // ตาราง (desktop) + การ์ด (มือถือ) — CSS เลือกแสดงอันเดียวตามความกว้างจอ
      listEl.innerHTML = `
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              ${show.map(c => c.nosort
                ? `<th style="min-width:${c.w}px" class="nosort">${esc(c.label)}</th>`
                : `<th data-sort="${c.key}" style="min-width:${c.w}px"
                       class="${c.num ? 'num' : ''}">${esc(c.label)}${arrow(c.key)}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr data-id="${esc(r.id)}" class="${r.is_active === false ? 'is-archived' : ''}">
                  ${show.map(c => `<td class="${c.num ? 'num' : ''}">${cellOf(r, c.key)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="cards">
          ${rows.map(r => `
            <div class="pcard" data-id="${esc(r.id)}" role="button" tabindex="0">
              <div class="pcard-top">
                <strong>${esc(r.project_name)}</strong>
                ${stagePill(r.stage)}
              </div>
              <div class="pcard-mid">${esc(r.customer_name || '—')}</div>
              <div class="pcard-bot">
                <span>${mbaht(r.value_baht)} บาท</span>
                <span>${esc(monthLabel(r.close_month) || 'ยังไม่ระบุเดือน')}</span>
              </div>
              ${r.next_date ? `<div class="pcard-due">ทำภายใน ${dueCell(r.next_date)}</div>` : ''}
              <div class="pcard-log">${lastLogCell(r)}</div>
            </div>`).join('')}
        </div>`;
    }

    // ── เหตุการณ์ ──

    let t = null;
    $('pSearch').addEventListener('input', (e) => {
      // หน่วงก่อนยิง ไม่งั้นพิมพ์ 1 ตัวยิง 1 ครั้ง เปลืองเน็ตบนมือถือ
      clearTimeout(t);
      view.search = e.target.value;
      t = setTimeout(reload, 300);
    });

    // หรี่ตัวกรองเดือนเมื่ออยู่แท็บ Archive — งานจบแล้วไม่กรองตามเดือนคาดปิด (ให้ตรงกับ badge)
    function syncMonthFilterState() {
      const off = view.status === 'archived';
      ['pFrom', 'pTo'].forEach(id => { const el = $(id); if (el) el.disabled = off; });
      root.querySelectorAll('[data-preset]').forEach(b => { b.disabled = off; });
      root.querySelector('.toolbar-sub')?.classList.toggle('filter-off', off);
    }

    $('pStage')   .addEventListener('change', (e) => { view.stage = e.target.value; reload(); });
    $('pFrom')    .addEventListener('change', (e) => { view.from  = e.target.value; reload(); });
    $('pTo')      .addEventListener('change', (e) => { view.to    = e.target.value; reload(); });
    root.querySelectorAll('#pStatus [data-status]').forEach(b => {
      b.addEventListener('click', () => {
        view.status = b.dataset.status;
        root.querySelectorAll('#pStatus [data-status]')
            .forEach(x => x.classList.toggle('on', x === b));
        syncMonthFilterState();
        reload();
      });
    });
    syncMonthFilterState();

    root.querySelectorAll('[data-preset]').forEach(b => {
      b.addEventListener('click', () => {
        const [f, to] = presetRange(b.dataset.preset);
        view.from = f; view.to = to;
        $('pFrom').value = f; $('pTo').value = to;
        reload();
      });
    });

    root.querySelectorAll('[data-col]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) cols.add(cb.dataset.col); else cols.delete(cb.dataset.col);
        saveCols(cols);
        paint();
      });
    });

    listEl.addEventListener('click', (e) => {
      // ปุ่มบันทึกเร็วต้องเช็กก่อนแถว ไม่งั้นโดนแถวดักไปเปิดฟอร์มเต็มแทน
      const lg = e.target.closest('[data-log]');
      if (lg) {
        e.stopPropagation();
        return openQuickLog(root.querySelector('#pPanel'), lg.dataset.log, reload);
      }

      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        // กดคอลัมน์เดิมซ้ำ = สลับทิศ · คอลัมน์ใหม่ = เริ่มจากมากไปน้อย
        if (view.sort === k) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
        else { view.sort = k; view.dir = 'desc'; }
        return reload();
      }
      const hit = e.target.closest('[data-id]');
      if (hit) openDetail(root.querySelector('#pPanel'), hit.dataset.id, reload, teams);
    });

    // การ์ดเป็น div (ไม่ใช่ button — จะซ้อนปุ่มบันทึกข้างในไม่ได้)
    // จึงต้องรับคีย์บอร์ดเองให้ใช้งานได้เท่าเดิม
    listEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.pcard');
      if (!card) return;
      e.preventDefault();
      openDetail(root.querySelector('#pPanel'), card.dataset.id, reload, teams);
    });

    $('pNew').addEventListener('click', () =>
      openDetail(root.querySelector('#pPanel'), null, reload, teams));
    $('pAI').addEventListener('click', () => openAIImport('pending', { onSaved: reload }));
    $('pCsv').addEventListener('click', () => exportCsv(rows));

    await reload();

    // มาจากหน้า "รอตรวจ" — เปิดรายการที่หัวหน้าเลือกให้เลย
    // ใช้ sessionStorage ไม่ใช่ hash เพราะ id ไม่ควรไปโผล่บน URL ที่แชร์กันได้
    const jump = sessionStorage.getItem('te:openRecord');
    if (jump) {
      sessionStorage.removeItem('te:openRecord');
      openDetail(root.querySelector('#pPanel'), jump, reload, teams);
    }

  },
};

// ══════════════════════════════════════════════════════════
// รายการบันทึกติดตาม + แก้ไขในที่ (ใช้ร่วมกันทั้งแผงเล็กและฟอร์มเต็ม)
// ══════════════════════════════════════════════════════════

/**
 * ผู้ใช้ที่ล็อกอินอยู่ — ใช้ตัดสินว่าจะโชว์ปุ่มแก้ไขไหม
 * ⚠️ ห้ามแคชไว้ระดับ module: ถ้าออกจากระบบแล้วคนอื่นล็อกอินบนเครื่องเดียวกัน
 *    ค่าเก่าจะค้าง แล้วโชว์ปุ่มแก้ไขให้ผิดคน (DB ยังกันอยู่ แต่ผู้ใช้จะงง)
 */
async function whoAmI() {
  try { return (await adapter.getSession())?.user || null; } catch { return null; }
}

// ══════════════════════════════════════════════════════════
// บันทึกความคืบหน้าเร็ว — ใช้บ่อยสุดในงานประจำวัน
// เปิดเฉพาะ 4 ช่องตามฟอร์มกระดาษ (DATE / BY / RESPONSE / NEXT DOING)
// ══════════════════════════════════════════════════════════

async function openQuickLog(host, pendingId, onSaved) {
  let row = null;
  try { row = await adapter.getPending(pendingId); } catch { /* ไม่มีชื่องานก็ยังบันทึกได้ */ }
  const logs = row?.follow_logs || [];
  const me   = await whoAmI();

  host.innerHTML = `
    <div class="modal" id="qModal">
      <form class="modal-box modal-sm" id="qForm">
        <div class="modal-head">
          <strong>บันทึกความคืบหน้า</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="qClose">ปิด</button>
        </div>
        <div class="modal-body">
          <p class="q-sub">${esc(row?.project_name || '')}</p>
          <div class="fgrid">
            <label class="fld"><span>DATE — วันที่</span>
              ${dateField('log_date', new Date().toISOString().slice(0, 10), { label: 'วันที่บันทึก' })}</label>
            <label class="fld"><span>BY — ใครติดตาม</span>
              <input type="text" name="by_name"></label>
            <label class="fld fld-wide"><span>RESPONSE — ผลที่ได้</span>
              <textarea name="response" rows="3" placeholder="เช่น เข้าพบ ผอ. แล้ว ขอให้ส่งสเปกเพิ่ม"></textarea></label>
            <label class="fld fld-wide"><span>NEXT DOING — ทำอะไรต่อ</span>
              <textarea name="next_doing" rows="2" placeholder="เช่น ส่งสเปกวันจันทร์"></textarea></label>
          </div>

          ${logs.length ? `
            <h3 class="q-h3">ประวัติที่ผ่านมา (${logs.length})</h3>
            <ul class="loglist" id="qLogList">${logListHtml(logs, me)}</ul>` : ''}
        </div>
        <p class="login-err" id="qErr" role="alert" hidden></p>
        <div class="modal-foot">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="qCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="qSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };

  q('#qClose').addEventListener('click', close);
  q('#qCancel').addEventListener('click', close);
  q('#qModal').addEventListener('mousedown', (e) => { if (e.target.id === 'qModal') close(); });

  // แก้ไขบันทึกเก่า → วาดใหม่เฉพาะรายการประวัติ
  // (ห้ามเปิดแผงใหม่ทั้งใบ ไม่งั้นบันทึกใหม่ที่ผู้ใช้พิมพ์ค้างไว้ด้านบนจะหาย)
  async function reloadQLogs() {
    let fresh = [];
    try { fresh = await adapter.listFollowLogs(pendingId); } catch { return; }
    const ul = q('#qLogList');
    if (!ul) return;
    ul.innerHTML = logListHtml(fresh, me);
    bindLogEditing(ul, fresh, adapter.updateFollowLog, reloadQLogs);
    await onSaved();
  }
  if (logs.length) bindLogEditing(q('#qLogList'), logs, adapter.updateFollowLog, reloadQLogs);

  q('#qForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#qErr').hidden = true;
    const d = Object.fromEntries(new FormData(ev.target).entries());
    if (!String(d.response || '').trim() && !String(d.next_doing || '').trim()) {
      q('#qErr').textContent = 'กรอก RESPONSE หรือ NEXT DOING อย่างน้อยหนึ่งช่อง';
      q('#qErr').hidden = false;
      return;
    }
    const btn = q('#qSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.addFollowLog({ pending_id: pendingId, ...d });
      close();
      await onSaved();
    } catch (e) {
      q('#qErr').textContent = e.message;
      q('#qErr').hidden = false;
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ══════════════════════════════════════════════════════════
// แผงรายละเอียด / ฟอร์มเต็ม (ตามฟอร์มกระดาษ 2 หน้า)
// ══════════════════════════════════════════════════════════

// ตาราง PRODUCT — วางไว้ "ก่อนหมวดเงิน & เวลา" (เจ้าของสั่ง 23 ก.ค. 2569)
// เพราะรายการสินค้าคือที่มาของยอดเงิน ควรกรอกก่อนถึงจะรู้มูลค่างานรวม
const PRODUCT_SECTION = `
          <section class="fgroup">
            <h3>PRODUCT — รายการสินค้า
              <span class="fg-note">สูงสุด 9 แถว เท่าฟอร์มกระดาษ</span></h3>
            <div class="prodwrap">
              <table class="prodtbl" id="prodTbl">
                <thead><tr>
                  <th>PRODUCT</th><th>AMOUNT</th><th>PRICE/UNIT</th>
                  <th>TOTAL</th><th>DISCOUNT</th><th>NET</th><th>NOTE</th><th></th>
                </tr></thead>
                <tbody id="prodBody"></tbody>
              </table>
            </div>
            <div class="lg-add-row">
              <button type="button" class="btn btn-ghost btn-sm" id="prodAdd">+ เพิ่มแถว</button>
              <span class="lg-hint" id="prodHint"></span>
            </div>
          </section>`;

const FORM = [
  { group: 'หัวฟอร์ม', fields: [
    ['pending_no',     'PENDING NO. (Sale code count)',      'text', 'เช่น PD-69-004'],
    ['project_name',   'ชื่องาน/โครงการ *',                   'text', 'เช่น ระบบประปาบาดาล อบต. …'],
    ['customer_name',  'ลูกค้า / หน่วยงาน',                    'text'],
    ['site',           'SITE (สถานที่โครงการ)',                'text'],
    ['quotation_no',   'QUOTATION NO',                        'text'],
    ['customer_code',  'CUSTOMER CODE',                       'text'],
    ['project_detail', 'PROJECT DETAIL (รายละเอียดโครงการ)',    'area'],
  ]},
  { group: 'ผู้เกี่ยวข้อง', fields: [
    ['project_owner', 'OWNER (เจ้าของโครงการ)', 'text'],
    ['contractor',    'CONTRACTOR (ผู้รับเหมา)', 'text'],
    ['designer',      'DESIGNER (ผู้ออกแบบ)',    'text'],
    ['consultant',    'CONSULT (ที่ปรึกษา)',     'text'],
  ]},
  { group: 'เงิน & เวลา', fields: [
    ['value_baht',    'มูลค่างาน (บาท) *',             'number', 'เช่น 5000000'],
    ['close_month',   'เดือนที่คาดปิด',                'month'],
    ['decision_day',  'DECISION DAY (วันตัดสินใจ)',     'date'],
    ['purchased_day', 'PURCHASED DAY (วันจัดซื้อ)',     'date'],
    ['project_time',  'PROJECT TIME (ระยะเวลาโครงการ)', 'text', 'เช่น 120 วัน'],
    ['product_time',  'PRODUCT TIME (ระยะส่งมอบ)',      'text', 'เช่น 45 วัน'],
  ]},
  { group: 'แผนชนะงาน', fields: [
    ['stage',          'ขั้นตอนงานขาย',                 'stage'],
    ['competitors',    'COMPETITOR / ความเสี่ยง',        'area'],
    ['customer_needs', 'ความต้องการที่แท้จริงของลูกค้า',   'area'],
    ['our_strengths',  'จุดแข็งของเราในงานนี้',           'area'],
    ['win_plan',       'Win plan — แผนการชนะงาน',        'area'],
  ]},
  { group: 'การติดตาม & ที่มา', fields: [
    ['next_action', 'Next action ถัดไป', 'text', 'เช่น นัดสำรวจหน้างาน'],
    ['next_date',   'กำหนดทำภายใน',       'date'],
    ['lead_source', 'แหล่งที่มาของงาน',    'text', 'เช่น e-GP / ลูกค้าแนะนำ / agent'],
    // ⏸️ ซ่อน 'ผลิตภัณฑ์/ระบบ' ไว้ก่อน (เจ้าของสั่ง 23 ก.ค. 2569) — ให้ไปกรอกที่ตาราง PRODUCT แทน
    //    ⚠️ ห้ามลบคอลัมน์ product ใน DB — งานเก่าที่กรอกไว้แล้วยังอยู่ในนั้น
    //       ช่องนี้แค่ไม่แสดงบนฟอร์ม ค่าเดิมจึงไม่ถูกเขียนทับ (ไม่อยู่ใน FormData = ไม่ถูกส่งไป PATCH)
    // ['product',     'ผลิตภัณฑ์/ระบบ',     'text'],
    ['team_id',     'ทีมผู้ดูแล',          'team'],
  ]},
];

function fieldHtml([key, label, type, ph], row, teams) {
  const v = row?.[key] ?? '';
  const p = ph ? ` placeholder="${esc(ph)}"` : '';

  if (type === 'area')
    return `<label class="fld fld-wide"><span>${esc(label)}</span>
      <textarea name="${key}" rows="3"${p}>${esc(v)}</textarea></label>`;

  if (type === 'stage')
    return `<label class="fld"><span>${esc(label)}</span><select name="${key}">
      ${STAGES.map(s => `<option value="${s.id}" ${v === s.id ? 'selected' : ''}>${esc(s.label)} · ${s.prob}%</option>`).join('')}
    </select></label>`;

  if (type === 'team')
    return `<label class="fld"><span>${esc(label)}</span><select name="${key}">
      <option value="">— ยังไม่ระบุ —</option>
      ${teams.map(t => `<option value="${esc(t.id)}" ${v === t.id ? 'selected' : ''}>${esc(t.code)}</option>`).join('')}
    </select></label>`;

  if (type === 'month')
    // ⚠️ dropdown เท่านั้น ห้ามให้พิมพ์เอง — กันกรอกปี พ.ศ. (2569) ซึ่งจะทำให้เรียงผิดทั้งระบบ
    return `<label class="fld"><span>${esc(label)}</span><select name="${key}">
      <option value="">— ยังไม่ระบุ —</option>
      ${monthOptions().map(o => `<option value="${o.ym}" ${v === o.ym ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select></label>`;

  if (type === 'date')
    return `<label class="fld"><span>${esc(label)}</span>${dateField(key, v, { label })}</label>`;

  const t = type === 'number' ? 'number' : 'text';
  return `<label class="fld"><span>${esc(label)}</span>
    <input type="${t}" name="${key}" value="${esc(v)}"${p}${type === 'number' ? ' min="0" step="1"' : ''}></label>`;
}

async function openDetail(host, id, onSaved, teams) {
  let row = null;
  if (id) {
    host.innerHTML = '<div class="modal"><div class="modal-box"><div class="skeleton">กำลังโหลด…</div></div></div>';
    try {
      row = await adapter.getPending(id);
    } catch (e) {
      host.innerHTML = `<div class="modal"><div class="modal-box">
        <div class="empty">เปิดงานนี้ไม่ได้ — ${esc(e.message)}</div></div></div>`;
      return;
    }
  }

  const logs     = row?.follow_logs || [];
  const contacts = row?.project_contacts || [];
  const archived = row?.is_active === false;
  const me       = await whoAmI();

  // ลายเซ็นหัวหน้า — ยังไม่ได้รัน signoffs.sql ก็ต้องเปิดฟอร์มได้ตามปกติ
  let soState = { kind: 'none' };
  let soHist  = [];
  if (id) {
    try {
      const list = await adapter.listSignoffs('pending_projects', [id]);
      soState = signoffState(row, list?.[0]);
    } catch { soState = null; }
    // ประวัติการตรวจทั้งหมด (แสดงเป็น timeline ใกล้บันทึกกิจกรรม)
    try { soHist = await adapter.listSignoffHistory('pending_projects', id); } catch { soHist = []; }
  }

  host.innerHTML = `
    <div class="modal" id="pModal">
      <form class="modal-box" id="pForm">
        <div class="modal-head">
          <strong>${id ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</strong>
          ${archived ? `<span class="tag" style="--tag-c:var(--text-mute)">จบแล้ว${
              row?.archived_at ? ' · ' + esc(thaiDate(String(row.archived_at).slice(0, 10))) : ''}</span>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" id="pClose">ปิด</button>
        </div>

        <div class="modal-body">
          ${id && soState ? signoffBarHtml(soState, canSign(me)) : ''}
          ${FORM.map(g => `
            ${g.group === 'เงิน & เวลา' ? PRODUCT_SECTION : ''}
            <section class="fgroup">
              <h3>${esc(g.group)}</h3>
              <div class="fgrid">${g.fields.map(f => fieldHtml(f, row, teams)).join('')}</div>
            </section>`).join('')}

          <section class="fgroup">
            <h3>CONTACT TO — ผู้ติดต่อ 1–3</h3>
            ${[1, 2, 3].map(i => {
              const c = contacts.find(x => Number(x.slot) === i) || {};
              return `<div class="fgrid ctc">
                <label class="fld"><span>ผู้ติดต่อ ${i} (ชื่อ-ตำแหน่ง)</span>
                  <input type="text" name="ctc${i}_name" value="${esc(c.name)}"></label>
                <label class="fld"><span>STATUS ${i}</span>
                  <input type="text" name="ctc${i}_status" value="${esc(c.status)}"
                         placeholder="เช่น ผู้ตัดสินใจ / ผู้ชง"></label>
                <label class="fld"><span>โทรศัพท์ ${i}</span>
                  <input type="tel" name="ctc${i}_phone" value="${esc(c.phone)}"
                         inputmode="tel"></label>
                <label class="fld"><span>อีเมล ${i}</span>
                  <input type="email" name="ctc${i}_email" value="${esc(c.email)}"
                         autocapitalize="off" spellcheck="false"></label>
                <label class="fld fld-wide"><span>ADDRESS / ช่องทางติดต่อ ${i}</span>
                  <input type="text" name="ctc${i}_address" value="${esc(c.address)}"></label>
              </div>`;
            }).join('')}
          </section>

          ${id ? `
            <section class="fgroup">
              <h3>บันทึกติดตาม (<span id="logCount">${logs.length}</span>)</h3>
              <div class="fgrid">
                <label class="fld"><span>วันที่</span>
                  ${dateField('', new Date().toISOString().slice(0, 10), { id: 'lgDate', label: 'วันที่บันทึก' })}</label>
                <label class="fld"><span>BY (ใคร)</span><input type="text" id="lgBy"></label>
                <label class="fld fld-wide"><span>RESPONSE — ผลที่ได้</span>
                  <textarea id="lgRes" rows="2"></textarea></label>
                <label class="fld fld-wide"><span>NEXT DOING — ทำอะไรต่อ</span>
                  <textarea id="lgNext" rows="2"></textarea></label>
              </div>
              <div class="lg-add-row">
                <button type="button" class="btn btn-ghost btn-sm" id="lgAdd">+ เพิ่มบันทึก</button>
                <span class="lg-hint">หรือกด "บันทึก" ด้านล่างก็เก็บให้เหมือนกัน</span>
              </div>

              ${soHist.length ? `<div class="so-hist-wrap">
                <div class="so-hist-h">🔖 การตรวจของหัวหน้า (${soHist.length})</div>
                ${signoffHistoryHtml(soHist)}
              </div>` : ''}

              <ul class="loglist" id="logList">${logListHtml(logs, me)}</ul>
            </section>`
          : `<section class="fgroup">
               <h3>บันทึกติดตาม (DATE / BY / RESPONSE / NEXT DOING)</h3>
               <div class="empty" style="padding:20px">
                 บันทึกความคืบหน้ารายวันเพิ่มได้หลังกด "บันทึก" งานนี้แล้ว
                 <br>จากนั้นใช้ปุ่ม <b>＋ บันทึก</b> ในตารางได้เลย ไม่ต้องเปิดฟอร์มเต็มทุกครั้ง
               </div>
             </section>`}

          <!-- 🔴 แถบผล Success/Miss อยู่ "ใน" modal-body (เลื่อนตามเนื้อหา ไม่ pin ไว้ล่างจอ)
               ของเดิมอยู่นอก body → ถูกตรึงล่างจอ บังฟิลด์บน S24 (บทเรียนเดียวกับ PWA bar)
               ห้ามย้ายกลับออกไปนอก modal-body -->
          ${id ? `
          <div class="resultbar">
            <span class="resultbar-l">ผลของงานนี้</span>
            <button type="button" class="btn-result btn-win" id="pResWin">✓ Success — ได้งาน</button>
            <button type="button" class="btn-result btn-miss" id="pResMiss">✗ Miss — ไม่ได้งาน</button>
            <label class="resultbar-because">
              <span>เพราะ</span>
              <input type="text" name="result_because" value="${esc(row?.result_because)}"
                     placeholder="เหตุผล เช่น ราคาสู้คู่แข่งไม่ได้ / ได้สเปกตรงงาน">
            </label>
          </div>` : ''}
        </div>

        <p class="login-err" id="pErr" role="alert" hidden></p>

        <p class="arch-hint" id="pArchHint" hidden>
          งานนี้ปิดจบแล้ว — กด <b>"Project จบแล้ว"</b> เก็บเข้าคลังได้เลย
          จะได้ไม่มาปนกับงานที่ยังเดินอยู่ (กิจกรรมที่ผูกไว้จะหยุดเตือนด้วย)
        </p>

        <div class="modal-foot">
          ${id ? `<button type="button" id="pArch"
                    class="btn btn-sm ${archived ? 'btn-ghost' : 'btn-danger'}">
                    ${archived ? '↩ ปลุกกลับมาทำต่อ' : 'Project จบแล้ว — เก็บเข้าคลัง Archives'}
                  </button>` : ''}
          ${id && archived ? `<button type="button" id="pDelete" class="btn btn-sm btn-danger"
                    title="ลบออกจากฐานข้อมูลถาวร — กู้กลับไม่ได้">🗑 ลบถาวร</button>` : ''}
          <span class="spacer"></span>
          ${id ? `<button type="button" class="btn btn-ghost" id="pPrint"
                    title="พิมพ์ตามฟอร์มกระดาษต้นฉบับ หรือบันทึกเป็น PDF">🖨 พิมพ์ / PDF</button>` : ''}
          <button type="button" class="btn btn-ghost" id="pCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="pSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };

  if (id && soState && canSign(me)) {
    bindSignoff(host, 'pending_projects', id, adapter.addSignoff, async () => {
      close();
      await onSaved();
    });
  }
  bindSignoffHistory(host);   // ปุ่มขยายดูคอมเมนต์ในประวัติการตรวจ

  // ── ปิดงานแล้วเตือนให้เก็บเข้าคลัง (step 2.5) ──
  // ไม่เก็บให้อัตโนมัติ เพราะบางทีปิดการขายแล้วยังต้องตามส่งของ/วางบิลอีกหลายเดือน
  // แค่บอกให้เห็นว่ามีทางเก็บ ไม่งั้นงานที่ปิดแล้วค้างปนกับงานที่ยังเดินอยู่เรื่อย ๆ
  const stageSel = q('[name="stage"]');
  const archHint = q('#pArchHint');
  const syncArchHint = () => {
    if (!archHint || archived) return;
    const st = stageSel?.value;
    archHint.hidden = !(id && (st === 'won' || st === 'lost'));
  };
  stageSel?.addEventListener('change', syncArchHint);
  syncArchHint();
  const fail  = (msg) => { const e = q('#pErr'); e.textContent = msg; e.hidden = false; };

  // ── ปุ่ม Success / Miss — ระบุได้งาน/ไม่ได้งานในคลิกเดียว ──
  // กด = ตั้ง stage เป็น won/lost แล้วบันทึกทั้งฟอร์ม (คงค่าที่แก้อื่น ๆ + เหตุผลไว้ด้วย)
  // ⭐ won ต้องมี purchased_day ถึงจะนับเข้าเป้า 80 ล้าน (monthOf นับจาก purchased_day+stage='won')
  //    → เติม "วันนี้" ให้ถ้ายังไม่ได้กรอก · ใช้ todayISO() ไม่ใช่ new Date() (กันเพี้ยนก่อน 07:00)
  const setResActive = (stg) => {
    q('#pResWin') ?.classList.toggle('on', stg === 'won');
    q('#pResMiss')?.classList.toggle('on', stg === 'lost');
  };
  if (id) setResActive(stageSel?.value);
  stageSel?.addEventListener('change', () => setResActive(stageSel.value));

  const applyResult = (win) => {
    if (stageSel) stageSel.value = win ? 'won' : 'lost';
    if (win) {
      const pd = host.querySelector('input[name="purchased_day"]');
      if (pd && !pd.value) pd.value = todayISO();
    }
    setResActive(stageSel?.value);
    syncArchHint();
    const form = q('#pForm');
    if (form.requestSubmit) form.requestSubmit();   // บันทึกทั้งฟอร์ม → submit handler ปิด+reload ต่อ
    else q('#pSave').click();                        // fallback เบราว์เซอร์เก่า (#pSave = type=submit)
  };
  q('#pResWin') ?.addEventListener('click', () => applyResult(true));
  q('#pResMiss')?.addEventListener('click', () => applyResult(false));

  q('#pClose').addEventListener('click', close);
  q('#pCancel').addEventListener('click', close);

  /**
   * รีเฟรชเฉพาะรายการบันทึก ไม่วาดทั้งแผงใหม่
   * ⚠️ ห้ามเรียก openDetail() ซ้ำตรงนี้ — จะดึงข้อมูลจาก DB มาทับ
   *    ทำให้สิ่งที่ผู้ใช้พิมพ์ค้างไว้ใน 42 ช่องหายหมดโดยไม่มีคำเตือน
   */
  async function reloadLogs() {
    let fresh = [];
    try { fresh = await adapter.listFollowLogs(id); } catch { return; }
    const ul = q('#logList');
    if (!ul) return;
    ul.innerHTML = logListHtml(fresh, me);
    const cnt = q('#logCount');
    if (cnt) cnt.textContent = fresh.length;
    bindLogEditing(ul, fresh, adapter.updateFollowLog, reloadLogs);
    await onSaved();                       // อัปเดตตารางข้างหลังด้วย
  }

  if (id) bindLogEditing(q('#logList'), logs, adapter.updateFollowLog, reloadLogs);

  /** อ่านช่องบันทึกติดตามที่พิมพ์ค้างไว้ — คืน null ถ้ายังไม่ได้พิมพ์อะไร */
  function draftLog() {
    if (!id) return null;
    const res  = q('#lgRes')?.value.trim()  || '';
    const next = q('#lgNext')?.value.trim() || '';
    if (!res && !next) return null;
    return {
      pending_id: id,
      log_date:   q('#lgDate')?.value || undefined,   // hidden input ของปฏิทิน
      by_name:    q('#lgBy')?.value.trim() || undefined,
      response:   res  || undefined,
      next_doing: next || undefined,
    };
  }

  function clearDraft() {
    ['#lgRes', '#lgNext', '#lgBy'].forEach(sel => { const e = q(sel); if (e) e.value = ''; });
  }
  // กดพื้นหลังนอกกล่อง = ปิด (mousedown กัน drag จากในกล่องแล้วปล่อยข้างนอกแล้วปิดทิ้ง)
  q('#pModal').addEventListener('mousedown', (e) => { if (e.target.id === 'pModal') close(); });

  q('#pForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#pErr').hidden = true;

    const all = Object.fromEntries(new FormData(ev.target).entries());

    // แยกช่องผู้ติดต่อ (ctc1_name …) ออกมา — คนละตารางกับ pending_projects
    const payload = {};
    const ctcRaw  = {};
    for (const [k, v] of Object.entries(all)) {
      const m = k.match(/^ctc([123])_(\w+)$/);
      if (m) (ctcRaw[m[1]] ||= { slot: Number(m[1]) })[m[2]] = v;
      else payload[k] = v;
    }
    const ctcList = [1, 2, 3].map(i => ctcRaw[i] || { slot: i });

    if (id) payload.id = id;

    if (!String(payload.project_name || '').trim()) return fail('กรอกชื่องาน/โครงการก่อน');
    payload.value_baht = Number(payload.value_baht || 0);
    if (!Number.isFinite(payload.value_baht) || payload.value_baht < 0)
      return fail('มูลค่างานต้องเป็นตัวเลขไม่ติดลบ');

    const btn = q('#pSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const saved = await adapter.savePending(payload);
      // ผู้ติดต่อต้องรอ id ของงานก่อน (กรณีสร้างใหม่ id เพิ่งเกิดตอนนี้)
      const pid = id || saved?.id;
      if (pid) await adapter.saveContacts(pid, ctcList);
      // รายการสินค้าเก็บคนละตารางเหมือนผู้ติดต่อ — ต้องรอ id ของงานก่อนเช่นกัน
      if (pid) {
        try { await adapter.savePendingProducts(pid, readProducts()); }
        catch (e) { console.warn('บันทึกรายการสินค้าไม่สำเร็จ:', e.message); }
      }

      // ⭐ บันทึกติดตามที่พิมพ์ค้างไว้แต่ยังไม่ได้กด "+ เพิ่มบันทึก" ต้องถูกบันทึกด้วย
      //    ไม่งั้นผู้ใช้พิมพ์แล้วกดปุ่มบันทึกใหญ่ ข้อความจะหายไปเงียบ ๆ
      const d = draftLog();
      if (d && pid) await adapter.addFollowLog({ ...d, pending_id: pid });

      close();
      await onSaved();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  /**
   * เก็บเข้า Archive ต้องกด 2 ครั้ง — กันกดพลาดเพราะปุ่มอยู่ติดกับ "ยกเลิก"/"บันทึก"
   * ส่วนทางกลับ (ปลุกกลับมาทำต่อ) ไม่อันตราย กดครั้งเดียวพอ
   */
  let armed = false;
  // ── ตารางรายการสินค้า (step 3.9) ──
  //
  // ⭐ เพดาน 9 แถวมาจากฟอร์มกระดาษ ไม่ใช่ตัวเลขที่ตั้งขึ้นลอย ๆ
  //    ใส่เกินแล้วตอนพิมพ์ตารางจะทะลุหน้า ฟอร์มเพี้ยนทั้งหน้า
  //    DB ก็บังคับไว้อีกชั้น (check line_no between 1 and 9) เผื่อมีใครยิง API ตรง
  const MAX_PROD = 9;
  const prodBody = q('#prodBody');

  const prodRowHtml = (r = {}) => `
    <tr class="prodrow">
      <td><input type="text" data-f="product" value="${esc(r.product)}"></td>
      <td><input type="text" data-f="amount" inputmode="decimal" value="${esc(r.amount)}"></td>
      <td><input type="text" data-f="price_unit" inputmode="decimal" value="${esc(r.price_unit)}"></td>
      <td><input type="text" data-f="total" inputmode="decimal" value="${esc(r.total)}"></td>
      <td><input type="text" data-f="discount" inputmode="decimal" value="${esc(r.discount)}"></td>
      <td><input type="text" data-f="net" inputmode="decimal" value="${esc(r.net)}"></td>
      <td><input type="text" data-f="note" value="${esc(r.note)}"></td>
      <td><button type="button" class="btn btn-ghost btn-sm" data-rm-prod title="ลบแถวนี้">✕</button></td>
    </tr>`;

  function paintProdHint() {
    const n = prodBody.querySelectorAll('.prodrow').length;
    q('#prodHint').textContent = `${n} / ${MAX_PROD} แถว`;
    q('#prodAdd').disabled = n >= MAX_PROD;
  }

  /**
   * เปิดฟอร์มมาต้องมีแถวว่างให้กรอกได้เลย 1 แถว ไม่ต้องกด "+ เพิ่มแถว" ก่อน
   * (เจ้าของสั่ง 23 ก.ค. 2569 — กดปุ่มก่อนถึงจะกรอกได้ เป็นขั้นตอนที่ไม่จำเป็น)
   * แถวว่างไม่ถูกบันทึกอยู่แล้ว savePendingProducts ทิ้งแถวที่ทุกช่องว่างให้เอง
   */
  const fillProd = (rows) => {
    const list = (rows || []).slice(0, MAX_PROD);
    prodBody.innerHTML = (list.length ? list.map(prodRowHtml) : [prodRowHtml()]).join('');
    paintProdHint();
  };

  if (id) {
    adapter.listPendingProducts(id)
      .then(fillProd)
      .catch(() => fillProd([]));   // ยังไม่ได้รัน phase3-9.sql ก็ยังกรอกหน้าจอได้ ไม่พัง
  } else {
    fillProd([]);
  }

  q('#prodAdd')?.addEventListener('click', () => {
    if (prodBody.querySelectorAll('.prodrow').length >= MAX_PROD) return;
    prodBody.insertAdjacentHTML('beforeend', prodRowHtml());
    paintProdHint();
  });

  prodBody?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-rm-prod]')) return;
    e.target.closest('.prodrow')?.remove();
    paintProdHint();
  });

  // คิด TOTAL / NET ให้อัตโนมัติ แต่พิมพ์ทับได้ (ฟอร์มกระดาษยอมให้ตกลงราคาพิเศษ)
  prodBody?.addEventListener('input', (e) => {
    const f = e.target.dataset?.f;
    if (f !== 'amount' && f !== 'price_unit' && f !== 'discount') return;
    const tr = e.target.closest('.prodrow');
    const g  = (k) => Number(tr.querySelector(`[data-f="${k}"]`).value) || 0;
    const total = g('amount') * g('price_unit');
    if (total) tr.querySelector('[data-f="total"]').value = total;
    const net = (Number(tr.querySelector('[data-f="total"]').value) || 0) - g('discount');
    if (net || total) tr.querySelector('[data-f="net"]').value = net;
  });

  const readProducts = () =>
    [...prodBody.querySelectorAll('.prodrow')].map((tr, i) => {
      const g = (k) => tr.querySelector(`[data-f="${k}"]`).value.trim();
      const nOrNull = (v) => v === '' ? null : Number(v);
      return {
        line_no: i + 1,
        product: g('product') || null,
        amount:     nOrNull(g('amount')),
        price_unit: nOrNull(g('price_unit')),
        total:      nOrNull(g('total')),
        discount:   nOrNull(g('discount')),
        net:        nOrNull(g('net')),
        note: g('note') || null,
      };
    });

  // พิมพ์ตามฟอร์มกระดาษต้นฉบับ / บันทึกเป็น PDF (step 3.9)
  // ⚠️ ต้องดัก error เอง — เป็น async handler ถ้าโยนออกไปจะกลายเป็น unhandled rejection
  //    ที่เงียบสนิท ผู้ใช้กดแล้วไม่มีอะไรเกิดขึ้นและไม่รู้ว่าทำไม
  q('#pPrint')?.addEventListener('click', async () => {
    const b = q('#pPrint');
    b.disabled = true; b.textContent = 'กำลังเตรียม…';
    try {
      await printPending(id);
    } catch (e) {
      fail('พิมพ์ไม่สำเร็จ: ' + e.message);
    } finally {
      b.disabled = false; b.textContent = '🖨 พิมพ์ / PDF';
    }
  });

  const arch = q('#pArch');
  arch?.addEventListener('click', async () => {
    if (!archived && !armed) {
      armed = true;
      arch.textContent = 'กดอีกครั้งเพื่อยืนยัน';
      arch.classList.add('is-armed');
      // ไม่ยืนยันภายใน 4 วินาที = ถือว่ากดพลาด คืนสภาพเดิม
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        arch.textContent = 'Project จบแล้ว — เก็บเข้าคลัง Archives';
        arch.classList.remove('is-armed');
      }, 4000);
      return;
    }
    try {
      await adapter.archivePending(id, !archived);
      close();
      await onSaved();
    } catch (e) { fail(e.message); }
  });

  // ── ลบถาวร (เฉพาะงานที่ archive แล้ว · step 3.11) — กด 2 ครั้งยืนยัน กู้กลับไม่ได้ ──
  let delArmed = false;
  const delBtn = q('#pDelete');
  delBtn?.addEventListener('click', async () => {
    if (!delArmed) {
      delArmed = true;
      delBtn.textContent = 'ลบถาวร? กดอีกครั้ง (กู้กลับไม่ได้)';
      delBtn.classList.add('is-armed');
      setTimeout(() => {
        if (!delArmed) return;
        delArmed = false;
        delBtn.textContent = '🗑 ลบถาวร';
        delBtn.classList.remove('is-armed');
      }, 4000);
      return;
    }
    delBtn.disabled = true; delBtn.textContent = 'กำลังลบ…';
    try {
      await adapter.deletePending(id);
      close();
      await onSaved();
    } catch (e) {
      delBtn.disabled = false; delBtn.textContent = '🗑 ลบถาวร'; delArmed = false;
      delBtn.classList.remove('is-armed');
      fail(e.message);
    }
  });

  q('#lgAdd')?.addEventListener('click', async () => {
    const d = draftLog();
    if (!d) return fail('กรอก RESPONSE หรือ NEXT DOING อย่างน้อยหนึ่งช่อง');
    try {
      await adapter.addFollowLog(d);
      clearDraft();
      await reloadLogs();          // วาดใหม่เฉพาะรายการบันทึก ไม่แตะ 42 ช่องที่กรอกค้างไว้
    } catch (e) { fail(e.message); }
  });
}

// ══════════════════════════════════════════════════════════
// CSV
// ══════════════════════════════════════════════════════════

function exportCsv(rows) {
  const cols = [
    ['pending_no', 'PENDING NO.'], ['project_name', 'ชื่องาน'], ['customer_name', 'ลูกค้า'],
    ['site', 'SITE'], ['value_baht', 'มูลค่า'], ['stage', 'ขั้นตอน'],
    ['close_month', 'เดือนคาดปิด'], ['decision_day', 'DECISION DAY'],
    ['purchased_day', 'PURCHASED DAY'], ['next_action', 'Next action'], ['next_date', 'ทำภายใน'],
  ];

  // ครอบด้วย " เสมอ และ escape " เป็น "" — ข้อมูลไทยมี , ปนบ่อย
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = cols.map(c => cell(c[1])).join(',');
  const body = rows.map(r => cols.map(([k]) =>
    cell(k === 'stage' ? stageOf(r.stage).label : r[k])).join(',')).join('\r\n');

  // ﻿ = BOM · ไม่ใส่แล้ว Excel บน Windows จะอ่านภาษาไทยเป็นตัวยึกยือ
  const blob = new Blob(['﻿' + head + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pending-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
