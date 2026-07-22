// F11 — หน้า Admin (Phase 2.4)
//
// จัดการผู้ใช้ · ทีม · สิทธิ์ดูข้ามทีมของหัวหน้า · เป้ายอดขาย
//
// ⚠️ หน้านี้ "ซ่อน" จากคนที่ไม่ใช่ admin เพื่อไม่ให้รก — แต่ความปลอดภัยจริงไม่ได้อยู่ตรงนี้
//    ต่อให้เปิด DevTools แล้วเรียกหน้านี้ขึ้นมาเอง ก็แก้อะไรไม่ได้
//    เพราะ RLS + trigger guard_profile_privilege() บังคับที่ฝั่ง DB
//    (ทดสอบกับ Postgres จริงแล้ว: หัวหน้าตั้งตัวเองเป็น admin ได้ error P0001 กลับมา)

import { adapter } from '../data/adapter.js';
import { CONFIG } from '../config.js';

export const ROLES = [
  { id: 'admin',   label: 'ผู้ดูแลระบบ', note: 'เห็นและแก้ได้ทุกทีม · จัดการผู้ใช้ได้' },
  { id: 'manager', label: 'หัวหน้างาน',  note: 'ดูข้ามทีมตามที่ติ๊กให้ · เซ็นรับทราบได้ (step 2.6)' },
  { id: 'sale',    label: 'เซลส์',       note: 'เห็นและแก้เฉพาะงานทีมตัวเอง' },
];
const roleOf = (id) => ROLES.find(r => r.id === id) || ROLES[2];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/** ดรอปดาวน์เดือน — โชว์ พ.ศ. แต่ส่งค่า ค.ศ. (กติกาเดียวกับหน้า Pending) */
function monthOptions(sel) {
  let out = '';
  for (let y = 2026; y <= 2029; y++) {
    for (let m = 1; m <= 12; m++) {
      const v = `${y}-${String(m).padStart(2, '0')}`;
      out += `<option value="${v}" ${v === sel ? 'selected' : ''}>${TH_MON[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}</option>`;
    }
  }
  return out;
}

export default {
  title: 'ตั้งค่าระบบ',
  subtitle: 'ผู้ใช้ · ทีม · สิทธิ์หัวหน้างาน · เป้ายอดขาย',
  render: (root) => renderAdmin(root),
};

/**
 * แยกออกมาเป็นฟังก์ชันระดับโมดูล ไม่ผูกกับ `this`
 * เพราะต้องเรียกตัวเองซ้ำจาก event handler หลายจุด (เปลี่ยน role แล้วต้องวาดใหม่)
 * ถ้าใช้ this.render() จะพังทันทีที่ app.js เปลี่ยนวิธีเรียก view
 */
