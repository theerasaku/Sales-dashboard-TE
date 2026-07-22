// F6 — แผนติดต่อลูกค้า / กิจกรรมรายสัปดาห์ (Phase 2.3)
//
// รายการ "สิ่งที่ต้องทำ" ที่ผูกกับงาน Pending หรือลูกค้า Book 3 สี
// จัดกลุ่มตามกำหนดเวลาแทนการเรียงเป็นตารางเดียว — คนขายเปิดมาต้องเห็นทันทีว่า
// อะไรเลยกำหนด อะไรต้องทำวันนี้ โดยไม่ต้องไล่อ่านวันที่ทีละแถว
//
// ⚠️ ใช้ layout เดียวทุกขนาดจอ (รายการ ไม่ใช่ตาราง) จึงไม่มีโหมดการ์ดแยกเหมือน F4/F5

import { adapter } from '../data/adapter.js';
import { dateField, thaiDate, initDatePicker, todayISO, shiftDay } from '../ui/datepicker.js';

// ── ประเภทกิจกรรม ──
// เก็บลง DB เป็น id ไม่ใช่ข้อความไทย (กติกาเดียวกับ stage/color)
// ถ้าเก็บข้อความไทย พอแก้คำเรียกทีหลัง ข้อมูลเก่าจะกรองไม่เจอ
export const ACT_TYPES = [
  { id: 'visit',   icon: '🚗', label: 'เข้าพบ' },
  { id: 'call',    icon: '📞', label: 'โทรติดตาม' },
  { id: 'quote',   icon: '📄', label: 'ส่งใบเสนอราคา' },
  { id: 'present', icon: '📊', label: 'นำเสนอ / สาธิต' },
  { id: 'doc',     icon: '📮', label: 'ส่งเอกสาร' },
  { id: 'bid',     icon: '🏛', label: 'ยื่นซอง / ประมูล' },
  { id: 'other',   icon: '•',  label: 'อื่น ๆ' },
];
const typeOf = (id) => ACT_TYPES.find(t => t.id === id) || null;

const LS_VIEW = 'te-dashboard:act-view';
const DEFAULT_VIEW = { range: 'all', status: 'plan' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function loadView() {
  try { return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem(LS_VIEW) || '{}') }; }
  catch { return { ...DEFAULT_VIEW }; }
}
const saveView = (v) => { try { localStorage.setItem(LS_VIEW, JSON.stringify(v)); } catch {} };

// ══════════════════════════════════════════════════════════
// จัดกลุ่มตามกำหนดเวลา — ฟังก์ชันบริสุทธิ์ ทดสอบง่าย
// dashboard.js เรียกใช้ตัวนี้ด้วย เพื่อให้ตัวเลข "เลยกำหนด" ตรงกันทั้งสองหน้า
// (บทเรียนจาก 1.5: การ์ดกับ funnel นับคนละวิธี แล้วเลขขัดกันบนหน้าเดียว)
// ══════════════════════════════════════════════════════════

export const BUCKETS = [
  { id: 'overdue', label: 'เลยกำหนด',        tone: 'red' },
  { id: 'today',   label: 'วันนี้',           tone: 'accent' },
  { id: 'soon',    label: 'ภายใน 7 วัน',      tone: 'blue' },
  { id: 'later',   label: 'หลังจากนั้น',      tone: 'mute' },
  { id: 'nodate',  label: 'ยังไม่กำหนดวัน',   tone: 'mute' },
  { id: 'done',    label: 'ทำเสร็จแล้ว',      tone: 'green' },
  { id: 'cancel',  label: 'ยกเลิก',           tone: 'mute' },
];

