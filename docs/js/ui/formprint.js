// F11 — พิมพ์/บันทึกเป็น PDF ตามหน้าตาฟอร์มกระดาษต้นฉบับ (step 3.9)
//
// ทำไมใช้ "สั่งพิมพ์ของเบราว์เซอร์" ไม่ใช่ library ทำ PDF:
//   1) ภาษาไทยไม่เพี้ยน — library อย่าง jsPDF ต้องฝังฟอนต์ไทยเองทั้งไฟล์ (100KB+)
//      และสระบน/ล่างมักลอยผิดตำแหน่ง เพราะไม่ได้จัดรูปแบบตัวอักษรแบบเดียวกับเบราว์เซอร์
//   2) ไม่ต้องโหลดอะไรเพิ่ม — เว็บนี้เป็น PWA ที่ต้องทำงานตอนออฟไลน์ได้ และ repo ห้ามพึ่ง CDN
//   3) iPhone/iPad ใช้ได้จริง — กดแชร์ → พิมพ์ → บีบนิ้วออก = บันทึกเป็น PDF
//      Android/Chrome เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์ได้เลย
//
// ⚠️ ความกว้างคอลัมน์/ระยะห่างทั้งหมดอยู่ใน docs/css/print.css
//    ห้าม hardcode สีหรือขนาดในไฟล์นี้ — ฟอร์มต้องออกมาขาวดำเสมอ แม้ธีมบนจอเป็นสีเข้ม

import { adapter } from '../data/adapter.js';
import { thaiDate } from './datepicker.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** ค่าที่วางบนเส้นประ — ว่างก็ต้องคงความสูงบรรทัดไว้ ไม่งั้นฟอร์มยุบ */
const V = (v) => `<span class="pf-v">${esc(v ?? '') || '&nbsp;'}</span>`;

const money = (n) =>
  (n === null || n === undefined || n === '') ? ''
    : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (n) =>
  (n === null || n === undefined || n === '') ? '' : String(Number(n));

/** อายุคำนวณจากวันเกิด — ฟอร์มมีช่อง AGE แต่ตารางเก็บแค่ birthday (อายุเปลี่ยนทุกปี เก็บไว้จะเพี้ยน) */
function ageOf(birthday) {
  if (!birthday) return '';
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return '';
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? String(a) : '';
}

/** ตัดรายการเป็นหน้า ๆ หน้าละ n แถว — อย่างน้อย 1 หน้าเสมอ (ฟอร์มเปล่าก็ต้องพิมพ์ได้) */
function paginate(list, n) {
  const out = [];
  for (let i = 0; i < Math.max(1, Math.ceil((list?.length || 0) / n)); i++) {
    out.push((list || []).slice(i * n, i * n + n));
  }
  return out;
}

/** แถวตารางบันทึกติดตาม — เติมแถวเปล่าให้เต็มหน้าเหมือนฟอร์มกระดาษ */
function logRows(logs, perPage) {
  const rows = [];
  for (let i = 0; i < perPage; i++) {
    const l = logs[i];
    rows.push(`<tr>
      <td>${l ? esc(thaiDate(l.log_date)) : '&nbsp;'}</td>
      <td>${l ? esc(l.by_name || '') : '&nbsp;'}</td>
      <td class="pf-wide">${l ? esc(l.response || '') : '&nbsp;'}</td>
      <td>${l ? esc(l.next_doing || '') : '&nbsp;'}</td>
    </tr>`);
  }
  return rows.join('');
}

// ══════════════════════════════════════════════════════════
// ฟอร์ม PENDING PROJECT (ต้นฉบับ 2 หน้า)
// ══════════════════════════════════════════════════════════

const PENDING_LOG_ROWS = 30;   // หน้า 2 ของต้นฉบับมีราว 30 บรรทัด

