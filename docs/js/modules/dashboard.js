// F3 — Dashboard ภาพรวม (Phase 1.5)
//
// ตัวเลขทุกตัวคำนวณจากรายการ pending ที่ดึงมาชุดเดียว ไม่ได้ใช้ views.sql
// เหตุผล: ข้อมูลระดับทีมขาย (หลักร้อยแถว) คำนวณในเบราว์เซอร์เร็วกว่าเพิ่ม migration
//         + ใช้ได้ทันทีโดยไม่ต้องรอเอา SQL ไปรันใน Supabase
//         + RLS ยังคุมเหมือนเดิม — แต่ละคนเห็นตัวเลขเฉพาะงานที่ตัวเองมีสิทธิ์
// ถ้าวันหนึ่งข้อมูลโตจนช้า ค่อยย้ายไป views.sql/RPC โดยไม่ต้องแตะ UI (แค่เปลี่ยน adapter)

import { adapter } from '../data/adapter.js';
import { CONFIG } from '../config.js';
import { STAGES } from './pending.js';
import { bucketize, dueNow, ACT_TYPES } from './activities.js';
import { thaiDate, todayISO } from '../ui/datepicker.js';

// ── ตัวช่วย ──
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const MB = (v) => (Number(v || 0) / 1e6);
const fmtMB = (v) => MB(v).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return y && m ? `${TH_MON[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}` : ym;
};

/** ไล่เดือนจาก 'YYYY-MM' ถึง 'YYYY-MM' (รวมปลายทั้งสองข้าง) */
function monthRange(from, to) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * เดือนที่ใช้นับงานเข้าเป้า
 * ปิดได้แล้ว → ใช้วันสั่งซื้อจริง (purchased_day) เป็นหลัก
 * ยังไม่ปิด  → ใช้เดือนที่คาดปิด (close_month)
 */
// export เพราะหน้าทีมขาย (step 3.2) ต้องนับ "ปิดได้แล้ว" ด้วยกติกาเดียวกันเป๊ะ
// ⚠️ ห้ามก๊อปสามบรรทัดนี้ไปไว้ที่อื่น ถ้าสองหน้าใช้กติกาคนละแบบ ตัวเลขจะขัดกันเองบนหน้าจอ
export const monthOf = (r) =>
  (r.stage === 'won' && r.purchased_day)
    ? String(r.purchased_day).slice(0, 7)
    : (r.close_month || null);

const probOf = (id) => (STAGES.find(s => s.id === id)?.prob ?? 0) / 100;

// ══════════════════════════════════════════════════════════
// คำนวณตัวเลขสรุป (แยกออกมาเป็นฟังก์ชันบริสุทธิ์ ทดสอบง่าย)
// ══════════════════════════════════════════════════════════

