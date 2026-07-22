// F7 — แหล่งงาน + ทีมขาย + playbook กลยุทธ์ (Phase 3.1 → 3.2)
//
// 4 แถบในหน้าเดียว:
//   "เส้นทางหางาน"   — 8 เส้นทาง พร้อมลิงก์ที่กดเข้าไปทำงานได้เลย (หัวหน้าแก้ลิงก์ได้)
//   "Thai Water Expo" — กองลีดจากงานแสดงสินค้า ★ ตัวที่ควรโทรก่อนขึ้นบนสุด
//   "ทีมขาย"          — 5 ทีม พร้อมตัวเลขจริงของแต่ละทีม (step 3.2)
//   "กลยุทธ์"         — playbook รายเส้นทาง + เช็กลิสต์ชนะงาน 7 ข้อ (step 3.2)
//
// ⚠️ รายชื่อลูกค้าจริงไม่ได้อยู่ในโค้ดหรือใน repo — นำเข้าผ่าน tools/import-json.html
//    หรือกรอกเองจากหน้านี้ ข้อมูลอยู่ใน Supabase เท่านั้น (repo เป็น public)

import { adapter } from '../data/adapter.js';
import { CONFIG } from '../config.js';
import { canSign } from '../ui/signoff.js';
import { monthOf } from './dashboard.js';
import { todayISO } from '../ui/datepicker.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const LS_TAB = 'te-dashboard:sources-tab';

const STATUS = [
  { id: 'new',       label: 'ยังไม่ติดต่อ' },
  { id: 'working',   label: 'กำลังติดตาม' },
  { id: 'converted', label: 'ยกเป็นงานแล้ว' },
  { id: 'dropped',   label: 'ไม่ไปต่อ' },
];
const statusOf = (id) => STATUS.find(s => s.id === id) || STATUS[0];

/**
 * ลิงก์ต้องเป็น http/https เท่านั้น
 * ⚠️ ถ้าปล่อยผ่าน คนที่แก้ลิงก์ได้จะใส่ javascript:… แล้วกลายเป็นช่องรันสคริปต์
 *    ใส่ rel="noopener" ด้วย ไม่งั้นหน้าที่เปิดใหม่แก้ location ของหน้าเราได้
 */
const safeUrl = (u) => {
  try {
    const x = new URL(String(u));
    return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
  } catch { return ''; }
};

const MB = (v) => Number(v || 0) / 1e6;
const fmtMB = (v) => MB(v).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const has = (v) => String(v ?? '').trim() !== '';

// ══════════════════════════════════════════════════════════
// เช็กลิสต์ชนะงาน 7 ข้อ — ตรรกะบริสุทธิ์ แยกไว้ให้ทดสอบได้
//
// ทุกข้อต้องผูกกับ "ช่องที่มีอยู่จริงในฟอร์ม Pending" เท่านั้น
// ถ้าตั้งข้อที่ระบบตรวจเองไม่ได้ มันจะกลายเป็นโปสเตอร์ติดผนัง ไม่ใช่เครื่องมือ
// ══════════════════════════════════════════════════════════

export const WIN_CHECKS = [
  { id: 'owner',  label: 'รู้ว่าใครเป็นเจ้าของงานตัวจริง',
    hint: 'ช่อง OWNER เจ้าของโครงการ — คนที่เซ็นอนุมัติ ไม่ใช่คนที่เราคุยด้วย',
    ok: (r) => has(r.project_owner) },

  { id: 'spec',   label: 'เข้าถึงผู้ออกแบบหรือที่ปรึกษาแล้ว',
    hint: 'ช่อง DESIGNER หรือ CONSULT — ว่างทั้งคู่แปลว่าเรามาทีหลังสเปกถูกล็อกไปแล้ว',
    ok: (r) => has(r.designer) || has(r.consultant) },

  { id: 'compet', label: 'รู้ว่าแข่งกับใคร',
    hint: 'ช่อง COMPETITOR คู่แข่ง — ไม่รู้ว่าแข่งกับใคร แปลว่าตั้งราคาโดยเดา',
    ok: (r) => has(r.competitors) },

  { id: 'need',   label: 'รู้ความต้องการจริง และรู้จุดแข็งของเรา',
    hint: 'ต้องมีครบทั้งช่อง "ความต้องการจริงของลูกค้า" และ "จุดแข็งของเราในงานนี้"',
    ok: (r) => has(r.customer_needs) && has(r.our_strengths) },

  { id: 'plan',   label: 'มีแผนชนะงานเขียนไว้',
    hint: 'ช่อง Win plan — เขียนไว้แล้วคนอื่นรับช่วงต่อได้ตอนเราลาหรือย้ายงาน',
    ok: (r) => has(r.win_plan) },

  { id: 'when',   label: 'รู้ว่าตัดสินใจเมื่อไหร่',
    hint: 'ช่อง DECISION DAY หรือเดือนที่คาดปิด — ไม่มีวัน งานจะค้างข้ามไตรมาสโดยไม่มีใครเร่ง',
    ok: (r) => has(r.decision_day) || has(r.close_month) },

  // ข้อเดียวที่ "เคยผ่านแล้วกลับมาไม่ผ่านได้" — นัดที่เลยกำหนดถือว่าไม่มีนัด
  { id: 'next',   label: 'มีนัดถัดไปที่ยังไม่เลยกำหนด',
    hint: 'ช่อง "งานถัดไปที่ต้องทำ" + "กำหนดทำภายใน" ที่ยังไม่เลยวันนี้',
    ok: (r, today) => has(r.next_action) && has(r.next_date) && String(r.next_date) >= today },
];