export function pendingFormHtml(row, contacts, products, logs) {
  const c = (slot) => (contacts || []).find(x => Number(x.slot) === slot) || {};

  // PROJECT DETAIL ต้นฉบับมี 4 ช่อง — ตารางเก็บช่องเดียว จึงตัดตามบรรทัดมาลง 1–4
  const detail = String(row.project_detail || '').split('\n');
  const d = (i) => detail[i] || '';

  // ตารางสินค้า 9 แถวเสมอ (เท่าฟอร์มกระดาษ) แถวที่ไม่มีข้อมูลปล่อยว่าง
  const byLine = {};
  for (const p of products || []) byLine[Number(p.line_no)] = p;
  const prodRows = Array.from({ length: 9 }, (_, i) => {
    const p = byLine[i + 1] || {};
    return `<tr>
      <td>${esc(p.product || '') || '&nbsp;'}</td>
      <td class="pf-c">${esc(num(p.amount))}</td>
      <td class="pf-r">${esc(money(p.price_unit))}</td>
      <td class="pf-r">${esc(money(p.total))}</td>
      <td class="pf-r">${esc(money(p.discount))}</td>
      <td class="pf-r">${esc(money(p.net))}</td>
      <td>${esc(p.note || '')}</td>
    </tr>`;
  }).join('');

  // ยอดรวมท้ายตาราง — ใช้ value_baht ซึ่งเป็นตัวเลขที่ทั้งระบบใช้นับเข้าเป้า
  // (ไม่บวกจากรายการเอง เพื่อไม่ให้ตัวเลขในกระดาษขัดกับตัวเลขบน dashboard)
  const grand = money(row.value_baht);

  const pages = paginate(logs, PENDING_LOG_ROWS);

  const page1 = `
  <section class="pf-page">
    <div class="pf-row"><span class="pf-l">PENDING PROJECT</span>
      <span class="pf-sp"></span>
      <span class="pf-l">NO.(Sale code count)</span> ${V(row.pending_no)}</div>

    <div class="pf-row"><span class="pf-l">SITE</span> ${V(row.site)}</div>

    <div class="pf-row"><span class="pf-l">PROJECT DETAIL</span>
      <span class="pf-n">1</span> ${V(d(0))}<span class="pf-n">2</span> ${V(d(1))}</div>
    <div class="pf-row"><span class="pf-l"></span>
      <span class="pf-n">3</span> ${V(d(2))}<span class="pf-n">4</span> ${V(d(3))}</div>

    <div class="pf-row"><span class="pf-l">QUOTATION NO</span> ${V(row.quotation_no)}</div>

    <div class="pf-row"><span class="pf-l">OWNER</span> ${V(row.project_owner)}
      <span class="pf-l">CONTRACTOR</span> ${V(row.contractor)}</div>
    <div class="pf-row"><span class="pf-l">DESIGNER</span> ${V(row.designer)}
      <span class="pf-l">CUSTOMER CODE</span> ${V(row.customer_code)}</div>
    <div class="pf-row"><span class="pf-l">CONSULT</span> ${V(row.consultant)}</div>

    <table class="pf-tbl pf-prod">
      <thead><tr>
        <th>PRODUCT</th><th>AMOUNT</th><th>PRICE/UNIT</th><th>TOTAL</th>
        <th>DISCOUNT</th><th>NET</th><th>NOTE</th>
      </tr></thead>
      <tbody>${prodRows}</tbody>
      <tfoot><tr>
        <td colspan="4" class="pf-noborder"></td>
        <td class="pf-r pf-sum-l">รวม</td>
        <td class="pf-r pf-sum">${esc(grand)}</td>
        <td class="pf-noborder"></td>
      </tr></tfoot>
    </table>

    <div class="pf-row"><span class="pf-l">DECISION DAY</span> ${V(thaiDate(row.decision_day))}
      <span class="pf-l">PURCHASED DAY</span> ${V(thaiDate(row.purchased_day))}</div>
    <div class="pf-row"><span class="pf-l">PROJECT TIME</span> ${V(row.project_time)}
      <span class="pf-l">PRODUCT TIME</span> ${V(row.product_time)}</div>

    ${[1, 2, 3].map(i => `
      <div class="pf-row"><span class="pf-l">${i === 1 ? 'CONTACT TO' : ''}</span>
        <span class="pf-n">${i}.</span> ${V(c(i).name)}
        <span class="pf-l">STATUS</span> ${V(c(i).status)}</div>
      <div class="pf-row"><span class="pf-l">ADDRESS</span>
        ${V([c(i).address, c(i).phone, c(i).email].filter(Boolean).join(' · '))}</div>`).join('')}

    <div class="pf-row"><span class="pf-l">COMPETITOR</span> ${V(row.competitors)}</div>

    <div class="pf-row"><span class="pf-l">RESULT</span>
      <span class="pf-chk"><span class="pf-box">${row.stage === 'won' ? '✓' : '&nbsp;'}</span> Success (ได้งาน)</span>
      <span class="pf-chk"><span class="pf-box">${row.stage === 'lost' ? '✓' : '&nbsp;'}</span> Miss (ไม่ได้งาน)</span>
      <span class="pf-l">BECAUSE</span> ${V(row.result_because)}</div>
  </section>`;

  const logPages = pages.map((chunk, i) => `
  <section class="pf-page">
    <div class="pf-hdr-r"><span class="pf-l">PAGE</span> ${V(i + 2)}</div>
    <div class="pf-hdr-c"><span class="pf-l">PENDING NO.</span> ${V(row.pending_no)}</div>
    <table class="pf-tbl pf-log">
      <thead><tr><th>DATE</th><th>BY</th><th>PRESPONSE</th><th>NEXT DOING</th></tr></thead>
      <tbody>${logRows(chunk, PENDING_LOG_ROWS)}</tbody>
    </table>
  </section>`).join('');

  return page1 + logPages;
}