export function summarize(rows, opt = {}) {
  const from   = opt.from   || CONFIG.TARGET_FROM;
  const to     = opt.to     || CONFIG.TARGET_TO;
  const today  = opt.today  || todayISO();
  const target = (opt.targetMB ?? CONFIG.TARGET_MB) * 1e6;

  const months = monthRange(from, to);
  const inRange = (ym) => !!ym && ym >= from && ym <= to;

  const live = rows.filter(r => r.is_active !== false);

  // ── ยอดปิดได้จริง (นับเฉพาะที่อยู่ในช่วงเป้า) ──
  const wonRows = live.filter(r => r.stage === 'won' && inRange(monthOf(r)));
  const won = wonRows.reduce((a, r) => a + Number(r.value_baht || 0), 0);

  // ── pipeline ที่ยังเดินอยู่ (ไม่รวมปิดแล้ว/แพ้แล้ว) ──
  const openRows = live.filter(r => r.stage !== 'won' && r.stage !== 'lost');
  const pipeline = openRows.reduce((a, r) => a + Number(r.value_baht || 0), 0);
  // ถ่วงน้ำหนักด้วย % โอกาสของแต่ละขั้น — ตัวเลขที่ใช้พยากรณ์ได้จริงกว่ายอดดิบ
  const weighted = openRows.reduce((a, r) => a + Number(r.value_baht || 0) * probOf(r.stage), 0);

  // ── รายเดือน: แผน vs ปิดจริง ──
  // แผนรายเดือนจริงจะมาจาก app_settings ใน step 3.1 — ตอนนี้เกลี่ยเป้าเท่ากันทุกเดือนไปก่อน
  const planPerMonth = target / months.length;
  const byMonth = months.map(ym => ({
    ym,
    label: monthLabel(ym),
    plan: planPerMonth,
    won:  wonRows.filter(r => monthOf(r) === ym)
                 .reduce((a, r) => a + Number(r.value_baht || 0), 0),
    open: openRows.filter(r => monthOf(r) === ym)
                  .reduce((a, r) => a + Number(r.value_baht || 0), 0),
  }));

  // ── funnel ── (ไม่รวมแพ้ — แพ้ไม่ใช่ขั้นตอนหนึ่งของกรวย แต่คือหลุดออกจากกรวย)
  //
  // ⚠️ ขั้น 'won' ต้องกรองด้วยช่วงเป้าเหมือนการ์ด "ปิดได้แล้ว"
  //    ไม่งั้นงานที่ปิดไปตั้งแต่ก่อนเริ่มช่วงเป้าจะโผล่ใน funnel
  //    แล้วผู้ใช้เห็นเลขสองชุดขัดกันในหน้าเดียว (การ์ดบอก 15 ล้าน · funnel บอก 114 ล้าน)
  const funnel = STAGES.filter(s => s.id !== 'lost').map(s => {
    const list = s.id === 'won'
      ? wonRows
      : live.filter(r => r.stage === s.id);
    return {
      id: s.id, label: s.label, prob: s.prob,
      count: list.length,
      value: list.reduce((a, r) => a + Number(r.value_baht || 0), 0),
    };
  });

  const lost = live.filter(r => r.stage === 'lost');

  return {
    target, won, pipeline, weighted,
    pct: target ? (won / target) * 100 : 0,
    // coverage = pipeline ที่เหลือครอบคลุมส่วนที่ยังขาดกี่เท่า (ต่ำกว่า 3 เท่า = เสี่ยงพลาดเป้า)
    coverage: (target - won) > 0 ? pipeline / (target - won) : Infinity,
    gap: Math.max(0, target - won),
    byMonth, funnel,
    lostCount: lost.length,
    lostValue: lost.reduce((a, r) => a + Number(r.value_baht || 0), 0),
    top3: [...openRows].sort((a, b) => Number(b.value_baht || 0) - Number(a.value_baht || 0)).slice(0, 3),
    overdue: openRows.filter(r => r.next_date && r.next_date < today)
                     .sort((a, b) => String(a.next_date).localeCompare(String(b.next_date))),
    noMonth: openRows.filter(r => !r.close_month).length,
    totalOpen: openRows.length,
  };
}

// ══════════════════════════════════════════════════════════
// เป้ารายทีม + รวมขึ้นตามลำดับชั้น (step 3.10 ช่วง B)
//
// เป้าตั้งที่ "ทีมใบ" · ทีมแม่/องค์กร = ผลรวมของทีมลูก (เจ้าของเคาะ 23 ก.ค. 2569)
// ══════════════════════════════════════════════════════════

/** ขยายชุดทีมที่เลือก → รวมทีมลูก-หลานทั้งหมด (กันนับซ้ำเวลาเลือกทีมแม่+ลูกพร้อมกัน) */
export function expandTeams(teams, ids) {
  const want = new Set(ids || []);
  const out = new Set();
  let changed = true;
  // เพิ่มทีมที่เลือก แล้วไล่หาลูกจนไม่มีอะไรเพิ่ม
  for (const t of teams || []) if (want.has(t.id)) out.add(t.id);
  while (changed) {
    changed = false;
    for (const t of teams || []) {
      if (!out.has(t.id) && t.parent_team_id && out.has(t.parent_team_id)) { out.add(t.id); changed = true; }
    }
  }
  return out;
}

/**
 * รวมตัวเลขของ "ขอบเขต" ที่เลือก (ทีม + ทีมลูกทั้งหมด)
 * งาน 1 ชิ้นมี team_id เดียว → นับครั้งเดียวเสมอ แม้เลือกทั้งแม่และลูก
 */