/** งานเดี่ยว ๆ ผ่านกี่ข้อจาก 7 */
export function winScore(row, today = todayISO()) {
  const missing = WIN_CHECKS.filter(c => !c.ok(row, today)).map(c => c.id);
  return { passed: WIN_CHECKS.length - missing.length, total: WIN_CHECKS.length, missing };
}

/**
 * นับทั้งกอง: แต่ละข้อมีงานที่ยัง "ขาด" อยู่กี่งาน คิดเป็นเงินเท่าไหร่
 *
 * นับเฉพาะงานที่ยังเดินอยู่ — งานที่ปิดหรือแพ้ไปแล้วไม่ต้องมี Win plan อีกแล้ว
 * ถ้าเอามานับด้วย ตัวเลข "ยังขาด" จะพองจนไม่มีใครอยากแตะ
 */
export function checkGaps(rows, today = todayISO()) {
  const open = (rows || []).filter(r =>
    r.is_active !== false && r.stage !== 'won' && r.stage !== 'lost');

  return WIN_CHECKS.map(c => {
    const miss = open.filter(r => !c.ok(r, today));
    return {
      id: c.id, label: c.label, hint: c.hint,
      total: open.length,
      done:  open.length - miss.length,
      miss:  miss.length,
      missValue: miss.reduce((a, r) => a + Number(r.value_baht || 0), 0),
    };
  });
}

// ══════════════════════════════════════════════════════════
// ตัวเลขรายทีม
// ══════════════════════════════════════════════════════════

/**
 * รวมตัวเลขของแต่ละทีมจากรายการ pending ชุดเดียว
 *
 * @param visible  Set ของ team_id ที่ผู้ใช้คนนี้มีสิทธิ์เห็น (null = เห็นหมด เช่น admin)
 *                 ทีมที่ไม่มีสิทธิ์จะได้ locked: true → หน้าจอต้องขึ้น "ดูไม่ได้"
 *                 ⚠️ ห้ามปล่อยให้ขึ้นเลข 0 เฉย ๆ — RLS กรองแถวออกแบบเงียบ ๆ
 *                    คนอ่านจะเข้าใจว่าทีมนั้นไม่มีงานเลย ทั้งที่จริงแค่ตัวเองไม่มีสิทธิ์เห็น
 */
export function teamRollup(rows, teams, opt = {}) {
  const from    = opt.from ?? CONFIG.TARGET_FROM;
  const to      = opt.to   ?? CONFIG.TARGET_TO;
  const visible = opt.visible ?? null;
  const live    = (rows || []).filter(r => r.is_active !== false);
  const inRange = (ym) => !!ym && ym >= from && ym <= to;

  const roll = (list) => {
    const openRows = list.filter(r => r.stage !== 'won' && r.stage !== 'lost');
    const wonRows  = list.filter(r => r.stage === 'won' && inRange(monthOf(r)));
    return {
      openCount: openRows.length,
      pipeline:  openRows.reduce((a, r) => a + Number(r.value_baht || 0), 0),
      wonCount:  wonRows.length,
      won:       wonRows.reduce((a, r) => a + Number(r.value_baht || 0), 0),
    };
  };

  const list = (teams || []).map(t => ({
    id: t.id, code: t.code, name: t.name, description: t.description || '',
    locked: visible ? !visible.has(t.id) : false,
    ...roll(live.filter(r => r.team_id === t.id)),
  }));

  // งานที่ยังไม่ระบุทีม — เห็นได้เฉพาะ admin (can_access_team คืน false ให้ team_id ว่าง)
  // ต้องโชว์ ไม่ใช่ทิ้ง ไม่งั้นยอดรวมรายทีมจะไม่เท่ากับยอดรวมในหน้าภาพรวม แล้วหาไม่เจอว่าหายไปไหน
  const orphan = live.filter(r => !r.team_id);
  const total  = roll(live);

  return {
    teams: list,
    orphan: orphan.length ? { count: orphan.length, ...roll(orphan) } : null,
    total,
    hiddenTeams: list.filter(t => t.locked).length,
  };
}

export default {
  title: 'แหล่งงาน',
  subtitle: 'เส้นทางหาโครงการ · ทีมขาย · กลยุทธ์ชนะงาน',
  render: (root) => renderSources(root),
};