// ══════════════════════════════════════════════════════════
// ฟอร์ม BOOK 3 สี — "Potential" (ต้นฉบับ 2 หน้า)
//
// เจ้าของสั่งเพิ่ม 2 ช่องที่ฟอร์มกระดาษเดิมไม่มี (23 ก.ค. 2569):
//   NICKNAME (ชื่อเล่น) · ORGANIZATION (หน่วยงาน/บริษัท)
// ══════════════════════════════════════════════════════════

const CUST_LOG_ROWS_P1 = 12;   // ต้นฉบับหน้า 1 มี 12 บรรทัด
const CUST_LOG_ROWS_P2 = 34;   // หน้า 2 เป็นตารางเต็มหน้า

const COLOR_LABEL = {
  green:  '🟢 เขียว — สนิท / ซื้อประจำ',
  yellow: '🟡 เหลือง — มีโอกาส',
  red:    '🔴 แดง — เพิ่งเริ่มติดต่อ',
};

export function customerFormHtml(row, logs) {
  const first = paginate(logs, CUST_LOG_ROWS_P1)[0] || [];
  const rest  = (logs || []).slice(CUST_LOG_ROWS_P1);
  const restPages = rest.length ? paginate(rest, CUST_LOG_ROWS_P2) : [[]];

  const page1 = `
  <section class="pf-page">
    <div class="pf-potential">
      <div class="pf-pot-t">
        <h1>Potential</h1>
        <div class="pf-row pf-center"><span class="pf-l">No.</span> ${V(row.no)}</div>
      </div>
      <div class="pf-photo">${
        row.photo_url
          ? `<img src="${esc(row.photo_url)}" alt="">`
          : '<span class="pf-photo-x">รูปลูกค้า</span>'}</div>
    </div>

    <div class="pf-row"><span class="pf-l">NAME</span> ${V(row.name)}
      <span class="pf-l">ชื่อเล่น</span> ${V(row.nickname)}</div>
    <div class="pf-row"><span class="pf-l">หน่วยงาน / บริษัท</span> ${V(row.org)}</div>

    <div class="pf-row"><span class="pf-l">BIRTHDAY</span> ${V(thaiDate(row.birthday))}
      <span class="pf-l">AGE</span> ${V(ageOf(row.birthday))}</div>
    <div class="pf-row"><span class="pf-l">POSITION</span> ${V(row.position)}</div>

    <div class="pf-row"><span class="pf-l">CONTACT</span>
      <span class="pf-n">(TELEPHONE)</span> ${V(row.tel)}</div>
    <div class="pf-row"><span class="pf-l"></span>
      <span class="pf-n">(EMAIL)</span> ${V(row.email)}</div>

    <div class="pf-row"><span class="pf-l">ADDRESS(OFFICE)</span> ${V(row.addr_office)}</div>
    <div class="pf-row"><span class="pf-l">ADDRESS(HOME)</span> ${V(row.addr_home)}</div>
    <div class="pf-row"><span class="pf-l">ADDRESS(HOMETOWN)</span> ${V(row.addr_hometown)}</div>

    ${(() => {
      const ed = String(row.education || '').split('\n');
      return [1, 2, 3].map(i => `
        <div class="pf-row"><span class="pf-l">${i === 1 ? 'EDUCATION' : ''}</span>
          <span class="pf-n">${i}.)</span> ${V(ed[i - 1] || '')}</div>`).join('');
    })()}

    <div class="pf-row"><span class="pf-l">FAMILY</span> ${V(row.family)}</div>
    <div class="pf-row"><span class="pf-l">HOBBY</span> ${V(row.hobby)}</div>
    <div class="pf-row"><span class="pf-l">FAVORITE</span> ${V(row.favorite)}</div>
    <div class="pf-row"><span class="pf-l">สีในสมุด</span> ${V(COLOR_LABEL[row.color] || '')}</div>

    <table class="pf-tbl pf-log">
      <thead><tr><th>DATE</th><th>BY</th><th>RESPONSE</th><th>NEXT DOING</th></tr></thead>
      <tbody>${logRows(first, CUST_LOG_ROWS_P1)}</tbody>
    </table>
  </section>`;

  const more = restPages.map(chunk => `
  <section class="pf-page">
    <table class="pf-tbl pf-log">
      <thead><tr><th>DATE</th><th>BY</th><th>RESPONSE</th><th>NEXT DOING</th></tr></thead>
      <tbody>${logRows(chunk, CUST_LOG_ROWS_P2)}</tbody>
    </table>
  </section>`).join('');

  return page1 + more;
}

