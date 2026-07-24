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
import { buildBackup, BACKUP_FORMAT } from '../data/import-map.js';

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
    // admin = จัดการทั้งหมด · manager = เห็นเฉพาะเป้ารายทีม (แก้ทีมตัวเองได้) · sale = ไม่เข้า
    const isAdmin = me?.role === 'admin';

    if (me?.role !== 'admin' && me?.role !== 'manager') {
      root.innerHTML = `<div class="empty">
          <strong>หน้านี้สำหรับผู้ดูแลระบบและหัวหน้างานเท่านั้น</strong>
          บัญชีของคุณเป็น "${esc(roleOf(me?.role).label)}" — ถ้าต้องการสิทธิ์เพิ่ม ให้ติดต่อผู้ดูแลระบบ
        </div>`;
      return;
    }

    root.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';

    let profiles = [], teams = [], access = [], settings = {}, teamTargets = [];
    try {
      [profiles, teams, access, settings, teamTargets] = await Promise.all([
        adapter.listProfiles(),
        adapter.listTeams(),
        adapter.listTeamAccess(),
        adapter.getSettings().catch(() => ({})),
        adapter.listTeamTargets().catch(() => []),
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
    // คืนแถว team_access เต็ม (มี can_edit) ไม่ใช่แค่ team_id — step 3.10 ต้องรู้ว่าดูได้/แก้ได้
    const accessOf = (pid) => access.filter(a => a.profile_id === pid);

    root.innerHTML = `
      ${isAdmin ? `<div class="card sec">
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
      </div>` : `<p class="sec-foot" style="margin:0 0 4px">คุณเป็น <b>หัวหน้างาน</b> — ตั้งได้เฉพาะเป้าของทีมที่ดูแล · จัดการผู้ใช้/ทีม/สำรองข้อมูล เป็นสิทธิ์ผู้ดูแลระบบ</p>`}

      <div class="card sec">
        <h3 class="sec-h">เป้ารายทีม <span class="sec-sub">ตั้งที่ทีมย่อย · ทีมแม่/องค์กร = ผลรวม</span></h3>
        <p class="sec-foot" style="margin:0 0 10px">
          กรอกเป้าของแต่ละทีม (ล้านบาท) — หน้าภาพรวมจะรวมขึ้นเป็นทีมใหญ่และองค์กรให้เอง
        </p>
        <div class="ttedit" id="ttEdit">
          ${teamTree(teams).map(t => {
            const cur = teamTargets.find(x => x.team_id === t.id);
            const isParent = teams.some(x => x.parent_team_id === t.id);
            return `<label class="ttrow ${t.parent_team_id ? 'is-sub' : ''}">
              <span class="ttrow-name"><b>${esc(t.code)}</b> <span>${esc(t.name || '')}</span>
                ${isParent ? '<em>= ผลรวมทีมย่อย</em>' : ''}</span>
              <input type="number" min="0" step="0.1" class="inp inp-sm ttrow-inp"
                     data-team="${esc(t.id)}" ${isParent ? 'disabled title="เป้าทีมแม่คิดจากผลรวมทีมย่อย"' : ''}
                     value="${cur ? esc(Number(cur.target_baht) / 1e6) : ''}" placeholder="—">
            </label>`;
          }).join('')}
        </div>
        <div class="tt-total">
          <span>รวมทั้งองค์กร (ทุกทีม)</span>
          <b><span id="ttOrgTotal">0</span> ล้านบาท</b>
        </div>
        <p class="login-err" id="ttErr" role="alert" hidden></p>
      </div>

      ${isAdmin ? `<div class="card sec">
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
        <h3 class="sec-h">ทีม <span class="sec-sub">${teams.length} ทีม · ทีมย่อยเยื้องขวา</span></h3>
        <ul class="tmlist" id="tmList">
          ${teamTree(teams).map(t => `<li class="${t.parent_team_id ? 'is-sub' : ''}">
            <b>${esc(t.code)}</b><span>${esc(t.name || '')}</span>
            ${t.parent_team_id ? `<em>ทีมย่อยของ ${esc(teams.find(x => x.id === t.parent_team_id)?.code || '')}</em>` : ''}
          </li>`).join('')}
        </ul>
        <p class="sec-foot" style="margin:8px 0 0">
          ให้สิทธิ์ "ทีมแม่" = เห็นทีมย่อยทั้งหมดอัตโนมัติ (เช่นให้ TE-IMP = เห็น IMP1 + IMP2)
        </p>
        <form class="qadd" id="tmForm" style="margin-top:10px">
          <input class="inp" id="tmCode" placeholder="รหัสทีม เช่น GOV.5" maxlength="20" style="flex:0 0 130px">
          <input class="inp" id="tmName" placeholder="ชื่อเต็มของทีม">
          <select class="inp" id="tmParent" style="flex:0 0 160px">
            <option value="">— ทีมระดับบนสุด —</option>
            ${teams.filter(t => !t.parent_team_id).map(t => `<option value="${esc(t.id)}">ทีมย่อยของ ${esc(t.code)}</option>`).join('')}
          </select>
          <button type="submit" class="btn btn-ghost btn-sm">+ เพิ่มทีม</button>
        </form>
        <p class="login-err" id="tmErr" role="alert" hidden></p>
      </div>

      <div class="card sec">
        <h3 class="sec-h">สำรอง &amp; กู้คืนข้อมูล <span class="sec-sub">ไฟล์เดียวครบทุกตาราง</span></h3>
        <p class="sec-foot" style="margin:0 0 12px">
          รูทีนแนะนำ: กด <b>ดาวน์โหลด backup</b> ทุกวันศุกร์ เก็บไฟล์ไว้นอกระบบ (Google Drive / คอมส่วนตัว)
          — Supabase สำรองอัตโนมัติวันละครั้งเก็บ 7 วันอยู่แล้ว แต่กู้ได้ทีละทั้งโปรเจกต์
          ไฟล์นี้ให้กู้เฉพาะจุดได้ · ตาราง CSV รายหน้าอยู่ที่ปุ่ม ⭳ CSV ในแต่ละแถบ
        </p>
        <div class="bk-actions">
          <button type="button" class="btn btn-primary btn-sm" id="bkExport">⭳ ดาวน์โหลด backup (JSON)</button>
          <label class="btn btn-ghost btn-sm bk-file">
            ⭱ กู้คืนจากไฟล์ backup
            <input type="file" id="bkFile" accept="application/json,.json" hidden>
          </label>
          <span class="lg-hint" id="bkMsg"></span>
        </div>
        <p class="bk-warn" id="bkWarn" hidden></p>
      </div>` : ''}

      <div id="aPanel"></div>`;

    const $ = (s) => root.querySelector(s);
    const flash = (el, msg, bad = false) => {
      el.textContent = msg;
      el.hidden = false;
      el.classList.toggle('ok-msg', !bad);
      if (!bad) setTimeout(() => { el.hidden = true; }, 4000);
    };

    // ── เป้ายอดขาย ──
    $('#tgForm')?.addEventListener('submit', async (ev) => {
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

    // ── เป้ารายทีม: บันทึกเมื่อออกจากช่อง (เก็บเป็นบาท · จอกรอกล้านบาท) ──
    //
    // ⭐ ทีมแม่ (TE-IMP) แสดง "ผลรวมทีมย่อย" อัตโนมัติ + กล่องรวมทั้งองค์กร — คิดสด ๆ ตอนพิมพ์
    //    ทีมแม่ input ถูก disabled (ตั้งเป้าที่ทีมใบเท่านั้น) เราแค่เอาผลรวมมาโชว์ในช่องนั้น
    function recomputeTT() {
      const val = {};
      root.querySelectorAll('.ttrow-inp:not([disabled])').forEach(inp => {
        val[inp.dataset.team] = Number(inp.value) || 0;
      });
      const sumOf = (id) => {
        const kids = teams.filter(t => t.parent_team_id === id);
        return kids.length ? kids.reduce((a, k) => a + sumOf(k.id), 0) : (val[id] || 0);
      };
      // ทีมแม่โชว์ผลรวมทีมย่อย (ยังคง disabled ไว้ — แค่แสดง)
      root.querySelectorAll('.ttrow-inp[disabled]').forEach(inp => {
        const s = sumOf(inp.dataset.team);
        inp.value = s ? s : '';
      });
      const org = teams.filter(t => !t.parent_team_id).reduce((a, t) => a + sumOf(t.id), 0);
      const el = $('#ttOrgTotal');
      if (el) el.textContent = org.toLocaleString('th-TH');
    }

    root.querySelectorAll('.ttrow-inp').forEach(inp => {
      // พิมพ์ปุ๊บ ผลรวมทีมแม่/องค์กรอัปเดตทันที (ยังไม่บันทึก)
      inp.addEventListener('input', recomputeTT);
      // ออกจากช่อง = บันทึกจริง
      inp.addEventListener('change', async () => {
        const mb = Number(inp.value);
        if (inp.value !== '' && (!Number.isFinite(mb) || mb < 0))
          return flash($('#ttErr'), 'เป้าต้องเป็นตัวเลขไม่ติดลบ', true);
        inp.disabled = true;
        try {
          await adapter.saveTeamTarget(inp.dataset.team, (Number(inp.value) || 0) * 1e6);
          flash($('#ttErr'), '✓ บันทึกเป้าทีมแล้ว');
        } catch (e) { flash($('#ttErr'), e.message, true); }
        inp.disabled = false;
        recomputeTT();
      });
    });
    recomputeTT();   // คิดผลรวมตอนเปิดหน้า

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

    // ── เพิ่มทีม (+ ทีมแม่) ──
    $('#tmForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = $('#tmCode').value.trim(), name = $('#tmName').value.trim();
      const parent = $('#tmParent').value || null;
      if (!code) return flash($('#tmErr'), 'กรอกรหัสทีมก่อน', true);
      if (teams.some(t => t.code.toLowerCase() === code.toLowerCase()))
        return flash($('#tmErr'), `มีทีมรหัส "${code}" อยู่แล้ว`, true);
      try {
        await adapter.saveTeam({ code, name: name || code, parent_team_id: parent });
        await renderAdmin(root);
      } catch (e) { flash($('#tmErr'), e.message, true); }
    });

    // ── สำรอง & กู้คืน (step 3.6) ──
    $('#bkExport')?.addEventListener('click', async () => {
      const btn = $('#bkExport');
      btn.disabled = true; btn.textContent = 'กำลังรวบรวม…';
      try {
        const tables = await adapter.exportAll();
        const backup = buildBackup(tables);
        const count = Object.values(tables).reduce((a, r) => a + (Array.isArray(r) ? r.length : 0), 0);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `te-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        flash($('#bkMsg'), `✓ ดาวน์โหลดแล้ว — ${count} แถวจากทุกตาราง`);
      } catch (e) { flash($('#bkMsg'), 'สำรองไม่สำเร็จ: ' + e.message, true); }
      btn.disabled = false; btn.textContent = '⭳ ดาวน์โหลด backup (JSON)';
    });

    // กู้คืน — ยืนยัน 2 ขั้น เพราะเขียนทับข้อมูลปัจจุบัน
    let pendingRestore = null;
    $('#bkFile')?.addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      ev.target.value = '';                 // ให้เลือกไฟล์เดิมซ้ำได้
      if (!file) return;
      const warn = $('#bkWarn');
      try {
        const data = JSON.parse(await file.text());
        if (data?._format !== BACKUP_FORMAT || !data.tables)
          throw new Error('ไม่ใช่ไฟล์ backup ของระบบนี้ (ต้องเป็น te-backup-*.json ที่ปุ่มด้านบน export ออก)');
        const n = Object.values(data.tables).reduce((a, r) => a + (Array.isArray(r) ? r.length : 0), 0);
        pendingRestore = data.tables;
        warn.innerHTML = `ไฟล์ลงวันที่ <b>${esc((data.exported_at || '').slice(0, 10))}</b> · ${n} แถว
          — จะ<b>เขียนทับ</b>ข้อมูลที่ id ตรงกัน (โปรเจกต์เดิม) ·
          <button type="button" class="btn btn-danger btn-sm" id="bkGo">ยืนยันกู้คืน</button>`;
        warn.hidden = false;
        $('#bkGo').addEventListener('click', async () => {
          const go = $('#bkGo');
          go.disabled = true; go.textContent = 'กำลังกู้คืน…';
          try {
            const summary = await adapter.restoreBackup(pendingRestore);
            const ok = Object.entries(summary).map(([t, v]) => `${t}: ${v}`).join(' · ');
            warn.hidden = true;
            flash($('#bkMsg'), '✓ กู้คืนแล้ว — ' + ok);
            setTimeout(() => renderAdmin(root), 800);
          } catch (e) {
            go.disabled = false; go.textContent = 'ยืนยันกู้คืน';
            flash($('#bkMsg'), 'กู้คืนไม่สำเร็จ: ' + e.message, true);
          }
        });
      } catch (e) { warn.hidden = true; flash($('#bkMsg'), e.message, true); }
    });
}

/** เรียงทีมแบบ แม่→ลูก (ลูกอยู่ใต้แม่ทันที) สำหรับแสดงผลเป็นลำดับชั้น */
function teamTree(teams) {
  const tops = teams.filter(t => !t.parent_team_id);
  const out = [];
  for (const t of tops) {
    out.push(t);
    out.push(...teams.filter(c => c.parent_team_id === t.id));
  }
  // ทีมที่แม่ถูกลบไป (parent ไม่อยู่ในลิสต์) — ต่อท้ายไว้ ไม่ให้หาย
  for (const t of teams) if (!out.includes(t)) out.push(t);
  return out;
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
      <td>
        <div>${esc(u.full_name || '(ยังไม่ตั้งชื่อ)')}${isMe ? ' <span class="tag-me">คุณ</span>' : ''}</div>
        <input class="inp inp-sm u-title" data-user="${esc(u.id)}" data-field="title"
               value="${esc(u.title || '')}" placeholder="ตำแหน่ง เช่น ผู้จัดการส่วน IMP1"
               title="ตำแหน่งตาม org chart — แสดงบนหน้าทีมขาย">
      </td>
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
  // current = แถว team_access เดิม (มี can_edit) · แปลงเป็น map ไว้เช็ก
  const cur = new Map((current || []).map(a => [a.team_id, a.can_edit !== false]));
  const ordered = teamTree(teams);

  host.innerHTML = `
    <div class="modal" id="acModal">
      <form class="modal-box modal-sm" id="acForm">
        <div class="modal-head">
          <strong>ทีมที่ ${esc(user.full_name || user.email)} ดูได้</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="acClose">ปิด</button>
        </div>
        <div class="modal-body">
          <p class="sec-foot" style="margin:0 0 10px">
            ติ๊ก <b>ดู</b> = เห็นข้อมูลทีมนั้น · ติ๊ก <b>แก้</b> = แก้ข้อมูลได้ด้วย (ไม่ติ๊ก = ดูอย่างเดียว)<br>
            <b>ทีมหลักของตัวเองเห็น+แก้อยู่แล้ว</b> · ให้สิทธิ์ทีมแม่ = ครอบทีมย่อยทั้งหมด
          </p>
          <div class="ac-quick">
            <button type="button" class="btn btn-ghost btn-sm" id="acAll">✓ เห็นทั้งองค์กร (ทุกทีมบนสุด)</button>
            <button type="button" class="btn btn-ghost btn-sm" id="acNone">ล้างทั้งหมด</button>
          </div>
          <ul class="aclist">
            <li class="ac-head"><span></span><span class="ac-col">ดู</span><span class="ac-col">แก้</span></li>
            ${ordered.map(t => {
              const isOwn = t.id === own;
              const view = cur.has(t.id) || isOwn;
              const edit = isOwn || cur.get(t.id) === true;
              const sub = t.parent_team_id ? 'is-sub' : '';
              return `<li class="acrow ${isOwn ? 'is-own' : ''} ${sub}" data-team="${esc(t.id)}"
                          data-top="${t.parent_team_id ? '' : '1'}">
                <span class="ac-name"><b>${esc(t.code)}</b> <span>${esc(t.name || '')}</span>
                  ${isOwn ? '<em>ทีมหลัก</em>' : ''}</span>
                <span class="ac-col"><input type="checkbox" data-view value="${esc(t.id)}"
                       ${view ? 'checked' : ''} ${isOwn ? 'disabled' : ''}></span>
                <span class="ac-col"><input type="checkbox" data-edit
                       ${edit ? 'checked' : ''} ${isOwn ? 'disabled' : ''} ${view ? '' : 'disabled'}></span>
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

  // "แก้" ติ๊กได้เฉพาะเมื่อ "ดู" ติ๊กอยู่ — ยกเลิกดู = ยกเลิกแก้ตาม
  host.querySelectorAll('.acrow').forEach(row => {
    const v = row.querySelector('[data-view]'), e = row.querySelector('[data-edit]');
    if (!v || !e) return;
    v.addEventListener('change', () => {
      e.disabled = !v.checked;
      if (!v.checked) e.checked = false;
    });
  });

  q('#acAll').addEventListener('click', () => {
    host.querySelectorAll('.acrow[data-top="1"] [data-view]:not(:disabled)').forEach(v => {
      v.checked = true; const e = v.closest('.acrow').querySelector('[data-edit]'); if (e) e.disabled = false;
    });
  });
  q('#acNone').addEventListener('click', () => {
    host.querySelectorAll('.acrow [data-view]:not(:disabled)').forEach(v => { v.checked = false; });
    host.querySelectorAll('.acrow [data-edit]:not(:disabled)').forEach(e => { e.checked = false; e.disabled = true; });
  });

  q('#acForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    // ทีมหลัก (disabled) ไม่เก็บซ้ำ — เจ้าของทีมเห็น+แก้อยู่แล้วโดย RLS
    const grants = [...host.querySelectorAll('.acrow')].map(row => {
      const v = row.querySelector('[data-view]');
      if (!v || v.disabled || !v.checked) return null;
      return { team_id: v.value, can_edit: row.querySelector('[data-edit]')?.checked === true };
    }).filter(Boolean);
    const btn = q('#acSave');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await adapter.setTeamAccess(user.id, grants);
      close();
      await onSaved();
    } catch (e) {
      q('#acErr').textContent = e.message;
      q('#acErr').hidden = false;
      btn.disabled = false; btn.textContent = 'บันทึกสิทธิ์';
    }
  });
}