async function renderSources(root) {
  const me = (await adapter.getSession())?.user || null;
  let tab = 'paths';
  try { tab = localStorage.getItem(LS_TAB) || 'paths'; } catch {}

  root.innerHTML = `
    <div class="toolbar toolbar-sub">
      <div class="segmented" id="sTab" role="tablist" aria-label="มุมมอง">
        <button type="button" data-tab="paths" class="${tab === 'paths' ? 'on' : ''}">เส้นทางหางาน</button>
        <button type="button" data-tab="expo"  class="${tab === 'expo'  ? 'on' : ''}">
          Thai Water Expo <span class="seg-badge" id="sExpoN" hidden></span>
        </button>
        <button type="button" data-tab="team"  class="${tab === 'team'  ? 'on' : ''}">ทีมขาย</button>
        <button type="button" data-tab="play"  class="${tab === 'play'  ? 'on' : ''}">กลยุทธ์</button>
      </div>
    </div>
    <div id="sBody"><div class="skeleton">กำลังโหลด…</div></div>
    <div id="sPanel"></div>`;

  const body = root.querySelector('#sBody');

  root.querySelectorAll('#sTab [data-tab]').forEach(b => {
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      try { localStorage.setItem(LS_TAB, tab); } catch {}
      root.querySelectorAll('#sTab [data-tab]').forEach(x => x.classList.toggle('on', x === b));
      draw();
    });
  });

  // ป้ายนับลีดที่ยังไม่ได้ตาม — เห็นตั้งแต่ยังไม่กดเข้าแถบ
  (async () => {
    try {
      const rows = await adapter.listExpoCustomers({ limit: 1000 });
      const n = rows.filter(r => r.status === 'new').length;
      const el = root.querySelector('#sExpoN');
      if (el) { el.textContent = n; el.hidden = n === 0; }
    } catch { /* ยังไม่ได้รัน SQL ก็ไม่ต้องโชว์ */ }
  })();

  async function draw() {
    body.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';
    if (tab === 'paths') return drawPaths(body, root, me, draw);
    if (tab === 'team')  return drawTeams(body, me);
    if (tab === 'play')  return drawPlaybook(body, root, me, draw);
    return drawExpo(body, root, me, draw);
  }
  await draw();
}

// ══════════════════════════════════════════════════════════
// แถบ 1 — เส้นทางหางาน
// ══════════════════════════════════════════════════════════

async function drawPaths(body, root, me, redraw) {
  let rows = [];
  try { rows = await adapter.listLeadSources(); }
  catch (e) {
    const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01/i.test(e.message);
    body.innerHTML = `<div class="empty">
        <strong>${missing ? 'ยังไม่ได้สร้างตารางแหล่งงาน' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
        ${missing ? 'เอาไฟล์ <code>db/phase3-1.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                  : esc(e.message)}
      </div>`;
    return;
  }

  const editable = canSign(me);

  body.innerHTML = `
    <p class="sec-foot" style="margin:0 0 12px">
      ${rows.length} เส้นทางที่ทีมใช้หางาน — กดลิงก์เข้าไปทำงานได้เลย
      ${editable ? '· แก้ลิงก์/ผู้รับผิดชอบได้ที่ปุ่ม "แก้ไข"'
                 : '· ลิงก์เป็นของกลาง แก้ได้เฉพาะหัวหน้างาน'}
    </p>
    <div class="srcgrid">
      ${rows.map(s => `
        <div class="card srccard">
          <div class="src-h">
            <span class="src-ico">${esc(s.icon || '•')}</span>
            <div class="src-title">
              <strong>${esc(s.name)}</strong>
              ${s.cadence ? `<span class="src-cad">⏱ ${esc(s.cadence)}</span>` : ''}
            </div>
            ${editable ? `<button type="button" class="btn btn-ghost btn-sm"
                            data-edit-src="${esc(s.id)}">แก้ไข</button>` : ''}
          </div>
          ${s.descr ? `<p class="src-desc">${esc(s.descr)}</p>` : ''}
          ${s.owner_name ? `<p class="src-owner">ผู้รับผิดชอบ: <b>${esc(s.owner_name)}</b></p>` : ''}
          ${(s.subs || []).length ? `<div class="src-subs">
            ${s.subs.map(x => `<span class="ateam">${esc(x)}</span>`).join('')}</div>` : ''}
          ${(s.links || []).length ? `<ul class="src-links">
            ${s.links.map(l => {
              const u = safeUrl(l.url);
              return u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">
                            ${esc(l.label || u)} ↗</a></li>`
                       : `<li><span class="src-badlink">${esc(l.label || '')} — ลิงก์ไม่ถูกต้อง</span></li>`;
            }).join('')}
          </ul>` : '<p class="src-nolink">— ยังไม่มีลิงก์ —</p>'}
        </div>`).join('')}
    </div>`;

  body.querySelectorAll('[data-edit-src]').forEach(b => {
    b.addEventListener('click', () =>
      openSourceEdit(root.querySelector('#sPanel'), rows.find(r => r.id === b.dataset.editSrc), redraw));
  });
}

function openSourceEdit(host, src, onSaved) {
  if (!src) return;
  const linkRow = (l = {}, i) => `
    <div class="lnkrow" data-lnk="${i}">
      <input type="text" class="inp inp-sm" data-f="label" placeholder="ชื่อลิงก์" value="${esc(l.label || '')}">
      <input type="url"  class="inp inp-sm" data-f="url"   placeholder="https://…" value="${esc(l.url || '')}">
      <button type="button" class="btn btn-ghost btn-sm" data-rm-lnk>ลบ</button>
    </div>`;

  host.innerHTML = `
    <div class="modal" id="srcModal">
      <form class="modal-box modal-sm" id="srcForm">
        <div class="modal-head">
          <strong>${esc(src.icon || '')} ${esc(src.name)}</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="srcClose">ปิด</button>
        </div>
        <div class="modal-body">
          <div class="fgrid">
            <label class="fld fld-wide"><span>คำอธิบายวิธีทำงาน</span>
              <textarea name="descr" rows="2">${esc(src.descr || '')}</textarea></label>
            <label class="fld"><span>ต้องตรวจถี่แค่ไหน</span>
              <input type="text" name="cadence" value="${esc(src.cadence || '')}"></label>
            <label class="fld"><span>ผู้รับผิดชอบ</span>
              <input type="text" name="owner_name" value="${esc(src.owner_name || '')}"></label>
            <label class="fld fld-wide"><span>กลยุทธ์ชนะงานเส้นทางนี้ (playbook)</span>
              <textarea name="playbook" rows="7"
                placeholder="ขึ้นต้นบรรทัดด้วย • เพื่อให้แสดงเป็นข้อ ๆ">${esc(src.playbook || '')}</textarea></label>
          </div>

          <h3 class="q-h3">ลิงก์</h3>
          <div id="lnkList">${(src.links || []).map(linkRow).join('')}</div>
          <button type="button" class="btn btn-ghost btn-sm" id="addLnk">+ เพิ่มลิงก์</button>
          <p class="sec-foot">รับเฉพาะ http:// และ https:// — ลิงก์แบบอื่นระบบจะไม่แสดงให้กด</p>
        </div>
        <p class="login-err" id="srcErr" role="alert" hidden></p>
        <div class="modal-foot">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="srcCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="srcSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  q('#srcClose').addEventListener('click', close);
  q('#srcCancel').addEventListener('click', close);
  q('#srcModal').addEventListener('mousedown', (e) => { if (e.target.id === 'srcModal') close(); });

  let n = (src.links || []).length;
  q('#addLnk').addEventListener('click', () => {
    q('#lnkList').insertAdjacentHTML('beforeend', linkRow({}, n++));
  });
  q('#lnkList').addEventListener('click', (e) => {
    if (e.target.closest('[data-rm-lnk]')) e.target.closest('.lnkrow').remove();
  });

  q('#srcForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#srcErr').hidden = true;

    const links = [...host.querySelectorAll('.lnkrow')].map(r => ({
      label: r.querySelector('[data-f="label"]').value.trim(),
      url:   r.querySelector('[data-f="url"]').value.trim(),
    })).filter(l => l.url);

    const bad = links.find(l => !safeUrl(l.url));
    if (bad) {
      q('#srcErr').textContent = `ลิงก์ "${bad.url}" ใช้ไม่ได้ — ต้องขึ้นต้นด้วย http:// หรือ https://`;
      q('#srcErr').hidden = false;
      return;
    }

    const f = Object.fromEntries(new FormData(ev.target).entries());
    const btn = q('#srcSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.saveLeadSource(src.id, { ...f, links });
      close();
      await onSaved();
    } catch (e) {
      q('#srcErr').textContent = e.message;
      q('#srcErr').hidden = false;
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });
}