// ══════════════════════════════════════════════════════════
// สั่งพิมพ์
// ══════════════════════════════════════════════════════════

function printRoot() {
  let el = document.getElementById('printRoot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'printRoot';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * วางเนื้อหาลงกล่องพิมพ์แล้วสั่งพิมพ์
 *
 * ⚠️ ห้ามล้าง innerHTML ทันทีหลัง window.print()
 *    Safari บน iOS เปิดหน้าต่างพิมพ์แบบไม่บล็อก — ล้างทันทีจะได้กระดาษเปล่า
 *    รอ event afterprint แทน (และมีตัวตั้งเวลาสำรองเผื่อเบราว์เซอร์ไม่ยิง event)
 */
function doPrint(html, title) {
  const el = printRoot();
  el.innerHTML = html;
  document.documentElement.classList.add('is-printing');

  const prevTitle = document.title;
  document.title = title || prevTitle;      // ชื่อไฟล์ PDF ที่ได้ = ชื่อหน้าเว็บ

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.documentElement.classList.remove('is-printing');
    document.title = prevTitle;
    el.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 60000);

  window.print();
}

/** ชื่อไฟล์: ตัดอักขระที่ใช้ตั้งชื่อไฟล์ไม่ได้ออก */
const fileName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80);

/**
 * แปลงประวัติการเซ็นรับทราบ → แถวบันทึก (pseudo-log) เพื่อแทรกในไทม์ไลน์ PDF (step 3.11)
 * ให้เห็นว่า "ช่วงเวลานั้นมีหัวหน้าตรวจ + คอมเมนต์อะไร" ต่อท้ายวันที่ที่บันทึก
 */
function signoffPseudoLogs(list) {
  return (list || []).map(s => ({
    log_date:   String(s.signed_at || '').slice(0, 10),
    by_name:    (s.profiles?.full_name || s.profiles?.email || 'หัวหน้างาน') + ' (ตรวจ)',
    response:   '✓ เซ็นรับทราบ' + (s.reviewed_note ? ' — ' + s.reviewed_note : ''),
    next_doing: '',
  }));
}

/** รวมบันทึกติดตาม + ประวัติการเซ็น แล้วเรียงตามวันที่ (เก่า→ใหม่) */
function mergeLogsWithSignoffs(logs, signoffs) {
  return [...(logs || []), ...signoffPseudoLogs(signoffs)]
    .sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)));
}

export async function printPending(id) {
  const row = await adapter.getPending(id);
  if (!row) throw new Error('ไม่พบงานนี้ (อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง)');

  // getPending แนบ contacts/logs มาให้อยู่แล้ว · รายการสินค้าดึงเพิ่ม
  let products = [];
  try { products = await adapter.listPendingProducts(id); }
  catch { products = []; }        // ยังไม่ได้รัน phase3-9.sql ก็พิมพ์ตารางเปล่าไปก่อน

  const logs = row.follow_logs || await adapter.listFollowLogs(id);
  // แทรกประวัติการเซ็นรับทราบเข้าไปในไทม์ไลน์ด้วย (เห็นว่ามีตรวจ + คอมเมนต์ช่วงไหน)
  let signoffs = [];
  try { signoffs = await adapter.listSignoffHistory('pending_projects', id); } catch { signoffs = []; }
  const sorted = mergeLogsWithSignoffs(logs, signoffs);   // เก่า→ใหม่ เหมือนเขียนไล่ลงกระดาษ

  doPrint(pendingFormHtml(row, row.project_contacts || [], products, sorted),
          fileName(`Pending ${row.pending_no || ''} ${row.project_name || ''}`));
}

export async function printCustomer(id) {
  const row = await adapter.getCustomer(id);
  if (!row) throw new Error('ไม่พบลูกค้ารายนี้ (อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง)');

  const logs = row.customer_logs || await adapter.listCustomerLogs(id);
  let signoffs = [];
  try { signoffs = await adapter.listSignoffHistory('customers', id); } catch { signoffs = []; }
  const sorted = mergeLogsWithSignoffs(logs, signoffs);

  doPrint(customerFormHtml(row, sorted),
          fileName(`Book3 ${row.no || ''} ${row.name || ''}`));
}
