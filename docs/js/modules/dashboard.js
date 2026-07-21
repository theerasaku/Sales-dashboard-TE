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
const monthOf = (r) =>
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
  const today  = opt.today  || new Date().toISOString().slice(0, 10);
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
      rows = await adapter.listPending({ activeOnly: true, limit: 1000 });
    } catch (e) {
      root.innerHTML = `<div class="empty"><strong>โหลดข้อมูลไม่สำเร็จ</strong>${esc(e.message)}</div>`;
      return;
    }

    if (!rows.length) {
      root.innerHTML = `
        <div class="grid cols-4">
          ${card('เป้ายอดขาย', `${CONFIG.TARGET_MB} ล้านบาท`, CONFIG.TARGET_PERIOD)}
        </div>
        <div class="empty" style="margin-top:20px">
          <strong>ยังไม่มีข้อมูลให้สรุป</strong>
          เพิ่มงานในแถบ Pending Project แล้วตัวเลขจะขึ้นที่นี่อัตโนมัติ
        </div>`;
      return;
    }

    const s = summarize(rows);
    // ความกว้างที่กราฟใช้ได้จริง = กว้างของพื้นที่เนื้อหา ลบ padding ของ .card (18px สองข้าง)
    const chartW = Math.max(300, (root.clientWidth || 720) - 40);
    const cov = s.coverage === Infinity ? '∞' : s.coverage.toFixed(1) + '×';
    // ต่ำกว่า 3 เท่า = pipeline บางเกินกว่าจะปิดส่วนที่ขาดได้ตามสถิติงานประมูล
    const covRisk = s.coverage !== Infinity && s.coverage < 3;

    root.innerHTML = `
      <div class="grid cols-4">
        ${card('เป้ายอดขาย', `${CONFIG.TARGET_MB} ล้านบาท`, CONFIG.TARGET_PERIOD)}
        ${card('ปิดได้แล้ว', `${fmtMB(s.won)} ล้าน`,
               `${s.pct.toFixed(1)}% ของเป้า · ขาดอีก ${fmtMB(s.gap)} ล้าน`)}
        ${card('Pipeline ถ่วงน้ำหนัก', `${fmtMB(s.weighted)} ล้าน`,
               `จากงานที่ยังเดินอยู่ ${fmtMB(s.pipeline)} ล้าน`)}
        ${card('Pipeline coverage', cov,
               covRisk ? '⚠ ต่ำกว่า 3 เท่า — เสี่ยงพลาดเป้า' : 'ครอบคลุมส่วนที่ยังขาด',
               covRisk ? 'is-risk' : '')}
      </div>

      <div class="prog-wrap">
        <div class="prog"><i style="width:${Math.min(100, s.pct).toFixed(1)}%"></i></div>
        <div class="prog-note">${fmtMB(s.won)} / ${CONFIG.TARGET_MB} ล้านบาท (${s.pct.toFixed(1)}%)</div>
      </div>

      <div class="card sec">
        <h3 class="sec-h">แผน vs ปิดจริง รายเดือน <span class="sec-sub">หน่วย: ล้านบาท</span></h3>
        ${barChart(s.byMonth, chartW)}
        <p class="sec-foot">แผนรายเดือนตอนนี้เกลี่ยเป้าเท่ากันทุกเดือน — ตั้งแผนรายเดือนเองได้ใน Phase 3.1</p>
      </div>

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
          </ol>` : '<p class="sec-foot">ยังไม่มีงานที่เปิดอยู่</p>'}
        </div>
      </div>

      <div class="card sec">
        <h3 class="sec-h">
          งานเลยกำหนดติดตาม
          ${s.overdue.length ? `<span class="badge-risk">${s.overdue.length}</span>` : ''}
        </h3>
        ${s.overdue.length ? `<ul class="odlist">
          ${s.overdue.slice(0, 8).map(r => `<li>
            <span class="od-date">${esc(r.next_date)}</span>
            <span class="od-name">${esc(r.project_name)}</span>
            <span class="od-act">${esc(r.next_action || '')}</span>
          </li>`).join('')}
        </ul>
        ${s.overdue.length > 8 ? `<p class="sec-foot">และอีก ${s.overdue.length - 8} งาน — ดูทั้งหมดในแถบ Pending Project</p>` : ''}`
        : '<p class="sec-foot">ไม่มีงานเลยกำหนด 👍</p>'}
        ${s.noMonth ? `<p class="sec-foot">⚠ มี ${s.noMonth} งานที่ยังไม่ระบุเดือนคาดปิด — จะไม่ถูกนับในกราฟรายเดือน</p>` : ''}
      </div>`;
  },
};