/**
 * งานแม่ถูกเก็บเข้าคลังแล้วหรือยัง (step 2.5)
 *
 * ⚠️ ถ้าไม่เช็กตรงนี้ ผู้ใช้จะโดนเตือน "เลยกำหนด" จากงานที่ปิดไปแล้วตลอดไป
 *    เช่น ปิดการขายสำเร็จ → กดเก็บเข้าคลัง → แต่กิจกรรม "โทรตามใบเสนอราคา"
 *    ที่ผูกไว้ยังค้างอยู่ แล้วขึ้นเตือนทุกวันทั้งที่งานจบไปแล้ว
 *
 * ไม่ได้ไปแก้ข้อมูลกิจกรรม แค่ไม่แสดง — ปลุกงานแม่กลับมา กิจกรรมก็กลับมาเองครบ
 */
export const isParentArchived = (r) =>
  r?.pending_projects?.is_active === false || r?.customers?.is_active === false;

export function bucketize(rows, today = todayISO()) {
  const week = shiftDay(today, 7);
  const out = Object.fromEntries(BUCKETS.map(b => [b.id, []]));

  for (const r of rows || []) {
    if (r.is_active === false) continue;
    if (isParentArchived(r))   continue;
    if (r.status === 'done')   { out.done.push(r);   continue; }
    if (r.status === 'cancel') { out.cancel.push(r); continue; }

    const d = r.due_date || '';
    if (!d)          out.nodate.push(r);
    else if (d < today) out.overdue.push(r);
    else if (d === today) out.today.push(r);
    else if (d <= week)   out.soon.push(r);
    else                  out.later.push(r);
  }
  return out;
}

/** กิจกรรมที่ "ต้องทำแล้ว" = เลยกำหนด + ครบกำหนดวันนี้ (ตัวเลขที่ dashboard เอาไปเตือน) */
export const dueNow = (b) => [...b.overdue, ...b.today];

// ══════════════════════════════════════════════════════════

const linkLabel = (r) => {
  if (r.pending_projects?.project_name) return `▤ ${r.pending_projects.project_name}`;
  if (r.customers?.name) {
    const c = r.customers;
    return `◍ ${c.name}${c.org ? ' · ' + c.org : ''}`;
  }
  return '';
};

function rowHtml(r, bucketId) {
  const t = typeOf(r.act_type);
  const done = r.status === 'done';
  const link = linkLabel(r);
  return `
    <li class="arow ${bucketId === 'overdue' ? 'is-overdue' : ''} ${done ? 'is-done' : ''}
               ${r.status === 'cancel' ? 'is-cancel' : ''}" data-id="${esc(r.id)}">
      <button type="button" class="achk" data-toggle="${esc(r.id)}"
              aria-pressed="${done}"
              title="${done ? 'กดเพื่อกลับไปเป็นยังไม่ทำ' : 'ทำเสร็จแล้ว'}">${done ? '✓' : ''}</button>
      <div class="amain">
        <div class="atitle">${esc(r.title || '(ไม่มีชื่อ)')}</div>
        <div class="ameta">
          ${t ? `<span class="atag">${t.icon} ${esc(t.label)}</span>` : ''}
          ${link ? `<span class="alink" title="${esc(link)}">${esc(link)}</span>` : ''}
          ${r.teams?.code ? `<span class="ateam">${esc(r.teams.code)}</span>` : ''}
        </div>
      </div>
      <div class="adate">${r.due_date ? esc(thaiDate(r.due_date)) : '—'}</div>
    </li>`;
}