// ══════════════════════════════════════════════════════════
// แถบ 2 — Thai Water Expo
// ══════════════════════════════════════════════════════════

async function drawExpo(body, root, me, redraw) {
  let rows = [];
  try { rows = await adapter.listExpoCustomers({ limit: 1000 }); }
  catch (e) {
    const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01/i.test(e.message);
    body.innerHTML = `<div class="empty">
        <strong>${missing ? 'ยังไม่ได้สร้างตารางลูกค้างานแสดงสินค้า' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
        ${missing ? 'เอาไฟล์ <code>db/phase3-1.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                  : esc(e.message)}
      </div>`;
    return;
  }

  if (!rows.length) {
    body.innerHTML = `<div class="empty">
        <strong>ยังไม่มีรายชื่อจากงานแสดงสินค้า</strong>
        นำเข้าได้ที่ <code>docs/tools/import-json.html</code> หรือกด "+ เพิ่มรายชื่อ" ด้านล่าง<br>
        <span class="t2">ข้อมูลลูกค้าจริงไม่ได้อยู่ในโค้ด — เก็บใน Supabase เท่านั้น</span>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" id="exNew">+ เพิ่มรายชื่อ</button>
      </div>`;
    body.querySelector('#exNew').addEventListener('click', () =>
      openExpo(root.querySelector('#sPanel'), null, redraw));
    return;
  }

  const prospects = rows.filter(r => r.is_prospect);
  const byStatus = (id) => rows.filter(r => r.status === id).length;

  body.innerHTML = `
    <div class="grid cols-4">
      <div class="card"><div class="stat-label">รายชื่อทั้งหมด</div>
        <div class="stat-value">${rows.length}</div>
        <div class="stat-note">จากงานแสดงสินค้า</div></div>
      <div class="card"><div class="stat-label">★ ควรตามก่อน</div>
        <div class="stat-value">${prospects.length}</div>
        <div class="stat-note">ระบุความสนใจชัด</div></div>
      <div class="card"><div class="stat-label">ยังไม่ติดต่อ</div>
        <div class="stat-value">${byStatus('new')}</div>
        <div class="stat-note">รอคนรับไปดูแล</div></div>
      <div class="card"><div class="stat-label">ยกเป็นงานแล้ว</div>
        <div class="stat-value">${byStatus('converted')}</div>
        <div class="stat-note">เข้า Pending Project</div></div>
    </div>

    <div class="toolbar toolbar-sub" style="margin-top:16px">
      <input class="inp inp-search" id="exSearch" type="search"
             placeholder="ค้นหาชื่อ / กิจการ / ผู้ติดต่อ…" autocapitalize="off">
      <div class="segmented" id="exFilter" role="tablist">
        <button type="button" data-f="all" class="on">ทั้งหมด</button>
        <button type="button" data-f="prospect">★ ควรตามก่อน</button>
        <button type="button" data-f="new">ยังไม่ติดต่อ</button>
      </div>
      <button class="btn btn-primary btn-sm" id="exNew">+ เพิ่มรายชื่อ</button>
    </div>

    <ul class="exlist" id="exList"></ul>`;

  const listEl = body.querySelector('#exList');
  let filter = 'all', term = '';

  function paint() {
    let view = rows;
    if (filter === 'prospect') view = view.filter(r => r.is_prospect);
    if (filter === 'new')      view = view.filter(r => r.status === 'new');
    const t = term.trim().toLowerCase();
    if (t) view = view.filter(r =>
      [r.name, r.org, r.contact].some(v => String(v || '').toLowerCase().includes(t)));

    listEl.innerHTML = view.length
      ? view.map(r => `
        <li class="exrow ${r.is_prospect ? 'is-prospect' : ''}" data-id="${esc(r.id)}"
            role="button" tabindex="0">
          <span class="ex-star" title="${r.is_prospect ? 'ควรตามก่อน' : ''}">${r.is_prospect ? '★' : '☆'}</span>
          <div class="ex-main">
            <div class="ex-name">${esc(r.name)}</div>
            <div class="ex-meta">${esc([r.org, r.interest].filter(Boolean).join(' · '))}</div>
            ${r.contact ? `<div class="ex-contact">${esc(r.contact)}</div>` : ''}
          </div>
          <div class="ex-right">
            <span class="so-tag ${r.status === 'converted' ? 'so-ok' : r.status === 'dropped' ? 'so-none' : ''}">
              ${esc(statusOf(r.status).label)}</span>
            ${r.sale_name ? `<span class="rv-upd">${esc(r.sale_name)}</span>` : ''}
          </div>
        </li>`).join('')
      : '<li class="empty" style="padding:24px">ไม่มีรายชื่อที่ตรงกับเงื่อนไข</li>';
  }
  paint();

  let t = null;
  body.querySelector('#exSearch').addEventListener('input', (e) => {
    clearTimeout(t); term = e.target.value; t = setTimeout(paint, 250);
  });
  body.querySelectorAll('#exFilter [data-f]').forEach(b => {
    b.addEventListener('click', () => {
      filter = b.dataset.f;
      body.querySelectorAll('#exFilter [data-f]').forEach(x => x.classList.toggle('on', x === b));
      paint();
    });
  });
  body.querySelector('#exNew').addEventListener('click', () =>
    openExpo(root.querySelector('#sPanel'), null, redraw));

  listEl.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-id]');
    if (hit) openExpo(root.querySelector('#sPanel'), rows.find(r => r.id === hit.dataset.id), redraw);
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const hit = e.target.closest('[data-id]');
    if (!hit) return;
    e.preventDefault();
    openExpo(root.querySelector('#sPanel'), rows.find(r => r.id === hit.dataset.id), redraw);
  });
}