async function renderAdmin(root) {
    const me = (await adapter.getSession())?.user || null;

    if (me?.role !== 'admin') {
      root.innerHTML = `<div class="empty">
          <strong>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</strong>
          บัญชีของคุณเป็น "${esc(roleOf(me?.role).label)}" — ถ้าต้องการสิทธิ์เพิ่ม ให้ติดต่อผู้ดูแลระบบ
        </div>`;
      return;
    }

    root.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';

    let profiles = [], teams = [], access = [], settings = {};
    try {
      [profiles, teams, access, settings] = await Promise.all([
        adapter.listProfiles(),
        adapter.listTeams(),
        adapter.listTeamAccess(),
        adapter.getSettings().catch(() => ({})),
      ]);
    } catch (e) {
      const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01/i.test(e.message);
      root.innerHTML = `<div class="empty">
          <strong>${missing ? 'ยังไม่ได้สร้างตารางของ step 2.4' : 'โหลดข้อมูลไม่สำเร็จ'}</strong>
          ${missing ? 'เอาไฟล์ <code>db/phase2-4.sql</code> ไปรันใน Supabase → SQL Editor ก่อน'
                    : esc(e.message)}
        </div>`;
      return;
    }

    const target = settings.sales_target || {
      target_mb: CONFIG.TARGET_MB, from: CONFIG.TARGET_FROM,
      to: CONFIG.TARGET_TO, period: CONFIG.TARGET_PERIOD,
    };
    const accessOf = (pid) => access.filter(a => a.profile_id === pid).map(a => a.team_id);

    root.innerHTML = `
      <div class="card sec">
        <h3 class="sec-h">เป้ายอดขาย <span class="sec-sub">ตัวเลขที่หน้าภาพรวมใช้คำนวณ</span></h3>
        <form id="tgForm" class="fgrid">
          <label class="fld"><span>เป้า (ล้านบาท)</span>
            <input type="number" name="target_mb" min="1" step="1" value="${esc(target.target_mb)}" required></label>
          <label class="fld"><span>ตั้งแต่เดือน</span>
            <select name="from">${monthOptions(target.from)}</select></label>
          <label class="fld"><span>ถึงเดือน</span>
            <select name="to">${monthOptions(target.to)}</select></label>
          <div class="fld fld-wide tg-foot">
            <button type="submit" class="btn btn-primary btn-sm">บันทึกเป้า</button>
            <span class="lg-hint" id="tgMsg"></span>
          </div>
        </form>
      </div>

      <div class="card sec">
        <h3 class="sec-h">ผู้ใช้ <span class="sec-sub">${profiles.length} บัญชี</span></h3>
        <p class="sec-foot" style="margin:0 0 10px">
          เพิ่มบัญชีใหม่ทำที่ Supabase → Authentication → Users → Invite user
          (ระบบปิดรับสมัครสาธารณะไว้) พอเชิญแล้วชื่อจะมาโผล่ที่นี่เอง แล้วค่อยตั้ง role/ทีมให้
        </p>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th style="min-width:170px">ชื่อ</th>
              <th style="min-width:180px">อีเมล</th>
              <th style="min-width:130px">สิทธิ์</th>
              <th style="min-width:120px">ทีมหลัก</th>
              <th style="min-width:200px">ดูข้ามทีมได้</th>
              <th style="min-width:90px">สถานะ</th>
            </tr></thead>
            <tbody>
              ${profiles.map(u => userRow(u, teams, accessOf(u.id), me)).join('')}
            </tbody>
          </table>
        </div>
        <p class="login-err" id="uErr" role="alert" hidden></p>
      </div>

      <div class="card sec">
        <h3 class="sec-h">ทีม <span class="sec-sub">${teams.length} ทีม</span></h3>
        <ul class="tmlist" id="tmList">
          ${teams.map(t => `<li><b>${esc(t.code)}</b><span>${esc(t.name || '')}</span></li>`).join('')}
        </ul>
        <form class="qadd" id="tmForm" style="margin-top:10px">
          <input class="inp" id="tmCode" placeholder="รหัสทีม เช่น GOV.5" maxlength="20" style="flex:0 0 150px">
          <input class="inp" id="tmName" placeholder="ชื่อเต็มของทีม">
          <button type="submit" class="btn btn-ghost btn-sm">+ เพิ่มทีม</button>
        </form>
        <p class="login-err" id="tmErr" role="alert" hidden></p>
      </div>

      <div id="aPanel"></div>`;

    const $ = (s) => root.querySelector(s);
    const flash = (el, msg, bad = false) => {
      el.textContent = msg;
      el.hidden = false;
      el.classList.toggle('ok-msg', !bad);
      if (!bad) setTimeout(() => { el.hidden = true; }, 4000);
    };

    // ── เป้ายอดขาย ──
    $('#tgForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      if (f.from > f.to) return flash($('#tgMsg'), '⚠ เดือนเริ่มต้องไม่เกินเดือนสิ้นสุด', true);
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        await adapter.saveSetting('sales_target', {
          target_mb: Number(f.target_mb),
          from: f.from, to: f.to,
          period: `${monthLabel(f.from)}–${monthLabel(f.to)}`,
        });
        flash($('#tgMsg'), '✓ บันทึกแล้ว — หน้าภาพรวมจะใช้เป้าใหม่ทันที');
      } catch (e) { flash($('#tgMsg'), e.message, true); }
      btn.disabled = false;
    });

    // ── ผู้ใช้: เปลี่ยน role / ทีม / สถานะ ──
    root.querySelectorAll('[data-user]').forEach(el => {
      el.addEventListener('change', async () => {
        const id = el.dataset.user, field = el.dataset.field;
        const val = el.type === 'checkbox' ? el.checked : (el.value || null);
        el.disabled = true;
        try {
          await adapter.saveProfile(id, { [field]: val });
          const u = profiles.find(p => p.id === id);
          if (u) u[field] = val;
          // เปลี่ยนเป็น/เลิกเป็นหัวหน้า → ปุ่มติ๊กทีมต้องโผล่/หาย
          if (field === 'role') await renderAdmin(root);
        } catch (e) {
          flash($('#uErr'), e.message, true);
          el.disabled = false;
          await renderAdmin(root);
        }
      });
    });

    // ── สิทธิ์ดูข้ามทีม ──
    root.querySelectorAll('[data-access]').forEach(btn => {
      btn.addEventListener('click', () =>
        openAccess($('#aPanel'), profiles.find(p => p.id === btn.dataset.access),
                   teams, accessOf(btn.dataset.access), () => renderAdmin(root)));
    });

    // ── เพิ่มทีม ──
    $('#tmForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = $('#tmCode').value.trim(), name = $('#tmName').value.trim();
      if (!code) return flash($('#tmErr'), 'กรอกรหัสทีมก่อน', true);
      if (teams.some(t => t.code.toLowerCase() === code.toLowerCase()))
        return flash($('#tmErr'), `มีทีมรหัส "${code}" อยู่แล้ว`, true);
      try {
        await adapter.saveTeam({ code, name: name || code });
        await renderAdmin(root);
      } catch (e) { flash($('#tmErr'), e.message, true); }
    });
}