export function sumScope(rows, teams, targetsMap, selectedIds, opt = {}) {
  const from = opt.from ?? CONFIG.TARGET_FROM;
  const to   = opt.to   ?? CONFIG.TARGET_TO;
  const inRange = (ym) => !!ym && ym >= from && ym <= to;
  const exp = expandTeams(teams, selectedIds);
  const live = (rows || []).filter(r => r.is_active !== false && exp.has(r.team_id));

  const wonRows = live.filter(r => r.stage === 'won' && inRange(monthOf(r)));
  const won = wonRows.reduce((a, r) => a + Number(r.value_baht || 0), 0);
  const openRows = live.filter(r => r.stage !== 'won' && r.stage !== 'lost');
  const pipeline = openRows.reduce((a, r) => a + Number(r.value_baht || 0), 0);

  // เป้า = ผลรวมของเป้าทุกทีมในขอบเขต (ปกติตั้งที่ทีมใบ ทีมแม่เป็น 0 → ไม่ซ้ำ)
  let target = 0;
  for (const id of exp) target += Number(targetsMap?.[id] || 0);

  return {
    teamIds: [...exp], won, pipeline,
    openCount: openRows.length, wonCount: wonRows.length,
    target, gap: Math.max(0, target - won),
    pct: target ? (won / target) * 100 : 0,
  };
}

/** ตารางรายทีม (แม่โชว์ยอดรวมลูก) เรียงตามลำดับชั้น */
export function teamBreakdown(rows, teams, targetsMap, opt = {}) {
  const tops = (teams || []).filter(t => !t.parent_team_id);
  const ordered = [];
  for (const t of tops) {
    ordered.push({ ...t, depth: 0 });
    for (const c of (teams || []).filter(x => x.parent_team_id === t.id)) ordered.push({ ...c, depth: 1 });
  }
  for (const t of teams || []) if (!ordered.some(o => o.id === t.id)) ordered.push({ ...t, depth: 0 });

  return ordered.map(t => {
    const st = sumScope(rows, teams, targetsMap, [t.id], opt);
    return { id: t.id, code: t.code, name: t.name, depth: t.depth,
             isParent: (teams || []).some(x => x.parent_team_id === t.id),
             ...st };
  });
}

// ══════════════════════════════════════════════════════════
// กราฟ — SVG ล้วน ไม่มี library
// ⚠️ สีต้องอ้าง var(--chart-N) เท่านั้น ห้ามฝัง hex (กติกาธีมใน CLAUDE.md)
// ══════════════════════════════════════════════════════════

/**
 * @param width ความกว้างจริงของกล่องเป็น px
 *
 * ⚠️ ต้องสร้าง SVG ตามความกว้างจริง ห้ามใช้ viewBox คงที่แล้วปล่อยให้ยืด
 *    viewBox คงที่ = ตัวหนังสือถูกย่อ/ขยายตามไปด้วย
 *    (เคยวัดได้ 4.4px บน iPhone อ่านไม่ออก · 18.7px บน desktop ใหญ่เกิน)
 *    ทำแบบนี้แล้วสเกล = 1 เสมอ ตัวหนังสือเป็น px จริงทุกจอ
 */