export default {
  title: 'แผนติดต่อลูกค้า',
  subtitle: 'สิ่งที่ต้องทำรายสัปดาห์ · เตือนงานเลยกำหนด',

  async render(root) {
    initDatePicker();
    const view = loadView();

    // โหลดรายชื่อไว้ให้ดรอปดาวน์ "ผูกกับ" — โหลดครั้งเดียวตอนเปิดหน้า
    let teams = [], pendings = [], customers = [];
    try { teams = await adapter.listTeams(); } catch {}

    root.innerHTML = `
      <form class="qadd" id="aQuick">
        <input class="inp" id="aqTitle" type="text" autocomplete="off"
               placeholder="เพิ่มสิ่งที่ต้องทำ… เช่น โทรหาคุณสมชาย เรื่องใบเสนอราคา">
        <span class="qadd-date">${dateField('', todayISO(), { id: 'aqDate', label: 'กำหนดวัน' })}</span>
        <button type="submit" class="btn btn-primary btn-sm">+ เพิ่ม</button>
        <button type="button" class="btn btn-ghost btn-sm" id="aFull">รายละเอียด…</button>
      </form>
      <p class="login-err" id="aqErr" role="alert" hidden></p>

      <div class="toolbar toolbar-sub">
        <div class="segmented" id="aRange" role="tablist" aria-label="ช่วงเวลา">
          <button type="button" data-range="all"     class="${view.range === 'all'     ? 'on' : ''}">ทั้งหมด</button>
          <button type="button" data-range="overdue" class="${view.range === 'overdue' ? 'on' : ''}">
            เลยกำหนด <span class="seg-badge" data-count="overdue" hidden></span>
          </button>
          <button type="button" data-range="today"   class="${view.range === 'today'   ? 'on' : ''}">
            วันนี้ <span class="seg-badge" data-count="today" hidden></span>
          </button>
          <button type="button" data-range="week"    class="${view.range === 'week'    ? 'on' : ''}">7 วัน</button>
        </div>

        <div class="segmented" id="aStatus" role="tablist" aria-label="สถานะ">
          <button type="button" data-status="plan" class="${view.status === 'plan' ? 'on' : ''}">ที่ต้องทำ</button>
          <button type="button" data-status="done" class="${view.status === 'done' ? 'on' : ''}">เสร็จแล้ว</button>
          <button type="button" data-status="all"  class="${view.status === 'all'  ? 'on' : ''}">ทั้งหมด</button>
        </div>

        <button class="btn btn-ghost btn-sm" id="aCsv">⭳ CSV</button>
      </div>

      <div class="sum" id="aSum"></div>
      <div id="aList"><div class="skeleton">กำลังโหลด…</div></div>
      <div id="aPanel"></div>`;

    const $ = (id) => root.querySelector('#' + id);
    const listEl = $('aList');
    let rows = [], buckets = null, hidden = 0;

    async function reload() {
      saveView(view);
      try {
        rows = await adapter.listActivities({
          status: view.status === 'all' ? undefined : view.status,
          limit: 500,
        });
      } catch (e) {
        const missing = /does not exist|42P01|relation/i.test(e.message);
        listEl.innerHTML = `<div class="empty">
            <strong>${missing ? 'ยังไม่ได้สร้างตารางกิจกรรม' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
            ${missing ? 'เอาไฟล์ <code>db/phase2.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                      : esc(e.message)}
          </div>`;
        $('aSum').textContent = '';
        return;
      }
      buckets = bucketize(rows);
      hidden  = rows.filter(isParentArchived).length;
      paint();
      refreshCounts();
    }

    /** ป้ายจำนวนบนแถบ — นับจากงานที่ยังไม่ทำเสมอ ไม่ว่าตอนนี้กรองอะไรอยู่ */
    async function refreshCounts() {
      try {
        const plan = await adapter.listActivities({ status: 'plan', limit: 1000 });
        const b = bucketize(plan);
        for (const k of ['overdue', 'today']) {
          const el = root.querySelector(`[data-count="${k}"]`);
          if (el) { el.textContent = b[k].length; el.hidden = b[k].length === 0; }
        }
      } catch { /* นับไม่ได้ไม่เป็นไร */ }
    }

    /** กลุ่มที่จะแสดง ตามช่วงเวลาที่เลือก */
    function visibleBuckets() {
      if (view.range === 'overdue') return ['overdue'];
      if (view.range === 'today')   return ['today'];
      if (view.range === 'week')    return ['overdue', 'today', 'soon'];
      return BUCKETS.map(b => b.id);
    }

    /**
     * บอกให้รู้ว่ามีของถูกซ่อนอยู่ — ห้ามซ่อนเงียบ ๆ
     * ผู้ใช้ที่เพิ่งเก็บงานเข้าคลังต้องเข้าใจว่ากิจกรรมหายไปไหน ไม่ใช่คิดว่าข้อมูลหาย
     */
    function hiddenNote() {
      if (!hidden) return '';
      return `<p class="sec-foot">ซ่อน ${hidden} รายการที่อยู่ในงาน/ลูกค้าซึ่งเก็บเข้าคลังไปแล้ว —
              ปลุกงานนั้นกลับมา รายการจะกลับมาเองครบ</p>`;
    }

    function paint() {
      const show = visibleBuckets().filter(id => buckets[id].length);
      const total = show.reduce((a, id) => a + buckets[id].length, 0);

      $('aSum').innerHTML = total
        ? `พบ <b>${total}</b> กิจกรรม` +
          (buckets.overdue.length && show.includes('overdue')
            ? ` · <span class="sum-risk">เลยกำหนด <b>${buckets.overdue.length}</b></span>` : '')
        : '';

      if (!total) {
        const filtered = view.range !== 'all' || view.status !== 'plan';
        // ถ้าที่เหลือทั้งหมดถูกซ่อนเพราะงานแม่เก็บเข้าคลัง ต้องไม่บอกว่า "ยังไม่มีกิจกรรม"
        // ไม่งั้นข้อความจะขัดกันเอง — บอกว่าไม่มี แต่บรรทัดล่างบอกว่าซ่อนไว้ 1 รายการ
        const allHidden = !filtered && hidden > 0;
        listEl.innerHTML = `<div class="empty">
            <strong>${allHidden ? 'ไม่มีอะไรต้องทำแล้ว'
                     : filtered ? 'ไม่มีกิจกรรมที่ตรงกับเงื่อนไข' : 'ยังไม่มีกิจกรรม'}</strong>
            ${allHidden ? `กิจกรรมที่เหลือ ${hidden} รายการอยู่ในงาน/ลูกค้าที่เก็บเข้าคลังไปแล้ว`
                        : filtered ? 'ลองเปลี่ยนตัวกรองด้านบน'
                        : 'พิมพ์สิ่งที่ต้องทำในช่องด้านบนแล้วกด "+ เพิ่ม" ได้เลย'}
          </div>` + (allHidden ? '' : hiddenNote());
        return;
      }

      listEl.innerHTML = show.map(id => {
        const b = BUCKETS.find(x => x.id === id);
        return `
          <section class="agrp">
            <h3 class="agrp-h agrp-${b.tone}">
              ${esc(b.label)} <span class="agrp-n">${buckets[id].length}</span>
            </h3>
            <ul class="alist">${buckets[id].map(r => rowHtml(r, id)).join('')}</ul>
          </section>`;
      }).join('') + hiddenNote();
    }

    // ── เหตุการณ์ ──
    root.querySelectorAll('#aRange [data-range]').forEach(b => {
      b.addEventListener('click', () => {
        view.range = b.dataset.range;
        root.querySelectorAll('#aRange [data-range]').forEach(x => x.classList.toggle('on', x === b));
        saveView(view);
        paint();                       // กรองในหน่วยความจำ ไม่ต้องยิงเซิร์ฟเวอร์ใหม่
      });
    });

    root.querySelectorAll('#aStatus [data-status]').forEach(b => {
      b.addEventListener('click', () => {
        view.status = b.dataset.status;
        root.querySelectorAll('#aStatus [data-status]').forEach(x => x.classList.toggle('on', x === b));
        reload();                      // เปลี่ยนสถานะ = ชุดข้อมูลคนละชุด ต้องโหลดใหม่
      });
    });

    listEl.addEventListener('click', async (e) => {
      const tg = e.target.closest('[data-toggle]');
      if (tg) {
        e.stopPropagation();
        return toggleDone(tg.dataset.toggle);
      }
      const hit = e.target.closest('[data-id]');
      if (hit) openDetail(root.querySelector('#aPanel'), findRow(hit.dataset.id), reload, teams, pickLists);
    });

    const findRow = (id) => rows.find(r => String(r.id) === String(id)) || null;

    /** ติ๊กเสร็จ/ยกเลิกติ๊ก — อัปเดตในที่ทันที ไม่ต้องรอโหลดทั้งหน้า */
    async function toggleDone(id) {
      const r = findRow(id);
      if (!r) return;
      const next = r.status === 'done' ? 'plan' : 'done';
      const el = listEl.querySelector(`[data-toggle="${CSS.escape(String(id))}"]`);
      if (el) el.disabled = true;
      try {
        await adapter.saveActivity({ id, status: next });
        await reload();
      } catch (err) {
        if (el) el.disabled = false;
        showErr(err.message);
      }
    }

    const showErr = (m) => {
      const el = $('aqErr');
      el.textContent = m;
      el.hidden = false;
      setTimeout(() => { el.hidden = true; }, 6000);
    };

    // ── เพิ่มเร็ว ── (สิ่งที่ใช้บ่อยที่สุดในหน้านี้ ต้องไม่ต้องเปิด modal)
    $('aQuick').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = $('aqTitle').value.trim();
      if (!title) return showErr('พิมพ์สิ่งที่ต้องทำก่อน');
      const btn = ev.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await adapter.saveActivity({
          title,
          due_date: root.querySelector('#aqDate')?.value || null,
          status: 'plan',
        });
        $('aqTitle').value = '';
        await reload();
      } catch (e) { showErr(e.message); }
      btn.disabled = false;
    });

    $('aFull').addEventListener('click', () =>
      openDetail(root.querySelector('#aPanel'), null, reload, teams, pickLists, $('aqTitle').value.trim()));

    $('aCsv').addEventListener('click', () => exportCsv(rows));

    /** โหลดรายชื่องาน/ลูกค้าให้ดรอปดาวน์ — เรียกตอนเปิด modal ครั้งแรกเท่านั้น */
    async function pickLists() {
      if (!pendings.length) {
        try { pendings = await adapter.listPending({ status: 'active', limit: 500 }); } catch {}
      }
      if (!customers.length) {
        try { customers = await adapter.listCustomers({ status: 'active', limit: 500 }); } catch {}
      }
      return { pendings, customers };
    }

    await reload();
  },
};

