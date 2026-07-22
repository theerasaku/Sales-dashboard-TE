// F5 — Book 3 สี (Phase 2.2)
//
// สมุดลูกค้ารายบุคคล แบ่ง 3 สีตามความสนิท — ยกโครงจากฟอร์มกระดาษ BOOK 3 สี 2 หน้า
// ใช้คอมโพเนนต์ร่วมกับ Pending Project: ปฏิทิน (ui/datepicker) · รายการบันทึก (ui/loglist)

import { adapter } from '../data/adapter.js';
import { dateField, thaiDate, initDatePicker } from '../ui/datepicker.js';
import { logListHtml, bindLogEditing, logFormHtml, readLogForm, clearLogForm } from '../ui/loglist.js';

// ── สี 3 ระดับ ── (ความหมายจากฟอร์มกระดาษ)
export const COLORS = [
  { id: 'green',  dot: '🟢', label: 'สนิท / ซื้อประจำ',      short: 'เขียว' },
  { id: 'yellow', dot: '🟡', label: 'ซื้อบ้าง / มีโอกาส',     short: 'เหลือง' },
  { id: 'red',    dot: '🔴', label: 'เพิ่งเริ่ม / โอกาสน้อย', short: 'แดง' },
];
const colorOf = (id) => COLORS.find(c => c.id === id) || COLORS[2];

const LS_VIEW = 'te-dashboard:book3-view';
const DEFAULT_VIEW = { color: '', search: '', status: 'active', sort: 'updated_at', dir: 'desc' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function loadView() {
  try { return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem(LS_VIEW) || '{}') }; }
  catch { return { ...DEFAULT_VIEW }; }
}
const saveView = (v) => { try { localStorage.setItem(LS_VIEW, JSON.stringify(v)); } catch {} };

/** อายุจากวันเกิด — ฟอร์มกระดาษมีช่อง AGE แต่ไม่ต้องเก็บ คำนวณเอาตอนแสดง */
function ageOf(birthday) {
  if (!birthday) return '';
  const b = new Date(birthday);
  if (isNaN(b)) return '';
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? `${a} ปี` : '';
}

const lastLogCell = (r) => {
  const l = r.last_log;
  const btn = `<button type="button" class="btn-log" data-log="${esc(r.id)}"
                 title="บันทึกการติดตามวันนี้">＋ บันทึก</button>`;
  if (!l) return `<div class="lastlog"><span class="nolog">— ยังไม่มีบันทึก —</span>${btn}</div>`;
  const text = l.response || l.next_doing || '';
  return `<div class="lastlog">
    <div class="lastlog-txt">
      <span class="lastlog-h">${esc(thaiDate(l.log_date) || l.log_date || '')}${l.by_name ? ' · ' + esc(l.by_name) : ''}</span>
      <span class="lastlog-t" title="${esc(text)}">${esc(text)}</span>
    </div>${btn}
  </div>`;
};

