// F7 — แหล่งงาน 8 เส้นทาง + ลูกค้าจากงานแสดงสินค้า (Phase 3.1)
//
// 2 แถบในหน้าเดียว:
//   "เส้นทางหางาน"   — 8 เส้นทาง พร้อมลิงก์ที่กดเข้าไปทำงานได้เลย (หัวหน้าแก้ลิงก์ได้)
//   "Thai Water Expo" — กองลีดจากงานแสดงสินค้า ★ ตัวที่ควรโทรก่อนขึ้นบนสุด
//
// ⚠️ รายชื่อลูกค้าจริงไม่ได้อยู่ในโค้ดหรือใน repo — นำเข้าผ่าน tools/import-json.html
//    หรือกรอกเองจากหน้านี้ ข้อมูลอยู่ใน Supabase เท่านั้น (repo เป็น public)

import { adapter } from '../data/adapter.js';
import { canSign } from '../ui/signoff.js';

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

export default {
  title: 'แหล่งงาน',
  subtitle: '8 เส้นทางหาโครงการ · ลูกค้าจากงานแสดงสินค้า',
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