function barChart(byMonth, width) {
  const W = Math.round(Math.min(900, Math.max(300, width)));
  const H = 220, PAD_L = 44, PAD_B = 34, PAD_T = 12;
  const innerW = W - PAD_L - 12;
  const innerH = H - PAD_B - PAD_T;

  const maxV = Math.max(...byMonth.map(m => Math.max(m.plan, m.won, m.open)), 1);
  const step = innerW / byMonth.length;
  const bw = Math.min(22, step / 3.2);
  const y = (v) => PAD_T + innerH - (v / maxV) * innerH;

  // เส้นแนวนอนอ่านค่า 4 ระดับ
  const grid = [0, .25, .5, .75, 1].map(f => {
    const gy = PAD_T + innerH - f * innerH;
    return `<line x1="${PAD_L}" y1="${gy}" x2="${W - 12}" y2="${gy}"
                  stroke="var(--border-soft)" stroke-width="1"/>
            <text x="${PAD_L - 6}" y="${gy + 4}" text-anchor="end"
                  font-size="10" fill="var(--text-mute)">${(MB(maxV * f)).toFixed(0)}</text>`;
  }).join('');

  const bars = byMonth.map((m, i) => {
    const cx = PAD_L + step * i + step / 2;
    const b = (v, off, color, title) => v > 0 ? `
      <rect x="${cx + off - bw / 2}" y="${y(v)}" width="${bw}" height="${Math.max(1, PAD_T + innerH - y(v))}"
            rx="2" fill="${color}"><title>${title}: ${fmtMB(v)} ล้าน</title></rect>` : '';
    return `
      ${b(m.plan, -bw * 1.05, 'var(--chart-6)', 'แผน')}
      ${b(m.won,  0,          'var(--chart-3)', 'ปิดได้จริง')}
      ${b(m.open, bw * 1.05,  'var(--chart-1)', 'คาดปิด (ยังไม่ปิด)')}
      <text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="10.5"
            fill="var(--text-mute)">${esc(m.label)}</text>`;
  }).join('');

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="chart" role="img"
         aria-label="กราฟเปรียบเทียบแผนกับยอดปิดจริงรายเดือน หน่วยล้านบาท">
      ${grid}${bars}
    </svg>
    <div class="legend">
      <span><i style="background:var(--chart-6)"></i>แผน</span>
      <span><i style="background:var(--chart-3)"></i>ปิดได้จริง</span>
      <span><i style="background:var(--chart-1)"></i>คาดปิด (ยังไม่ปิด)</span>
    </div>`;
}

function funnelHtml(funnel) {
  const max = Math.max(...funnel.map(f => f.value), 1);
  return funnel.map(f => `
    <div class="fn-row">
      <span class="fn-label">${esc(f.label)}</span>
      <span class="fn-bar">
        <i style="width:${(f.value / max * 100).toFixed(1)}%;background:var(--stage-${f.id})"></i>
      </span>
      <span class="fn-val">${f.count} งาน · ${fmtMB(f.value)} ล.</span>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════

/**
 * แถบ "สิ่งที่ต้องทำ" จากแผนติดต่อลูกค้า (F6)
 * คืนสตริงว่างเมื่อยังไม่ได้สร้างตาราง — dashboard ต้องใช้งานได้ต่อโดยไม่มีส่วนนี้
 *
 * ⚠️ ต้องนับด้วย bucketize() ตัวเดียวกับหน้าแผนติดต่อลูกค้า
 *    ถ้าเขียนเงื่อนไข "เลยกำหนด" ซ้ำอีกที่ เลขสองหน้าจะเพี้ยนจากกันวันใดวันหนึ่ง
 *    (บทเรียนจาก 1.5: การ์ด "ปิดได้แล้ว" กับ funnel นับคนละแบบ)
 */
function actSection(acts) {
  if (!acts) return '';
  const now = dueNow(acts);
  const t0 = todayISO();
  const typeLabel = (id) => ACT_TYPES.find(t => t.id === id)?.label || '';

  return `
    <div class="card sec">
      <h3 class="sec-h">
        สิ่งที่ต้องทำวันนี้
        ${acts.overdue.length ? `<span class="badge-risk">${acts.overdue.length}</span>` : ''}
        <span class="sec-sub">
          เลยกำหนด ${acts.overdue.length} · วันนี้ ${acts.today.length} · ใน 7 วัน ${acts.soon.length}
        </span>
      </h3>
      ${now.length ? `<ul class="odlist">
        ${now.slice(0, 8).map(r => `<li>
          <span class="od-date ${r.due_date === t0 ? 'is-today' : ''}">${esc(thaiDate(r.due_date) || '—')}</span>
          <span class="od-name">${esc(r.title)}</span>
          <span class="od-act">${esc([typeLabel(r.act_type),
            r.pending_projects?.project_name || r.customers?.name || ''].filter(Boolean).join(' · '))}</span>
        </li>`).join('')}
      </ul>
      ${now.length > 8 ? `<p class="sec-foot">และอีก ${now.length - 8} รายการ — ดูทั้งหมดในแถบแผนติดต่อลูกค้า</p>` : ''}`
      : `<p class="sec-foot">ไม่มีอะไรค้างวันนี้ 👍${acts.soon.length ? ` · มี ${acts.soon.length} รายการรออยู่ใน 7 วันข้างหน้า` : ''}</p>`}
      <p class="sec-foot"><a class="lnk" href="#activities">เปิดแผนติดต่อลูกค้า →</a></p>
    </div>`;
}

const card = (label, value, note, cls = '') => `
  <div class="card ${cls}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-note">${note}</div>
  </div>`;

export default {
  title: 'ภาพรวม',
  subtitle: 'สรุปสถานะงานขายทั้งหมด',

  async render(root) {
    let rows;
    try {
      // ดึงงานที่ยังเดินอยู่ทั้งหมด (RLS คัดให้แล้วว่าคนนี้เห็นอะไรได้บ้าง)
      rows = await adapter.listPending({ status: 'active', limit: 1000 });
    } catch (e) {
      root.innerHTML = `<div class="empty"><strong>โหลดข้อมูลไม่สำเร็จ</strong>${esc(e.message)}</div>`;
      return;
    }

    // แผนติดต่อลูกค้าเป็นส่วนเสริม — ถ้ายังไม่ได้รัน phase2.sql ต้องไม่ทำ dashboard ทั้งหน้าล่ม
    let acts = null;
    try { acts = bucketize(await adapter.listActivities({ status: 'plan', limit: 500 })); }
    catch { acts = null; }

    // เป้ายอดขายมาจาก app_settings (แก้ได้ในหน้าตั้งค่าระบบ) · ยังไม่ได้รัน phase2-4.sql
    // ก็ตกกลับไปใช้ค่าใน config.js เหมือนเดิม ไม่ทำให้หน้าล่ม
    let goal = { target_mb: CONFIG.TARGET_MB, from: CONFIG.TARGET_FROM,
                 to: CONFIG.TARGET_TO, period: CONFIG.TARGET_PERIOD };
    try {
      const st = (await adapter.getSettings())?.sales_target;
      if (st?.target_mb) goal = { ...goal, ...st };
    } catch { /* ใช้ค่าตั้งต้น */ }

    if (!rows.length) {
      root.innerHTML = `
        <div class="grid cols-4">
          ${card('เป้ายอดขาย', `${esc(goal.target_mb)} ล้านบาท`, esc(goal.period))}
        </div>
        <div class="empty" style="margin-top:20px">
          <strong>ยังไม่มีข้อมูลให้สรุป</strong>
          เพิ่มงานในแถบ Pending Project แล้วตัวเลขจะขึ้นที่นี่อัตโนมัติ
        </div>
        ${actSection(acts)}`;
      return;
    }

    const opt = { from: goal.from, to: goal.to };
    // ความกว้างที่กราฟใช้ได้จริง = กว้างของพื้นที่เนื้อหา ลบ padding ของ .card (18px สองข้าง)
    const chartW = Math.max(300, (root.clientWidth || 720) - 40);

    // เป้ารายทีม + ลำดับชั้น + ลูกค้า Book 3 สี (ใช้กับตัวกรองทีมทั้งหน้า) — ไม่มีก็ข้ามเงียบ ๆ
    let teams = [], targetsMap = {}, custs = [];
    try {
      teams = await adapter.listTeams();
      const tt = await adapter.listTeamTargets();
      targetsMap = Object.fromEntries((tt || []).map(r => [r.team_id, Number(r.target_baht || 0)]));
    } catch { teams = []; }
    try { custs = await adapter.listCustomers({ status: 'active', limit: 2000 }); } catch { custs = []; }

    const tops = teams.filter(t => !t.parent_team_id).map(t => t.id);
    const showFilter = teams.length > 1;   // admin/หัวหน้าที่เห็นหลายทีม
    let selected = new Set();               // ว่าง = ทั้งองค์กร (รวม)

    // ── โครงหน้า: ตัวกรองทีมบนสุด (รวม/แยก) + เนื้อหาที่กรองได้ ──
    root.innerHTML = `
      ${showFilter ? `<div class="dash-scope" id="dashScope">
        <span class="dash-scope-l">ดูทีม:</span>
        <button type="button" class="chip on" data-scope="all">ทั้งองค์กร (รวม)</button>
        ${teams.map(t => `<button type="button" class="chip ${t.parent_team_id ? 'chip-sub' : ''}"
                            data-scope="team" data-team="${esc(t.id)}">${esc(t.code)}</button>`).join('')}
      </div>` : ''}
      <div id="dashBody"></div>`;

    const body = root.querySelector('#dashBody');

    // วาดเนื้อหาทั้งหมดตาม "ขอบเขตทีม" ที่เลือก — เลือกทีมไหน ทุกส่วน (KPI/กราฟ/funnel/top3/
    // เลยกำหนด/ลูกค้า Book 3 สี) นับเฉพาะทีมนั้น · ไม่เลือก = รวมทั้งองค์กร
    function paintBody() {
      const ids = selected.size ? [...selected] : tops;
      const exp = expandTeams(teams, ids);
      const scoped  = selected.size ? rows.filter(r => exp.has(r.team_id))  : rows;
      const scopedC = selected.size ? custs.filter(c => exp.has(c.team_id)) : custs;
      const picked  = selected.size
        ? teams.filter(t => selected.has(t.id)).map(t => t.code).join(' + ')
        : 'ทั้งองค์กร';

      // เป้าของขอบเขต: ทั้งองค์กร = เป้ารวม (settings) · เลือกทีม = ผลรวมเป้าทีมในขอบเขต
      let targetBaht = Number(goal.target_mb || 0) * 1e6;
      if (selected.size) { targetBaht = 0; for (const id of exp) targetBaht += Number(targetsMap[id] || 0); }

      const s = summarize(scoped, { from: goal.from, to: goal.to, targetMB: targetBaht / 1e6 });
      const cov = s.coverage === Infinity ? '∞' : s.coverage.toFixed(1) + '×';
      const covRisk = s.coverage !== Infinity && s.coverage < 3;
      const pctTxt = targetBaht ? s.pct.toFixed(1) + '%' : '—';

      body.innerHTML = `
        ${selected.size ? `<div class="dash-scope-note">กำลังดูเฉพาะ <b>${esc(picked)}</b> · ตัวเลขด้านล่างนับเฉพาะขอบเขตนี้</div>` : ''}
        <div class="grid cols-4">
          ${card('เป้ายอดขาย', `${targetBaht ? fmtMB(targetBaht) : '—'} ล้านบาท`,
                 selected.size ? esc(picked) : esc(goal.period))}
          ${card('ปิดได้แล้ว', `${fmtMB(s.won)} ล้าน`,
                 `${pctTxt} ของเป้า · ขาดอีก ${fmtMB(s.gap)} ล้าน`)}
          ${card('Pipeline ถ่วงน้ำหนัก', `${fmtMB(s.weighted)} ล้าน`,
                 `จากงานที่ยังเดินอยู่ ${fmtMB(s.pipeline)} ล้าน`)}
          ${card('Pipeline coverage', cov,
                 covRisk ? '⚠ ต่ำกว่า 3 เท่า — เสี่ยงพลาดเป้า' : 'ครอบคลุมส่วนที่ยังขาด',
                 covRisk ? 'is-risk' : '')}
        </div>

        <div class="card sec prog-card">
          <h3 class="sec-h">ความคืบหน้าเทียบเป้า
            <span class="sec-sub">${selected.size ? esc(picked) : esc(goal.period)}</span></h3>
          <div class="prog"><i style="width:${Math.min(100, s.pct).toFixed(1)}%"></i></div>
          <div class="prog-note">${fmtMB(s.won)} / ${targetBaht ? fmtMB(targetBaht) : '—'} ล้านบาท (${pctTxt})</div>
        </div>

        <div class="card sec">
          <h3 class="sec-h">แผน vs ปิดจริง รายเดือน <span class="sec-sub">หน่วย: ล้านบาท</span></h3>
          ${barChart(s.byMonth, chartW)}
        </div>

        ${teams.length > 1 ? teamBreakdownSection(rows, teams, targetsMap, opt) : ''}
        ${(custs.length || showFilter) ? customerCard(scopedC, picked, selected.size > 0) : ''}

        <div class="grid cols-2 sec-grid">
          <div class="card sec">
            <h3 class="sec-h">Funnel งานขาย <span class="sec-sub">ขั้น "ปิดได้" นับเฉพาะในช่วงเป้า</span></h3>
            ${funnelHtml(s.funnel)}
            ${s.lostCount ? `<p class="sec-foot">แพ้/ยกเลิก ${s.lostCount} งาน · ${fmtMB(s.lostValue)} ล้าน</p>` : ''}
          </div>

          <div class="card sec">
            <h3 class="sec-h">3 งานใหญ่ที่สุดที่ยังไม่ปิด</h3>
            ${s.top3.length ? `<ol class="top3">
              ${s.top3.map(r => `<li>
                <span class="t3-name">${esc(r.project_name)}</span>
                <span class="t3-meta">${esc(r.customer_name || '')}</span>
                <b>${fmtMB(r.value_baht)} ล้าน</b>
              </li>`).join('')}
            </ol>` : '<p class="sec-foot">ยังไม่มีงานที่เปิดอยู่ในขอบเขตนี้</p>'}
          </div>
        </div>

        ${recentPendingSection(scoped)}

        ${selected.size ? '' : actSection(acts)}

        <div class="card sec">
          <h3 class="sec-h">
            งาน Pending ที่เลยกำหนดติดตาม
            ${s.overdue.length ? `<span class="badge-risk">${s.overdue.length}</span>` : ''}
            <span class="sec-sub">จากช่อง NEXT DATE ของงาน</span>
          </h3>
          ${s.overdue.length ? `<ul class="odlist">
            ${s.overdue.slice(0, 8).map(r => `<li>
              <span class="od-date">${esc(thaiDate(r.next_date) || r.next_date)}</span>
              <span class="od-name">${esc(r.project_name)}</span>
              <span class="od-act">${esc(r.next_action || '')}</span>
            </li>`).join('')}
          </ul>
          ${s.overdue.length > 8 ? `<p class="sec-foot">และอีก ${s.overdue.length - 8} งาน — ดูทั้งหมดในแถบ Pending Project</p>` : ''}`
          : '<p class="sec-foot">ไม่มีงานเลยกำหนด 👍</p>'}
          ${s.noMonth ? `<p class="sec-foot">⚠ มี ${s.noMonth} งานที่ยังไม่ระบุเดือนคาดปิด — จะไม่ถูกนับในกราฟรายเดือน</p>` : ''}
        </div>`;
    }

    if (showFilter) {
      const scope = root.querySelector('#dashScope');
      scope.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-scope]');
        if (!btn) return;
        if (btn.dataset.scope === 'all') selected.clear();
        else { const id = btn.dataset.team; if (selected.has(id)) selected.delete(id); else selected.add(id); }
        scope.querySelector('[data-scope="all"]').classList.toggle('on', selected.size === 0);
        scope.querySelectorAll('[data-scope="team"]').forEach(b => b.classList.toggle('on', selected.has(b.dataset.team)));
        paintBody();
      });
    }
    paintBody();
  },
};