// ══════════════════════════════════════════════════════════
// ฟอร์มเต็ม
// ══════════════════════════════════════════════════════════

async function openDetail(host, row, onSaved, teams, pickLists, presetTitle = '') {
  host.innerHTML = '<div class="modal"><div class="modal-box modal-sm"><div class="skeleton">กำลังโหลด…</div></div></div>';
  const { pendings, customers } = await pickLists();

  const id = row?.id || null;
  const v = (k, d = '') => row?.[k] ?? d;

  host.innerHTML = `
    <div class="modal" id="aModal">
      <form class="modal-box modal-sm" id="aForm">
        <div class="modal-head">
          <strong>${id ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="aClose">ปิด</button>
        </div>

        <div class="modal-body">
          <div class="fgrid">
            <label class="fld fld-wide"><span>สิ่งที่ต้องทำ *</span>
              <input type="text" name="title" value="${esc(row?.title || presetTitle)}" required></label>

            <label class="fld"><span>ประเภท</span>
              <select name="act_type">
                <option value="">— ไม่ระบุ —</option>
                ${ACT_TYPES.map(t => `<option value="${t.id}" ${v('act_type') === t.id ? 'selected' : ''}>
                  ${t.icon} ${esc(t.label)}</option>`).join('')}
              </select></label>

            <label class="fld"><span>กำหนดทำภายใน</span>
              ${dateField('due_date', v('due_date'), { label: 'กำหนดทำภายใน' })}</label>

            <label class="fld"><span>ผูกกับงาน (Pending Project)</span>
              <select name="pending_id">
                <option value="">— ไม่ผูก —</option>
                ${pendings.map(p => `<option value="${esc(p.id)}" ${v('pending_id') === p.id ? 'selected' : ''}>
                  ${esc(p.project_name || '(ไม่มีชื่อ)')}</option>`).join('')}
              </select></label>

            <label class="fld"><span>ผูกกับลูกค้า (Book 3 สี)</span>
              <select name="customer_id">
                <option value="">— ไม่ผูก —</option>
                ${customers.map(c => `<option value="${esc(c.id)}" ${v('customer_id') === c.id ? 'selected' : ''}>
                  ${esc(c.name)}${c.org ? ' · ' + esc(c.org) : ''}</option>`).join('')}
              </select></label>

            <label class="fld"><span>สถานะ</span>
              <select name="status">
                <option value="plan"   ${v('status', 'plan') === 'plan'   ? 'selected' : ''}>ยังไม่ได้ทำ</option>
                <option value="done"   ${v('status') === 'done'   ? 'selected' : ''}>ทำเสร็จแล้ว</option>
                <option value="cancel" ${v('status') === 'cancel' ? 'selected' : ''}>ยกเลิก</option>
              </select></label>

            <label class="fld"><span>ทีม</span>
              <select name="team_id">
                <option value="">— ทีมของฉัน —</option>
                ${teams.map(t => `<option value="${esc(t.id)}" ${v('team_id') === t.id ? 'selected' : ''}>
                  ${esc(t.code)}</option>`).join('')}
              </select></label>

            <label class="fld fld-wide"><span>รายละเอียด</span>
              <textarea name="detail" rows="3">${esc(v('detail'))}</textarea></label>
          </div>
          ${row?.done_at ? `<p class="sec-foot">ทำเสร็จเมื่อ ${esc(thaiDate(String(row.done_at).slice(0, 10)))}</p>` : ''}
        </div>

        <p class="login-err" id="aErr" role="alert" hidden></p>

        <div class="modal-foot">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="aCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="aSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  const fail = (m) => { q('#aErr').textContent = m; q('#aErr').hidden = false; };

  q('#aClose').addEventListener('click', close);
  q('#aCancel').addEventListener('click', close);
  q('#aModal').addEventListener('mousedown', (e) => { if (e.target.id === 'aModal') close(); });

  q('#aForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#aErr').hidden = true;

    const payload = Object.fromEntries(new FormData(ev.target).entries());
    if (id) payload.id = id;
    if (!String(payload.title || '').trim()) return fail('พิมพ์สิ่งที่ต้องทำก่อน');

    const btn = q('#aSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.saveActivity(payload);
      close();
      await onSaved();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ══════════════════════════════════════════════════════════

function exportCsv(rows) {
  const cols = [
    ['due_date', 'กำหนดวัน'], ['title', 'สิ่งที่ต้องทำ'], ['act_type', 'ประเภท'],
    ['status', 'สถานะ'], ['link', 'ผูกกับ'], ['detail', 'รายละเอียด'],
  ];
  const ST = { plan: 'ยังไม่ได้ทำ', done: 'ทำเสร็จแล้ว', cancel: 'ยกเลิก' };
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const val = (r, k) =>
    k === 'act_type' ? (typeOf(r.act_type)?.label || '')
    : k === 'status' ? (ST[r.status] || r.status || '')
    : k === 'link'   ? linkLabel(r).replace(/^[▤◍]\s*/, '')
    : r[k];

  const body = rows.map(r => cols.map(([k]) => cell(val(r, k))).join(',')).join('\r\n');

  // ﻿ = BOM · ไม่ใส่แล้ว Excel บน Windows อ่านไทยเป็นตัวยึกยือ
  const blob = new Blob(['﻿' + cols.map(c => cell(c[1])).join(',') + '\r\n' + body],
                        { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `activities-${todayISO()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