export default {
  title: 'Book 3 สี',
  subtitle: '🟢 สนิท/ซื้อประจำ · 🟡 มีโอกาส · 🔴 เพิ่งเริ่ม',

  async render(root) {
    initDatePicker();
    const view = loadView();
    let teams = [];
    try { teams = await adapter.listTeams(); } catch { /* ไม่มีทีมก็ยังใช้ได้ */ }

    root.innerHTML = `
      <div class="toolbar">
        <input class="inp inp-search" id="bSearch" type="search"
               placeholder="ค้นหาชื่อ / หน่วยงาน / เบอร์โทร…"
               value="${esc(view.search)}" autocapitalize="off" spellcheck="false">
        <button class="btn btn-primary btn-sm" id="bNew">+ เพิ่มลูกค้า</button>
      </div>

      <div class="toolbar toolbar-sub">
        <div class="segmented" id="bColor" role="tablist" aria-label="สีความสัมพันธ์">
          <button type="button" data-color="" class="${!view.color ? 'on' : ''}">ทุกสี</button>
          ${COLORS.map(c => `
            <button type="button" data-color="${c.id}" class="${view.color === c.id ? 'on' : ''}"
                    title="${esc(c.label)}">${c.dot} ${esc(c.short)}
              <span class="seg-badge" data-count="${c.id}" hidden></span>
            </button>`).join('')}
        </div>

        <div class="segmented" id="bStatus" role="tablist" aria-label="สถานะ">
          <button type="button" data-status="active"   class="${view.status === 'active'   ? 'on' : ''}">ที่ติดต่ออยู่</button>
          <button type="button" data-status="archived" class="${view.status === 'archived' ? 'on' : ''}">
            Archive <span class="seg-badge" id="bArcCount" hidden></span>
          </button>
          <button type="button" data-status="all"      class="${view.status === 'all'      ? 'on' : ''}">ทั้งหมด</button>
        </div>

        <button class="btn btn-ghost btn-sm" id="bCsv">⭳ CSV</button>
      </div>

      <div class="sum" id="bSum"></div>
      <div id="bList"><div class="skeleton">กำลังโหลด…</div></div>
      <div id="bPanel"></div>`;

    const $ = (id) => root.querySelector('#' + id);
    const listEl = $('bList');
    let rows = [];

    async function reload() {
      saveView(view);
      listEl.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';
      try {
        rows = await adapter.listCustomers({
          status: view.status,
          color:  view.color  || undefined,
          search: view.search || undefined,
          sort: view.sort, dir: view.dir,
        });
      } catch (e) {
        // ยังไม่ได้รัน db/phase2.sql → ตารางยังไม่มี ต้องบอกให้ชัดว่าต้องทำอะไร
        const missing = /does not exist|42P01|relation/i.test(e.message);
        listEl.innerHTML = `<div class="empty">
            <strong>${missing ? 'ยังไม่ได้สร้างตารางลูกค้า' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
            ${missing ? 'เอาไฟล์ <code>db/phase2.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                      : esc(e.message)}
          </div>`;
        $('bSum').textContent = '';
        return;
      }
      paint();
      refreshCounts();
    }

    /** ป้ายจำนวนบนแถบสี + Archive — เห็นภาพรวมโดยไม่ต้องกดเข้าไปทีละแถบ */
    async function refreshCounts() {
      try {
        const all = await adapter.listCustomers({ status: 'active', limit: 2000 });
        for (const c of COLORS) {
          const el = root.querySelector(`[data-count="${c.id}"]`);
          const n = all.filter(r => r.color === c.id).length;
          if (el) { el.textContent = n; el.hidden = n === 0; }
        }
        const arc = await adapter.countCustomers('archived');
        const ae = $('bArcCount');
        if (ae) { ae.textContent = arc; ae.hidden = arc === 0; }
      } catch { /* นับไม่ได้ไม่เป็นไร ไม่ใช่ข้อมูลสำคัญ */ }
    }

    function paint() {
      $('bSum').innerHTML = rows.length
        ? `พบ <b>${rows.length}</b> ราย` +
          COLORS.map(c => {
            const n = rows.filter(r => r.color === c.id).length;
            return n ? ` · ${c.dot} <b>${n}</b>` : '';
          }).join('')
        : '';

      if (!rows.length) {
        const filtered = view.search || view.color;
        listEl.innerHTML = `<div class="empty">
            <strong>ยังไม่มีลูกค้าที่ตรงกับเงื่อนไข</strong>
            ${filtered ? 'ลองล้างตัวกรอง หรือกด "+ เพิ่มลูกค้า"'
                       : 'กด "+ เพิ่มลูกค้า" เพื่อเริ่มบันทึกรายแรก'}
          </div>`;
        return;
      }

      listEl.innerHTML = `
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th style="min-width:60px">สี</th>
              <th data-sort="name" style="min-width:200px">ชื่อ${view.sort === 'name' ? (view.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th data-sort="org" style="min-width:170px">หน่วยงาน${view.sort === 'org' ? (view.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th style="min-width:150px">ตำแหน่ง</th>
              <th style="min-width:140px">ติดต่อ</th>
              <th style="min-width:110px">ผู้ดูแล</th>
              <th style="min-width:240px" class="nosort">การติดตามล่าสุด</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr data-id="${esc(r.id)}" class="${r.is_active === false ? 'is-archived' : ''}">
                  <td><span class="b3dot" title="${esc(colorOf(r.color).label)}">${colorOf(r.color).dot}</span></td>
                  <td>${esc(r.name)}${r.birthday ? `<div class="t2">${esc(ageOf(r.birthday))}</div>` : ''}</td>
                  <td>${esc(r.org || '')}</td>
                  <td>${esc(r.position || '')}</td>
                  <td>${esc(r.tel || '')}${r.email ? `<div class="t2">${esc(r.email)}</div>` : ''}</td>
                  <td>${esc(r.sale_name || r.teams?.code || '')}</td>
                  <td>${lastLogCell(r)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="cards">
          ${rows.map(r => `
            <div class="pcard" data-id="${esc(r.id)}" role="button" tabindex="0">
              <div class="pcard-top">
                <strong>${colorOf(r.color).dot} ${esc(r.name)}</strong>
              </div>
              <div class="pcard-mid">${esc(r.position || '')}${r.org ? ' · ' + esc(r.org) : ''}</div>
              <div class="pcard-bot">
                <span>${esc(r.tel || '—')}</span>
                <span>${esc(r.sale_name || r.teams?.code || '')}</span>
              </div>
              <div class="pcard-log">${lastLogCell(r)}</div>
            </div>`).join('')}
        </div>`;
    }

    // ── เหตุการณ์ ──
    let t = null;
    $('bSearch').addEventListener('input', (e) => {
      clearTimeout(t);
      view.search = e.target.value;
      t = setTimeout(reload, 300);
    });

    root.querySelectorAll('#bColor [data-color]').forEach(b => {
      b.addEventListener('click', () => {
        view.color = b.dataset.color;
        root.querySelectorAll('#bColor [data-color]').forEach(x => x.classList.toggle('on', x === b));
        reload();
      });
    });

    root.querySelectorAll('#bStatus [data-status]').forEach(b => {
      b.addEventListener('click', () => {
        view.status = b.dataset.status;
        root.querySelectorAll('#bStatus [data-status]').forEach(x => x.classList.toggle('on', x === b));
        reload();
      });
    });

    listEl.addEventListener('click', (e) => {
      const lg = e.target.closest('[data-log]');
      if (lg) { e.stopPropagation(); return openQuickLog(root.querySelector('#bPanel'), lg.dataset.log, reload); }

      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        if (view.sort === k) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
        else { view.sort = k; view.dir = 'asc'; }
        return reload();
      }

      const hit = e.target.closest('[data-id]');
      if (hit) openDetail(root.querySelector('#bPanel'), hit.dataset.id, reload, teams);
    });

    listEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.pcard');
      if (!card) return;
      e.preventDefault();
      openDetail(root.querySelector('#bPanel'), card.dataset.id, reload, teams);
    });

    $('bNew').addEventListener('click', () => openDetail(root.querySelector('#bPanel'), null, reload, teams));
    $('bCsv').addEventListener('click', () => exportCsv(rows));

    await reload();
  },
};