const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return y && m ? `${TH_MON[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}` : ym;
};

function userRow(u, teams, myAccess, me) {
  const isMe = u.id === me?.id;
  const canCross = u.role === 'manager' || u.role === 'sale';
  return `
    <tr data-uid="${esc(u.id)}" class="${u.is_active === false ? 'is-archived' : ''}">
      <td>${esc(u.full_name || '(ยังไม่ตั้งชื่อ)')}${isMe ? ' <span class="tag-me">คุณ</span>' : ''}</td>
      <td class="t-mail">${esc(u.email)}</td>
      <td>
        <select data-user="${esc(u.id)}" data-field="role" ${isMe ? 'disabled title="เปลี่ยนสิทธิ์ของตัวเองไม่ได้ — กันล็อกตัวเองออกจากระบบ"' : ''}>
          ${ROLES.map(r => `<option value="${r.id}" ${u.role === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select data-user="${esc(u.id)}" data-field="team_id">
          <option value="">— ไม่มี —</option>
          ${teams.map(t => `<option value="${esc(t.id)}" ${u.team_id === t.id ? 'selected' : ''}>${esc(t.code)}</option>`).join('')}
        </select>
      </td>
      <td>
        ${canCross
          ? `<button type="button" class="btn btn-ghost btn-sm" data-access="${esc(u.id)}">
               ${myAccess.length ? `${myAccess.length} ทีม` : 'ยังไม่ได้ให้'} · แก้ไข
             </button>`
          : '<span class="t2">เห็นทุกทีมอยู่แล้ว</span>'}
      </td>
      <td>
        <label class="sw" title="${isMe ? 'ปิดบัญชีตัวเองไม่ได้' : 'ปิดแล้วเข้าระบบไม่ได้'}">
          <input type="checkbox" data-user="${esc(u.id)}" data-field="is_active"
                 ${u.is_active !== false ? 'checked' : ''} ${isMe ? 'disabled' : ''}>
          <span>${u.is_active === false ? 'ปิด' : 'ใช้งาน'}</span>
        </label>
      </td>
    </tr>`;
}

// ══════════════════════════════════════════════════════════
// แผงติ๊กทีมที่ดูข้ามได้
// ══════════════════════════════════════════════════════════

function openAccess(host, user, teams, current, onSaved) {
  if (!user) return;
  const own = user.team_id;

  host.innerHTML = `
    <div class="modal" id="acModal">
      <form class="modal-box modal-sm" id="acForm">
        <div class="modal-head">
          <strong>ทีมที่ ${esc(user.full_name || user.email)} ดูได้</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="acClose">ปิด</button>
        </div>
        <div class="modal-body">
          <p class="sec-foot" style="margin:0 0 12px">
            ติ๊กทีมที่ให้ดูข้ามได้ · <b>ทีมหลักของตัวเองเห็นอยู่แล้ว ไม่ต้องติ๊ก</b><br>
            ให้สิทธิ์ตรงนี้แล้วเห็นครบทุกแถบ — งาน Pending · Book 3 สี · แผนติดต่อลูกค้า
          </p>
          <ul class="aclist">
            ${teams.map(t => {
              const isOwn = t.id === own;
              return `<li>
                <label class="${isOwn ? 'is-own' : ''}">
                  <input type="checkbox" value="${esc(t.id)}"
                         ${current.includes(t.id) || isOwn ? 'checked' : ''} ${isOwn ? 'disabled' : ''}>
                  <b>${esc(t.code)}</b> <span>${esc(t.name || '')}</span>
                  ${isOwn ? '<em>ทีมหลัก</em>' : ''}
                </label>
              </li>`;
            }).join('')}
          </ul>
        </div>
        <p class="login-err" id="acErr" role="alert" hidden></p>
        <div class="modal-foot">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" id="acCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" id="acSave">บันทึกสิทธิ์</button>
        </div>
      </form>
    </div>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.innerHTML = ''; };
  q('#acClose').addEventListener('click', close);
  q('#acCancel').addEventListener('click', close);
  q('#acModal').addEventListener('mousedown', (e) => { if (e.target.id === 'acModal') close(); });

  q('#acForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    // ทีมหลักถูก disabled ไว้ → ไม่ถูกเก็บลง team_access (ถูกแล้ว ไม่ต้องเก็บซ้ำ)
    const picked = [...host.querySelectorAll('.aclist input:checked:not(:disabled)')].map(i => i.value);
    const btn = q('#acSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.setTeamAccess(user.id, picked);
      close();
      await onSaved();
    } catch (e) {
      q('#acErr').textContent = e.message;
      q('#acErr').hidden = false;
      btn.disabled = false; btn.textContent = 'บันทึกสิทธิ์';
    }
  });
}