// ══════════════════════════════════════════════════════════
// ส่วน "เป้าหมายตามทีม" — ตาราง + ตัวเลือกกลุ่ม + กล่องสรุป (step 3.10 ช่วง B)
// ══════════════════════════════════════════════════════════

// ตารางรายทีม = มุมมอง "แยก" (โชว์ทุกทีมเสมอ · ตัวกรองบนสุดคุมมุมมอง "รวม" ที่ KPI แทน)
function teamBreakdownSection(rows, teams, targetsMap, opt) {
  const rowsB = teamBreakdown(rows, teams, targetsMap, opt);
  const bar = (pct) => `<div class="tt-bar"><span style="width:${Math.min(100, pct).toFixed(0)}%"></span></div>`;

  return `
    <div class="card sec">
      <h3 class="sec-h">เป้าหมายตามทีม (แยก)
        <span class="sec-sub">ทุกทีม · เป้าตั้งที่ทีมย่อย · ทีมแม่ = ผลรวม</span></h3>

      <div class="tbl-wrap">
        <table class="tbl tt-tbl">
          <thead><tr>
            <th style="min-width:150px">ทีม</th>
            <th class="tt-num">เป้า (ล้าน)</th>
            <th class="tt-num">ปิดได้ (ล้าน)</th>
            <th style="min-width:120px">ความคืบหน้า</th>
            <th class="tt-num">งานที่เดินอยู่</th>
          </tr></thead>
          <tbody>
            ${rowsB.map(t => `<tr class="${t.depth ? 'tt-sub' : ''} ${t.isParent ? 'tt-parent' : ''}">
              <td><b>${esc(t.code)}</b> <span class="tt-name">${esc(t.name || '')}</span></td>
              <td class="tt-num">${t.target ? fmtMB(t.target) : '—'}</td>
              <td class="tt-num">${fmtMB(t.won)}</td>
              <td>${bar(t.pct)}<span class="tt-pct">${t.target ? t.pct.toFixed(0) + '%' : '—'}</span></td>
              <td class="tt-num">${t.openCount}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="sec-foot">ตั้งตัวเลขเป้าของแต่ละทีมได้ที่หน้า "ตั้งค่าระบบ" (เฉพาะผู้ดูแล/หัวหน้าที่แก้ทีมนั้นได้)</p>
    </div>`;
}

// ══════════════════════════════════════════════════════════
// Pending ล่าสุด — ตารางงานที่อัปเดตล่าสุด (เจ้าของขอ 24 ก.ค. 2569)
// admin เห็นของทุกทีม · sale เห็นเฉพาะทีมตัวเอง — RLS คัดมาให้แล้วใน rows
// (ที่นี่ใช้ scoped = ผ่านตัวกรองทีมบน dashboard อีกชั้น)
// ══════════════════════════════════════════════════════════
function recentPendingSection(scoped) {
  const recent = (scoped || [])
    .filter(r => r.is_active !== false)
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, 8);
  if (!recent.length) return '';
  const stagePill = (id) => {
    const s = STAGES.find(x => x.id === id) || STAGES[0];
    return `<span class="tag" style="--tag-c:var(--stage-${s.id})">${esc(s.label)}</span>`;
  };
  return `
    <div class="card sec">
      <h3 class="sec-h">Pending Project ล่าสุด <span class="sec-sub">${recent.length} รายการที่อัปเดตล่าสุด</span></h3>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th class="nosort">โครงการ</th>
            <th class="nosort">หน่วยงาน</th>
            <th class="num nosort">มูลค่า (บาท)</th>
            <th class="nosort">ขั้นตอน</th>
          </tr></thead>
          <tbody>
            ${recent.map(r => `<tr class="no-click">
              <td><b>${esc(r.project_name || '—')}</b></td>
              <td>${esc(r.customer_name || '')}</td>
              <td class="num">${Number(r.value_baht || 0).toLocaleString('th-TH')}</td>
              <td>${stagePill(r.stage)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="sec-foot"><a class="lnk" href="#pending">เปิด Pending Project →</a></p>
    </div>`;
}

// ลูกค้า Book 3 สี ในขอบเขตที่เลือก (นับตามสี) — ให้ตัวกรองครอบทั้ง Pending + Book 3 สี ตามที่ขอ
const DASH_COLORS = [['green', '🟢'], ['yellow', '🟡'], ['red', '🔴']];
function customerCard(custs, picked, scoped) {
  const total = (custs || []).length;
  return `
    <div class="card sec">
      <h3 class="sec-h">ลูกค้า Book 3 สี
        <span class="sec-sub">${scoped ? esc(picked) : 'ทั้งองค์กร'}</span></h3>
      <div class="cust-sum">
        <div class="cust-total"><span class="cust-n">${total}</span><span class="cust-l">รายในขอบเขต</span></div>
        ${DASH_COLORS.map(([c, dot]) =>
          `<div class="cust-c"><span class="cust-dot">${dot}</span><b>${(custs || []).filter(x => x.color === c).length}</b></div>`).join('')}
      </div>
      <p class="sec-foot"><a class="lnk" href="#book3">เปิด Book 3 สี →</a></p>
    </div>`;
}