// ══════════════════════════════════════════════════════════
// บันทึกการติดตามเร็ว
// ══════════════════════════════════════════════════════════

async function openQuickLog(host, customerId, onSaved) {
  let row = null;
  try { row = await adapter.getCustomer(customerId); } catch { /* ยังบันทึกได้ */ }
  const logs = row?.customer_logs || [];
  const me = await whoAmI();

  host.innerHTML = `
    <div class="modal" id="bqModal">
      <form class="modal-box modal-sm" id="bqForm">
        <div class="modal-head">
          <strong>บันทึกการติดตาม</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="bqClose">ปิด</button>
        </div>
        <div class="modal-body">
          <p class="q-sub">${esc(row?.name || '')}${row?.org ? ' · ' + esc(row.org) : ''}</p>
          ${logFormHtml('bq')}
          ${logs.length ? `<h3 class="q-h3">ประวัติที่ผ่านมา (${logs.length})</h3>
            <ul class="loglist" id="bqLogList">${logListHtml(logs, me)}</ul>` : ''}
        </div>
        <p class="login-err" id="bqErr" role="alert" hidden></p>
        <div class="modal-foot">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="bqCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="bqSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  const fail = (m) => { q('#bqErr').textContent = m; q('#bqErr').hidden = false; };

  q('#bqClose').addEventListener('click', close);
  q('#bqCancel').addEventListener('click', close);
  q('#bqModal').addEventListener('mousedown', (e) => { if (e.target.id === 'bqModal') close(); });

  // วาดใหม่เฉพาะรายการประวัติ ไม่แตะสิ่งที่พิมพ์ค้างไว้ด้านบน
  async function reloadLogs() {
    let fresh = [];
    try { fresh = await adapter.listCustomerLogs(customerId); } catch { return; }
    const ul = q('#bqLogList');
    if (!ul) return;
    ul.innerHTML = logListHtml(fresh, me);
    bindLogEditing(ul, fresh, adapter.updateCustomerLog, reloadLogs);
    await onSaved();
  }
  if (logs.length) bindLogEditing(q('#bqLogList'), logs, adapter.updateCustomerLog, reloadLogs);

  q('#bqForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#bqErr').hidden = true;
    const d = readLogForm(host, 'bq');
    if (!d) return fail('กรอก RESPONSE หรือ NEXT DOING อย่างน้อยหนึ่งช่อง');

    const btn = q('#bqSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.addCustomerLog({ ...d, customer_id: customerId });
      close();
      await onSaved();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

async function whoAmI() {
  try { return (await adapter.getSession())?.user || null; } catch { return null; }
}

// ══════════════════════════════════════════════════════════
// ฟอร์มเต็ม — ตามฟอร์มกระดาษ BOOK 3 สี
// ══════════════════════════════════════════════════════════

const FORM = [
  { group: 'ข้อมูลลูกค้า', fields: [
    ['no',       'No. (รหัสในสมุด)', 'text'],
    ['name',     'ชื่อ-สกุล *',       'text'],
    ['position', 'POSITION (ตำแหน่ง)', 'text'],
    ['org',      'หน่วยงาน / บริษัท',  'text'],
    ['birthday', 'BIRTHDAY (วันเกิด)', 'date'],
    ['tel',      'TELEPHONE',         'tel'],
    ['email',    'EMAIL',             'email'],
  ]},
  { group: 'ที่อยู่', fields: [
    ['addr_office',   'ADDRESS (ที่ทำงาน)', 'area'],
    ['addr_home',     'ADDRESS (บ้าน)',     'area'],
    ['addr_hometown', 'ภูมิลำเนา',          'area'],
  ]},
  { group: 'ข้อมูลส่วนตัว (ใช้สร้างความสัมพันธ์)', fields: [
    ['education', 'EDUCATION (การศึกษา)',            'area'],
    ['family',    'FAMILY (คู่สมรส / บุตร / อื่น ๆ)', 'area'],
    ['hobby',     'HOBBY (งานอดิเรก)',               'text'],
    ['favorite',  'FAVORITE (ของชอบ)',               'text'],
  ]},
  { group: 'การจัดกลุ่ม & ผู้ดูแล', fields: [
    ['color',     'สีความสัมพันธ์', 'color'],
    ['sale_name', 'ชื่อ sale ผู้ดูแล', 'text'],
    ['team_id',   'ทีม',            'team'],
  ]},
];

function fieldHtml([key, label, type], row, teams) {
  const v = row?.[key] ?? '';

  if (type === 'area')
    return `<label class="fld fld-wide"><span>${esc(label)}</span>
      <textarea name="${key}" rows="2">${esc(v)}</textarea></label>`;

  if (type === 'date')
    return `<label class="fld"><span>${esc(label)}</span>${dateField(key, v, { label })}</label>`;

  if (type === 'color')
    return `<label class="fld"><span>${esc(label)}</span><select name="${key}">
      ${COLORS.map(c => `<option value="${c.id}" ${v === c.id ? 'selected' : ''}>${c.dot} ${esc(c.label)}</option>`).join('')}
    </select></label>`;

  if (type === 'team')
    return `<label class="fld"><span>${esc(label)}</span><select name="${key}">
      <option value="">— ยังไม่ระบุ —</option>
      ${teams.map(t => `<option value="${esc(t.id)}" ${v === t.id ? 'selected' : ''}>${esc(t.code)}</option>`).join('')}
    </select></label>`;

  const t = type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text';
  const extra = type === 'email' ? ' autocapitalize="off" spellcheck="false"'
              : type === 'tel'   ? ' inputmode="tel"' : '';
  return `<label class="fld"><span>${esc(label)}</span>
    <input type="${t}" name="${key}" value="${esc(v)}"${extra}></label>`;
}

async function openDetail(host, id, onSaved, teams) {
  let row = null;
  if (id) {
    host.innerHTML = '<div class="modal"><div class="modal-box"><div class="skeleton">กำลังโหลด…</div></div></div>';
    try { row = await adapter.getCustomer(id); }
    catch (e) {
      host.innerHTML = `<div class="modal"><div class="modal-box">
        <div class="empty">เปิดข้อมูลลูกค้าไม่ได้ — ${esc(e.message)}</div></div></div>`;
      return;
    }
  }

  const logs = row?.customer_logs || [];
  const me = await whoAmI();
  const archived = row?.is_active === false;

  host.innerHTML = `
    <div class="modal" id="bModal">
      <form class="modal-box" id="bForm">
        <div class="modal-head">
          <strong>${id ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</strong>
          ${archived ? '<span class="tag" style="--tag-c:var(--text-mute)">เก็บเข้าคลังแล้ว</span>' : ''}
          <button type="button" class="btn btn-ghost btn-sm" id="bClose">ปิด</button>
        </div>

        <div class="modal-body">
          ${FORM.map(g => `
            <section class="fgroup">
              <h3>${esc(g.group)}</h3>
              <div class="fgrid">${g.fields.map(f => fieldHtml(f, row, teams)).join('')}</div>
            </section>`).join('')}

          <section class="fgroup">
            <h3>บันทึกการติดตาม ${id ? `(<span id="bLogCount">${logs.length}</span>)` : ''}</h3>
            ${id ? `
              ${logFormHtml('bl')}
              <div class="lg-add-row">
                <button type="button" class="btn btn-ghost btn-sm" id="blAdd">+ เพิ่มบันทึก</button>
                <span class="lg-hint">หรือกด "บันทึก" ด้านล่างก็เก็บให้เหมือนกัน</span>
              </div>
              <ul class="loglist" id="bLogList">${logListHtml(logs, me)}</ul>`
            : `<div class="empty" style="padding:20px">
                 บันทึกการติดตามเพิ่มได้หลังกด "บันทึก" ลูกค้ารายนี้แล้ว
               </div>`}
          </section>
        </div>

        <p class="login-err" id="bErr" role="alert" hidden></p>

        <div class="modal-foot">
          ${id ? `
            <button type="button" class="btn btn-ghost btn-sm" id="bToPending"
                    title="สร้างงานใหม่ในแถบ Pending Project จากลูกค้ารายนี้">↗ ยกขึ้นเป็น Pending Project</button>
            <button type="button" id="bArch"
                    class="btn btn-sm ${archived ? 'btn-ghost' : 'btn-danger'}">
              ${archived ? '↩ ดึงกลับมาติดต่อต่อ' : 'ไม่ติดต่อแล้ว — เก็บเข้าคลัง'}
            </button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="bCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="bSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  const fail = (m) => { q('#bErr').textContent = m; q('#bErr').hidden = false; };

  q('#bClose').addEventListener('click', close);
  q('#bCancel').addEventListener('click', close);

  async function reloadLogs() {
    let fresh = [];
    try { fresh = await adapter.listCustomerLogs(id); } catch { return; }
    const ul = q('#bLogList');
    if (!ul) return;
    ul.innerHTML = logListHtml(fresh, me);
    const cnt = q('#bLogCount');
    if (cnt) cnt.textContent = fresh.length;
    bindLogEditing(ul, fresh, adapter.updateCustomerLog, reloadLogs);
    await onSaved();
  }
  if (id) bindLogEditing(q('#bLogList'), logs, adapter.updateCustomerLog, reloadLogs);

  q('#blAdd')?.addEventListener('click', async () => {
    const d = readLogForm(host, 'bl');
    if (!d) return fail('กรอก RESPONSE หรือ NEXT DOING อย่างน้อยหนึ่งช่อง');
    try {
      await adapter.addCustomerLog({ ...d, customer_id: id });
      clearLogForm(host, 'bl');
      await reloadLogs();
    } catch (e) { fail(e.message); }
  });

  q('#bForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#bErr').hidden = true;

    const payload = Object.fromEntries(new FormData(ev.target).entries());
    if (id) payload.id = id;
    if (!String(payload.name || '').trim()) return fail('กรอกชื่อลูกค้าก่อน');

    const btn = q('#bSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const saved = await adapter.saveCustomer(payload);
      // บันทึกที่พิมพ์ค้างไว้แต่ยังไม่กด "+ เพิ่มบันทึก" ต้องถูกเก็บด้วย
      const cid = id || saved?.id;
      const d = readLogForm(host, 'bl');
      if (d && cid) await adapter.addCustomerLog({ ...d, customer_id: cid });
      close();
      await onSaved();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  // เก็บเข้าคลัง — ต้องกด 2 ครั้ง (กติกาเดียวกับ Pending Project)
  let armed = false;
  const arch = q('#bArch');
  arch?.addEventListener('click', async () => {
    if (!archived && !armed) {
      armed = true;
      arch.textContent = 'กดอีกครั้งเพื่อยืนยัน';
      arch.classList.add('is-armed');
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        arch.textContent = 'ไม่ติดต่อแล้ว — เก็บเข้าคลัง';
        arch.classList.remove('is-armed');
      }, 4000);
      return;
    }
    try {
      await adapter.archiveCustomer(id, !archived);
      close();
      await onSaved();
    } catch (e) { fail(e.message); }
  });

  // ── ยกลูกค้าขึ้นเป็น Pending Project ──
  q('#bToPending')?.addEventListener('click', async () => {
    const name = q('[name="name"]').value.trim();
    const org  = q('[name="org"]').value.trim();
    const btn  = q('#bToPending');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง…';
    try {
      const p = await adapter.savePending({
        project_name:  `งานของ ${org || name}`,
        customer_name: org || name,
        stage:         'lead',
        value_baht:    0,
        team_id:       q('[name="team_id"]').value || null,
        // โยงกลับมาที่ลูกค้ารายนี้ให้รู้ว่างานมาจากไหน
        lead_source:   'Book 3 สี',
        customer_needs: `ผู้ติดต่อ: ${name}${q('[name="position"]').value ? ' (' + q('[name="position"]').value + ')' : ''}`,
      });
      // ยกผู้ติดต่อไปเป็น CONTACT TO 1 ของงานนั้นด้วย
      if (p?.id) {
        await adapter.saveContacts(p.id, [{
          slot: 1,
          name,
          status: q('[name="position"]').value.trim() || null,
          phone:  q('[name="tel"]').value.trim() || null,
          email:  q('[name="email"]').value.trim() || null,
        }, { slot: 2 }, { slot: 3 }]);
      }
      btn.textContent = '✓ สร้างแล้ว — ดูในแถบ Pending Project';
      btn.classList.add('is-done');
    } catch (e) {
      fail('สร้างงานไม่สำเร็จ: ' + e.message);
      btn.disabled = false; btn.textContent = '↗ ยกขึ้นเป็น Pending Project';
    }
  });
}

// ══════════════════════════════════════════════════════════

function exportCsv(rows) {
  const cols = [
    ['no', 'No.'], ['name', 'ชื่อ-สกุล'], ['position', 'ตำแหน่ง'], ['org', 'หน่วยงาน'],
    ['color', 'สี'], ['tel', 'โทรศัพท์'], ['email', 'อีเมล'],
    ['hobby', 'งานอดิเรก'], ['favorite', 'ของชอบ'], ['sale_name', 'ผู้ดูแล'],
  ];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map(r => cols.map(([k]) =>
    cell(k === 'color' ? colorOf(r.color).short : r[k])).join(',')).join('\r\n');

  // ﻿ = BOM · ไม่ใส่แล้ว Excel บน Windows อ่านไทยเป็นตัวยึกยือ
  const blob = new Blob(['﻿' + cols.map(c => cell(c[1])).join(',') + '\r\n' + body],
                        { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `book3-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