function openExpo(host, row, onSaved) {
  const id = row?.id || null;
  const v = (k, d = '') => row?.[k] ?? d;
  const converted = !!row?.pending_id;

  host.innerHTML = `
    <div class="modal" id="exModal">
      <form class="modal-box modal-sm" id="exForm">
        <div class="modal-head">
          <strong>${id ? 'รายชื่อจากงานแสดงสินค้า' : 'เพิ่มรายชื่อ'}</strong>
          ${converted ? '<span class="tag" style="--tag-c:var(--green)">ยกเป็นงานแล้ว</span>' : ''}
          <button type="button" class="btn btn-ghost btn-sm" id="exClose">ปิด</button>
        </div>
        <div class="modal-body">
          <div class="fgrid">
            <label class="fld fld-wide"><span>ชื่อบริษัท / หน่วยงาน *</span>
              <input type="text" name="name" value="${esc(v('name'))}" required></label>
            <label class="fld"><span>ประเภทกิจการ</span>
              <input type="text" name="org" value="${esc(v('org'))}"></label>
            <label class="fld"><span>ผู้รับไปดูแล</span>
              <input type="text" name="sale_name" value="${esc(v('sale_name'))}"></label>
            <label class="fld fld-wide"><span>สนใจอะไร</span>
              <textarea name="interest" rows="2">${esc(v('interest'))}</textarea></label>
            <label class="fld fld-wide"><span>ผู้ติดต่อ / เบอร์ / อีเมล</span>
              <textarea name="contact" rows="2">${esc(v('contact'))}</textarea></label>
            <label class="fld fld-wide"><span>ผลการติดตาม</span>
              <textarea name="result" rows="2">${esc(v('result'))}</textarea></label>
            <label class="fld"><span>สถานะ</span>
              <select name="status">
                ${STATUS.map(s => `<option value="${s.id}" ${v('status', 'new') === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
              </select></label>
            <label class="fld"><span>★ ควรตามก่อน</span>
              <label class="sw"><input type="checkbox" name="is_prospect" ${v('is_prospect') ? 'checked' : ''}>
                <span>ใช่ — ระบุความสนใจชัด</span></label></label>
          </div>
        </div>
        <p class="login-err" id="exErr" role="alert" hidden></p>
        <div class="modal-foot">
          ${id && !converted ? `<button type="button" class="btn btn-ghost btn-sm" id="exToPending"
                  title="สร้างงานใหม่ในแถบ Pending Project จากรายชื่อนี้">↗ ยกขึ้นเป็น Pending Project</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="exCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="exSave">บันทึก</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  const fail = (m) => { q('#exErr').textContent = m; q('#exErr').hidden = false; };

  q('#exClose').addEventListener('click', close);
  q('#exCancel').addEventListener('click', close);
  q('#exModal').addEventListener('mousedown', (e) => { if (e.target.id === 'exModal') close(); });

  q('#exForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    q('#exErr').hidden = true;
    const f = Object.fromEntries(new FormData(ev.target).entries());
    f.is_prospect = !!ev.target.is_prospect.checked;   // checkbox ที่ไม่ติ๊กจะไม่มาใน FormData
    if (id) f.id = id;
    if (!String(f.name || '').trim()) return fail('กรอกชื่อบริษัท/หน่วยงานก่อน');

    const btn = q('#exSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.saveExpoCustomer(f);
      close();
      await onSaved();
    } catch (e) {
      fail(e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  });

  // ── ยกขึ้นเป็น Pending Project ──
  // โยง pending_id กลับมาด้วย จะได้เห็นว่ายกไปแล้วและกดซ้ำไม่ได้
  q('#exToPending')?.addEventListener('click', async () => {
    const btn = q('#exToPending');
    const name = q('[name="name"]').value.trim();
    if (!name) return fail('กรอกชื่อบริษัท/หน่วยงานก่อน');
    btn.disabled = true; btn.textContent = 'กำลังสร้าง…';
    try {
      const p = await adapter.savePending({
        project_name:   `งานของ ${name}`,
        customer_name:  name,
        stage:          'lead',
        value_baht:     0,
        lead_source:    'Thai Water Expo',
        customer_needs: q('[name="interest"]').value.trim() || null,
      });
      if (p?.id) {
        await adapter.saveContacts(p.id, [
          { slot: 1, name: q('[name="contact"]').value.trim() || name }, { slot: 2 }, { slot: 3 },
        ]);
        await adapter.saveExpoCustomer({ id, pending_id: p.id, status: 'converted' });
      }
      btn.textContent = '✓ สร้างแล้ว — ดูในแถบ Pending Project';
      btn.classList.add('is-done');
      await onSaved();
    } catch (e) {
      fail('สร้างงานไม่สำเร็จ: ' + e.message);
      btn.disabled = false; btn.textContent = '↗ ยกขึ้นเป็น Pending Project';
    }
  });
}

// ══════════════════════════════════════════════════════════
// แถบ 3 — ทีมขาย (step 3.2)
// ══════════════════════════════════════════════════════════

/**
 * ทีมที่ผู้ใช้คนนี้มีสิทธิ์เห็น
 * admin → null (เห็นหมด) · manager → ทีมตัวเอง + ทีมที่ได้รับสิทธิ์ · sale → ทีมตัวเอง
 *
 * ตัวนี้ใช้ตัดสินแค่ "จะเขียนอะไรบนหน้าจอ" ไม่ใช่มาตรการความปลอดภัย
 * ของจริง RLS กรองแถวให้ตั้งแต่ที่ DB แล้ว ต่อให้คำนวณตรงนี้ผิดก็ไม่มีข้อมูลรั่ว
 */
async function visibleTeamIds(me) {
  if (!me || me.role === 'admin') return null;
  const ids = new Set(me.team_id ? [me.team_id] : []);
  if (me.role === 'manager') {
    try {
      const rows = await adapter.listTeamAccess(me.id);
      (rows || []).forEach(r => ids.add(r.team_id));
    } catch { /* ยังไม่ได้รัน phase2-4.sql ก็ถือว่ามีแค่ทีมตัวเอง */ }
  }
  return ids;
}

async function drawTeams(body, me) {
  let teams = [], rows = [], profiles = [];
  try {
    [teams, rows] = await Promise.all([
      adapter.listTeams(),
      adapter.listPending({ status: 'all', limit: 1000 }),
    ]);
  } catch (e) {
    body.innerHTML = `<div class="empty"><strong>โหลดข้อมูลทีมไม่สำเร็จ</strong>${esc(e.message)}</div>`;
    return;
  }
  // รายชื่อสมาชิกเป็นของแถม — RLS อาจกันไว้ ห้ามให้ทั้งหน้าพังเพราะอันนี้
  try { profiles = await adapter.listProfiles(); } catch { profiles = []; }

  const visible = await visibleTeamIds(me);
  const sum = teamRollup(rows, teams, { visible });

  const members = (tid) => profiles.filter(p => p.team_id === tid && p.is_active !== false);
  const maxPipe = Math.max(1, ...sum.teams.filter(t => !t.locked).map(t => t.pipeline));

  const card = (t) => {
    const mem = members(t.id);
    if (t.locked) return `
      <div class="card tmcard is-locked">
        <div class="tm-h"><strong>${esc(t.name)}</strong>
          <span class="tm-code">${esc(t.code)}</span></div>
        <p class="tm-desc">${esc(t.description)}</p>
        <p class="tm-lock">🔒 คุณไม่มีสิทธิ์ดูข้อมูลทีมนี้ —
          ตัวเลขจึงไม่แสดง (ไม่ใช่ว่าทีมนี้ไม่มีงาน)</p>
      </div>`;

    return `
      <div class="card tmcard">
        <div class="tm-h"><strong>${esc(t.name)}</strong>
          <span class="tm-code">${esc(t.code)}</span></div>
        <p class="tm-desc">${esc(t.description)}</p>

        <div class="tm-nums">
          <div><span class="tm-n">${fmtMB(t.won)}</span><span class="tm-l">ปิดได้แล้ว (ล้านบาท)</span></div>
          <div><span class="tm-n">${fmtMB(t.pipeline)}</span><span class="tm-l">ยังเดินอยู่ (ล้านบาท)</span></div>
          <div><span class="tm-n">${t.openCount}</span><span class="tm-l">งานที่เดินอยู่</span></div>
        </div>

        <div class="tm-bar" role="img"
             aria-label="สัดส่วนงานที่ยังเดินอยู่ ${fmtMB(t.pipeline)} ล้านบาท">
          <span style="width:${Math.round((t.pipeline / maxPipe) * 100)}%"></span>
        </div>

        <div class="tm-mem">
          ${mem.length
            ? mem.map(p => `<span class="ateam">${esc(p.full_name || p.email || '—')}</span>`).join('')
            : '<span class="tm-nomem">— ยังไม่มีสมาชิกที่คุณเห็นได้ —</span>'}
        </div>
      </div>`;
  };

  body.innerHTML = `
    <div class="grid cols-4">
      <div class="card"><div class="stat-label">ปิดได้แล้ว</div>
        <div class="stat-value">${fmtMB(sum.total.won)}</div>
        <div class="stat-note">ล้านบาท · ${esc(CONFIG.TARGET_PERIOD)}</div></div>
      <div class="card"><div class="stat-label">ยังเดินอยู่</div>
        <div class="stat-value">${fmtMB(sum.total.pipeline)}</div>
        <div class="stat-note">ล้านบาท · ${sum.total.openCount} งาน</div></div>
      <div class="card"><div class="stat-label">ทีมขาย</div>
        <div class="stat-value">${sum.teams.length}</div>
        <div class="stat-note">${sum.hiddenTeams ? `ดูได้ ${sum.teams.length - sum.hiddenTeams} ทีม` : 'ดูได้ทุกทีม'}</div></div>
      <div class="card"><div class="stat-label">คนในทีม</div>
        <div class="stat-value">${profiles.filter(p => p.is_active !== false).length}</div>
        <div class="stat-note">เท่าที่คุณมีสิทธิ์เห็น</div></div>
    </div>

    ${sum.hiddenTeams ? `<p class="sec-foot" style="margin:14px 0 0">
      🔒 มี ${sum.hiddenTeams} ทีมที่คุณดูข้อมูลไม่ได้ — ตัวเลขรวมด้านบนจึงนับเฉพาะทีมที่คุณเห็น
      ถ้าต้องดูข้ามทีม ให้ผู้ดูแลระบบเปิดสิทธิ์ให้ในหน้าตั้งค่าระบบ</p>` : ''}

    ${sum.orphan ? `<div class="card warncard" style="margin-top:14px">
      <strong>⚠️ มี ${sum.orphan.count} งานที่ยังไม่ระบุทีม</strong>
      <p>รวม ${fmtMB(sum.orphan.pipeline + sum.orphan.won)} ล้านบาท —
         งานเหล่านี้ไม่ถูกนับเข้าทีมไหนเลย และคนที่ไม่ใช่ผู้ดูแลระบบจะมองไม่เห็น
         ให้เปิดงานในแถบ Pending Project แล้วเลือกทีมให้เรียบร้อย</p>
    </div>` : ''}

    <div class="srcgrid" style="margin-top:16px">
      ${sum.teams.map(card).join('')}
    </div>

    <p class="sec-foot" style="margin-top:14px">
      "ปิดได้แล้ว" นับงานที่สถานะเป็นปิดการขายและตกอยู่ในช่วงเป้า ${esc(CONFIG.TARGET_PERIOD)}
      · "ยังเดินอยู่" คืองานที่ยังไม่ปิดและยังไม่แพ้ — กติกาเดียวกับหน้าภาพรวม
    </p>`;
}

// ══════════════════════════════════════════════════════════
// แถบ 4 — กลยุทธ์: เช็กลิสต์ชนะงาน 7 ข้อ + playbook รายเส้นทาง (step 3.2)
// ══════════════════════════════════════════════════════════

async function drawPlaybook(body, root, me, redraw) {
  let sources = [], rows = [];
  try {
    [sources, rows] = await Promise.all([
      adapter.listLeadSources(),
      adapter.listPending({ status: 'active', limit: 1000 }),
    ]);
  } catch (e) {
    const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01/i.test(e.message);
    body.innerHTML = `<div class="empty">
        <strong>${missing ? 'ยังไม่ได้สร้างตารางแหล่งงาน' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
        ${missing ? 'เอาไฟล์ <code>db/phase3-1.sql</code> และ <code>db/phase3-2.sql</code> ไปรันใน Supabase ก่อน'
                  : esc(e.message)}
      </div>`;
    return;
  }

  const editable = canGaps(me);
  const gaps = checkGaps(rows);
  const openN = gaps[0]?.total || 0;

  // playbook ยังไม่มีเลยสักเส้นทาง = ยังไม่ได้รัน phase3-2.sql
  const noPlaybook = sources.length > 0 && sources.every(s => !has(s.playbook));

  body.innerHTML = `
    <div class="card wincard">
      <div class="win-h">
        <strong>เช็กลิสต์ชนะงาน 7 ข้อ</strong>
        <span class="win-sub">นับจาก ${openN} งานที่ยังเดินอยู่และคุณมีสิทธิ์เห็น</span>
      </div>
      ${openN === 0
        ? '<p class="tm-nomem" style="padding:8px 0">ยังไม่มีงานที่เดินอยู่ — เพิ่มงานในแถบ Pending Project ก่อน แล้วตัวเลขตรงนี้จะขึ้นเอง</p>'
        : `<ol class="winlist">
        ${gaps.map((g, i) => {
          const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
          const tone = pct >= 80 ? 'ok' : pct >= 40 ? 'warn' : 'bad';
          return `<li class="winrow">
            <span class="win-no">${i + 1}</span>
            <div class="win-main">
              <div class="win-label">${esc(g.label)}</div>
              <div class="win-hint">${esc(g.hint)}</div>
              <div class="win-bar tone-${tone}"><span style="width:${pct}%"></span></div>
            </div>
            <div class="win-right">
              <span class="win-pct tone-${tone}">${pct}%</span>
              <span class="win-miss">${g.miss ? `ยังขาด ${g.miss} งาน · ${fmtMB(g.missValue)} ล้านบาท` : 'ครบทุกงาน ✓'}</span>
            </div>
          </li>`;
        }).join('')}
      </ol>`}
      <p class="sec-foot">ทั้ง 7 ข้อตรวจจากช่องในฟอร์ม Pending Project โดยตรง — กรอกช่องให้ครบ ตัวเลขตรงนี้ขึ้นเอง</p>
    </div>

    ${noPlaybook ? `<div class="empty" style="margin-top:16px">
        <strong>ยังไม่มีเนื้อหากลยุทธ์</strong>
        เอาไฟล์ <code>db/phase3-2.sql</code> ไปรันใน Supabase → SQL Editor
        เพื่อเพิ่มคอลัมน์ <code>playbook</code> พร้อมเนื้อหาตั้งต้น 8 เส้นทาง
      </div>` : `
      <h3 class="q-h3" style="margin-top:22px">กลยุทธ์รายเส้นทาง</h3>
      <p class="sec-foot" style="margin:0 0 12px">
        ${editable ? 'แก้ได้ที่ปุ่ม "แก้ไข" — เป็นของกลางทั้งทีม แก้แล้วทุกคนเห็นทันที'
                   : 'เป็นของกลางทั้งทีม แก้ได้เฉพาะหัวหน้างานและผู้ดูแลระบบ'}
      </p>
      <div class="srcgrid">
        ${sources.map(s => `
          <div class="card pbcard">
            <div class="src-h">
              <span class="src-ico">${esc(s.icon || '•')}</span>
              <div class="src-title"><strong>${esc(s.name)}</strong></div>
              ${editable ? `<button type="button" class="btn btn-ghost btn-sm"
                              data-edit-pb="${esc(s.id)}">แก้ไข</button>` : ''}
            </div>
            ${has(s.playbook)
              ? `<ul class="pblist">${bullets(s.playbook).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
              : '<p class="src-nolink">— ยังไม่ได้เขียนกลยุทธ์เส้นทางนี้ —</p>'}
          </div>`).join('')}
      </div>`}`;

  body.querySelectorAll('[data-edit-pb]').forEach(b => {
    b.addEventListener('click', () =>
      openSourceEdit(root.querySelector('#sPanel'), sources.find(r => r.id === b.dataset.editPb), redraw));
  });
}

/** ตัด playbook เป็นข้อ ๆ — ตัด • หรือ - นำหน้าออก บรรทัดว่างข้าม */
function bullets(text) {
  return String(text || '')
    .split('\n')
    .map(l => l.trim().replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

/** แก้ playbook ได้เท่ากับแก้แหล่งงาน — ใช้เกณฑ์เดียวกับ policy ls_write */
const canGaps = (me) => canSign(me);
