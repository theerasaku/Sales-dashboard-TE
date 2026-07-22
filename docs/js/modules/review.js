// F12 — หน้า "รอตรวจ" ของหัวหน้างาน (Phase 2.6)
//
// รวมงาน Pending + ลูกค้า Book 3 สี ที่หัวหน้ายังไม่ได้เซ็นรับทราบ
// หรือเซ็นไปแล้วแต่ถูกแก้หลังจากนั้น มาไว้ที่เดียว จะได้ไม่ต้องไล่เปิดทีละแถบ
//
// ⚠️ ตรรกะ "ลายเซ็นค้าง" ห้ามเขียนซ้ำที่นี่ — ใช้ signoffState() จาก ui/signoff.js
//    ไม่งั้นหน้านี้กับหน้ารายละเอียดจะบอกไม่ตรงกันสำหรับงานชิ้นเดียวกัน

import { adapter } from '../data/adapter.js';
import { signoffState, signoffTag, needsReview, canSign } from '../ui/signoff.js';
import { thaiDate } from '../ui/datepicker.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const fmtMB = (v) => (Number(v || 0) / 1e6)
  .toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * รวมรายการที่ต้องตรวจจากทั้ง 2 โมดูล
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์ เพื่อให้ทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์
 * และเพื่อให้ป้ายนับบนเมนูใช้ตรรกะเดียวกับหน้านี้เป๊ะ ๆ
 */
export function collectReview(pendings, customers, soPending, soCustomer) {
  const byId = (list) => new Map((list || []).map(s => [s.target_id, s]));
  const mp = byId(soPending), mc = byId(soCustomer);

  const out = [];
  for (const r of pendings || []) {
    const st = signoffState(r, mp.get(r.id));
    if (needsReview(st)) out.push({ kind: 'pending', row: r, st });
  }
  for (const r of customers || []) {
    const st = signoffState(r, mc.get(r.id));
    if (needsReview(st)) out.push({ kind: 'customer', row: r, st });
  }

  // ที่เคยเซ็นแล้วถูกแก้ ขึ้นก่อน — เร่งด่วนกว่าของที่ยังไม่เคยตรวจเลย
  // เพราะแปลว่ามีการเปลี่ยนตัวเลขหลังหัวหน้ารับรองไปแล้ว
  const rank = (x) => (x.st.kind === 'stale' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b)
    || String(b.row.updated_at || '').localeCompare(String(a.row.updated_at || '')));
}

export default {
  title: 'รอตรวจ',
  subtitle: 'งานที่หัวหน้ายังไม่ได้เซ็นรับทราบ · หรือถูกแก้หลังเซ็น',
  render: (root) => renderReview(root),
};

async function renderReview(root) {
  const me = (await adapter.getSession())?.user || null;

  if (!canSign(me)) {
    root.innerHTML = `<div class="empty">
        <strong>หน้านี้สำหรับหัวหน้างานและผู้ดูแลระบบ</strong>
        หน้านี้ใช้เซ็นรับทราบข้อมูลของทีม — ถ้าต้องการสิทธิ์ ให้ติดต่อผู้ดูแลระบบ
      </div>`;
    return;
  }

  root.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';

  let pendings = [], customers = [], soP = [], soC = [];
  try {
    [pendings, customers] = await Promise.all([
      adapter.listPending({ status: 'active', limit: 1000 }),
      adapter.listCustomers({ status: 'active', limit: 1000 }).catch(() => []),
    ]);
    [soP, soC] = await Promise.all([
      adapter.listSignoffs('pending_projects', pendings.map(r => r.id)),
      adapter.listSignoffs('customers', customers.map(r => r.id)),
    ]);
  } catch (e) {
    const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01|signoffs/i.test(e.message);
    root.innerHTML = `<div class="empty">
        <strong>${missing ? 'ยังไม่ได้สร้างตารางลายเซ็น' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
        ${missing ? 'เอาไฟล์ <code>db/signoffs.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                  : esc(e.message)}
      </div>`;
    return;
  }

  const items = collectReview(pendings, customers, soP, soC);
  const stale = items.filter(i => i.st.kind === 'stale');
  const total = pendings.length + customers.length;

  if (!items.length) {
    root.innerHTML = `<div class="empty">
        <strong>ตรวจครบทุกรายการแล้ว 👍</strong>
        ข้อมูลที่เปิดอยู่ทั้ง ${total} รายการมีลายเซ็นรับทราบล่าสุดครบ
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="grid cols-4">
      <div class="card"><div class="stat-label">รอตรวจทั้งหมด</div>
        <div class="stat-value">${items.length}</div>
        <div class="stat-note">จาก ${total} รายการที่เปิดอยู่</div></div>
      <div class="card ${stale.length ? 'is-risk' : ''}">
        <div class="stat-label">แก้ไขหลังเซ็น</div>
        <div class="stat-value">${stale.length}</div>
        <div class="stat-note">${stale.length ? '⚠ เคยรับรองไปแล้ว แต่ข้อมูลเปลี่ยน' : 'ไม่มี'}</div></div>
      <div class="card"><div class="stat-label">ยังไม่เคยตรวจ</div>
        <div class="stat-value">${items.length - stale.length}</div>
        <div class="stat-note">ข้อมูลใหม่ที่ยังไม่ผ่านตา</div></div>
    </div>

    <div class="card sec">
      <h3 class="sec-h">รายการที่ต้องตรวจ
        <span class="sec-sub">กดที่รายการเพื่อเปิดดูรายละเอียดและเซ็น</span></h3>
      <ul class="rvlist">
        ${items.map(i => rowHtml(i)).join('')}
      </ul>
    </div>`;

  // เปิดรายละเอียดในแถบต้นทาง — ไม่ทำฟอร์มซ้ำที่นี่
  // (ฟอร์ม Pending มี 42 ช่อง ถ้าทำซ้ำจะกลายเป็นของ 2 ชุดที่ต้องแก้คู่กันตลอดไป)
  root.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => {
      const [kind, id] = el.dataset.go.split(':');
      sessionStorage.setItem('te:openRecord', id);
      location.hash = kind === 'pending' ? 'pending' : 'book3';
    });
  });
}

function rowHtml({ kind, row, st }) {
  const isP = kind === 'pending';
  const title = isP ? row.project_name : row.name;
  const meta = isP
    ? [row.customer_name, row.value_baht ? fmtMB(row.value_baht) + ' ล้าน' : '', row.teams?.code]
    : [row.org, row.position, row.teams?.code];

  return `
    <li class="rvrow ${st.kind === 'stale' ? 'is-stale' : ''}" data-go="${kind}:${esc(row.id)}"
        role="button" tabindex="0">
      <span class="rv-kind">${isP ? '▤ งาน' : '◍ ลูกค้า'}</span>
      <div class="rv-main">
        <div class="rv-title">${esc(title || '(ไม่มีชื่อ)')}</div>
        <div class="rv-meta">${esc(meta.filter(Boolean).join(' · '))}</div>
      </div>
      <div class="rv-right">
        ${signoffTag(st)}
        <span class="rv-upd">แก้ล่าสุด ${esc(thaiDate(String(row.updated_at || '').slice(0, 10)) || '—')}</span>
      </div>
    </li>`;
}
