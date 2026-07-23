// F10 — AI Intake · Phase 3.5
//
// ไม่ใช่หน้าใน router — เป็น modal ที่แถบ Pending และ Book 3 สี เรียกผ่านปุ่ม 🤖 AI Import
//
// วิธีทำงาน (3.5 = คัดลอกคำสั่งไปวางใน Claude เอง ฟรี ไม่มีค่า API · 3.8 จะเปลี่ยนเป็น Edge Function):
//   1. เลือกแหล่ง (นามบัตร / ฟอร์มกระดาษ / Obsidian / Notion)
//   2. ก๊อปคำสั่งสำเร็จรูป → วางใน Claude พร้อมรูป/โน้ต → Claude คืน JSON
//   3. วาง JSON กลับมา → ระบบพักไว้ใน staging (intake_items) ก่อนเสมอ
//   4. ตรวจ/แก้ (ไฮไลต์เหลืองเฉพาะช่องที่ AI ไม่มั่นใจ) + เช็กว่าซ้ำกับของเดิมไหม
//      → กด "บันทึกเข้าระบบ" จึงเขียนเข้าตารางจริง (ผ่าน savePending/saveCustomer + RLS ปกติ)
//
// ⭐ ข้อมูลลง staging ก่อนเสมอ ห้ามเขียนเข้าตารางจริงตรง ๆ —
//    ถ่ายรูปหน้างานด้วยมือถือ แต่มานั่งตรวจแก้บนคอมที่ออฟฟิศ ต้องข้ามเครื่องได้ + มีหลักฐานว่าใครอนุมัติ

import { adapter } from '../data/adapter.js';

export const SOURCES = ['namecard', 'form', 'obsidian', 'notion'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const hasVal = (v) => v != null && String(v).trim() !== '';
const normDigits = (s) => String(s || '').replace(/\D/g, '');

// ── ค่าที่ DB ยอมรับ (ต้องตรงกับ check constraint · ยกมาไว้ที่นี่กัน import วนกับ pending/book3) ──
const STAGE_OPTS = [
  ['lead', 'Lead ใหม่'], ['qualify', 'คัดกรอง/สำรวจ'], ['present', 'นำเสนอ/ออกแบบ'],
  ['quote', 'เสนอราคา/ยื่นประมูล'], ['nego', 'ต่อรอง/รอผล'], ['won', 'ปิดได้'], ['lost', 'แพ้/ยกเลิก'],
];
const COLOR_OPTS = [['green', '🟢 สนิท/ซื้อประจำ'], ['yellow', '🟡 มีโอกาส'], ['red', '🔴 เพิ่งเริ่ม']];
const STAGE_IDS = STAGE_OPTS.map(s => s[0]);
const COLOR_IDS = COLOR_OPTS.map(c => c[0]);

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE  = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * แปลงปี พ.ศ. → ค.ศ. ให้อัตโนมัติ + ทิ้งถ้าปียังเพี้ยน
 *
 * ⚠️ กับดักที่ CLAUDE.md เตือน: regex `\d{4}-\d{2}` ปล่อยปี พ.ศ. (2569) ผ่านหมด
 *    แม้แต่ check constraint ของ DB ก็ผ่าน — เก็บ 2569 เข้าไปแล้วเรียงเดือนพังทั้งระบบ
 *    AI อ่านฟอร์มไทยมักได้ปี พ.ศ. → ต้องดักแปลงตรงนี้ก่อนบันทึกจริง
 *    (ช่วง 2400–2600 เป็นปี ค.ศ. ที่เป็นไปไม่ได้ในบริบทนี้ = พ.ศ. แน่ ๆ → ลบ 543)
 */
function fixYearYM(v) {
  const m = MONTH_RE.exec(String(v || ''));
  if (!m) return null;
  let y = Number(m[1]);
  if (y >= 2400 && y <= 2600) y -= 543;          // พ.ศ. → ค.ศ.
  if (y < 2000 || y > 2100) return null;         // ยังเพี้ยน = ทิ้ง ให้คนกรอกเอง
  return `${y}-${m[2]}`;
}
function fixYearDate(v) {
  const m = DATE_RE.exec(String(v || ''));
  if (!m) return null;
  let y = Number(m[1]);
  if (y >= 2400 && y <= 2600) y -= 543;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${m[2]}-${m[3]}`;
}

// ── ช่องข้อมูลของแต่ละปลายทาง — [key, label, type] ── (type: text|number|area|color|stage)
const FIELDS = {
  customer: [
    ['name',          'ชื่อ-สกุล',              'text'],
    ['nickname',      'ชื่อเล่น',                'text'],
    ['position',      'ตำแหน่ง',                 'text'],
    ['org',           'หน่วยงาน / บริษัท',        'text'],
    ['tel',           'โทรศัพท์',                'text'],
    ['email',         'อีเมล',                   'text'],
    ['birthday',      'วันเกิด (YYYY-MM-DD)',     'text'],
    ['color',         'สีความสัมพันธ์',           'color'],
    ['addr_office',   'ที่อยู่ (ที่ทำงาน)',        'area'],
    ['addr_home',     'ที่อยู่ (บ้าน)',           'area'],
    ['addr_hometown', 'ภูมิลำเนา',               'area'],
    ['education',     'การศึกษา',                'area'],
    ['family',        'ครอบครัว',                'area'],
    ['hobby',         'งานอดิเรก',               'text'],
    ['favorite',      'ของชอบ',                  'text'],
  ],
  pending: [
    ['project_name',     'ชื่องาน/โครงการ',        'text'],
    ['pending_no',       'PENDING NO.',            'text'],
    ['customer_name',    'ลูกค้า / หน่วยงาน',       'text'],
    ['site',             'SITE (สถานที่)',          'text'],
    ['value_baht',       'มูลค่างาน (บาท)',         'number'],
    ['close_month',      'เดือนคาดปิด (YYYY-MM)',    'text'],
    ['quotation_no',     'QUOTATION NO',           'text'],
    ['project_detail',   'รายละเอียดโครงการ',       'area'],
    ['project_owner',    'OWNER',                  'text'],
    ['contractor',       'CONTRACTOR',             'text'],
    ['designer',         'DESIGNER',               'text'],
    ['consultant',       'CONSULT',                'text'],
    ['competitors',      'คู่แข่ง / ความเสี่ยง',     'area'],
    ['customer_needs',   'ความต้องการลูกค้า',       'area'],
    ['our_strengths',    'จุดแข็งของเรา',           'area'],
    ['win_plan',         'Win plan',               'area'],
    ['stage',            'ขั้นตอนงานขาย',           'stage'],
    ['lead_source',      'แหล่งที่มา',              'text'],
    ['next_action',      'Next action ถัดไป',       'text'],
    ['contact_name',     'ผู้ติดต่อ 1 — ชื่อ',       'text'],
    ['contact_position', 'ผู้ติดต่อ 1 — ตำแหน่ง',    'text'],
    ['contact_phone',    'ผู้ติดต่อ 1 — โทร',        'text'],
    ['contact_email',    'ผู้ติดต่อ 1 — อีเมล',      'text'],
  ],
};
const REQUIRED = { customer: 'name', pending: 'project_name' };
const DEST_LABEL = { customer: 'ลูกค้าใน Book 3 สี', pending: 'งานใน Pending Project' };
const SOURCE_LABEL = {
  namecard: '📇 รูปนามบัตร', form: '📄 ฟอร์มกระดาษ / ลายมือ',
  obsidian: '🪨 Obsidian', notion: '📝 Notion',
};
// แหล่งที่เหมาะกับแต่ละปลายทาง (ฟอร์มกระดาษ → Pending · นามบัตร → ลูกค้า)
const SOURCES_FOR = {
  customer: ['namecard', 'obsidian', 'notion'],
  pending:  ['form', 'obsidian', 'notion'],
};

// ══════════════════════════════════════════════════════════
// คำสั่งสำเร็จรูปสำหรับวางใน Claude — สร้างจาก FIELDS ให้ตรงกันเสมอ
// ══════════════════════════════════════════════════════════

function promptFor(targetType, source) {
  const lines = FIELDS[targetType]
    .filter(([k]) => !k.startsWith('contact_'))
    .map(([k, label]) => `  "${k}": ${label}`);
  const contactLine = targetType === 'pending'
    ? '\n  (ผู้ติดต่อหลัก) "contact_name", "contact_position", "contact_phone", "contact_email"' : '';
  const special = targetType === 'customer'
    ? '• color ตอบเป็น green / yellow / red เท่านั้น — เดาไม่ได้ให้ข้ามไป\n• birthday รูปแบบ YYYY-MM-DD'
    : '• value_baht เป็นตัวเลขล้วน ไม่มีคอมมา\n• close_month รูปแบบ YYYY-MM (เดือนที่คาดว่าจะปิด)\n'
      + '• stage เลือกจาก: lead / qualify / present / quote / nego / won / lost';
  const srcHint = {
    namecard: 'ฉันจะแนบรูปนามบัตร',
    form:     'ฉันจะแนบรูปฟอร์มกระดาษ/ลายมือ',
    obsidian: 'ฉันจะวางโน้ตจาก Obsidian',
    notion:   'ฉันจะวางเนื้อหาจาก Notion',
  }[source] || 'ฉันจะแนบข้อมูล';

  return `${srcHint} ช่วยอ่านแล้วแปลงเป็นข้อมูล${DEST_LABEL[targetType]}
ตอบกลับเป็น JSON array อย่างเดียว ห้ามมีข้อความอื่นนอก JSON

รูปแบบแต่ละรายการ:
{ "fields": { …ค่าที่อ่านได้… }, "confidence": { "ชื่อคีย์": ความมั่นใจ 0-1 } }

คีย์ที่ใช้ได้ (ใส่เฉพาะที่อ่านได้จริง เว้นช่องที่อ่านไม่ออก):
${lines.join('\n')}${contactLine}

กติกา:
${special}
• คงภาษาไทยตามต้นฉบับ ห้ามแปล
• confidence ใส่เฉพาะช่องที่กรอก ค่าต่ำ = ไม่มั่นใจ (ระบบจะไฮไลต์ให้คนตรวจ)
• ถ้ามีหลายคน/หลายงาน ให้ใส่หลาย object ใน array เดียว`;
}

// ══════════════════════════════════════════════════════════
// แกะ JSON ที่วางกลับมา — ทนต่อ code fence / ข้อความห่อ / object แบน
// ══════════════════════════════════════════════════════════

function parsePasted(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('ยังไม่ได้วางผล JSON ที่ได้จาก Claude');

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  let data;
  try {
    data = JSON.parse(t);
  } catch {
    // Claude บางทีห่อ JSON ด้วยคำอธิบาย — คว้าก้อน [...] หรือ {...} ก้อนใหญ่สุด
    const arr = t.match(/\[[\s\S]*\]/);
    const obj = t.match(/\{[\s\S]*\}/);
    const cand = arr?.[0] || obj?.[0];
    if (!cand) throw new Error('อ่าน JSON ไม่ออก — คัดลอกเฉพาะส่วน JSON มาวางใหม่');
    data = JSON.parse(cand);   // ผิดอีกให้ error เด้งจริง
  }

  let list;
  if (Array.isArray(data))              list = data;
  else if (Array.isArray(data?.records)) list = data.records;
  else if (Array.isArray(data?.items))   list = data.items;
  else                                   list = [data];

  const out = list.map(normRecord).filter(r => Object.keys(r.fields).length);
  if (!out.length) throw new Error('ไม่พบข้อมูลใน JSON ที่วางมา');
  return out;
}

function normRecord(r) {
  if (r && typeof r === 'object' && (r.fields || r.confidence)) {
    return { fields: r.fields || {}, confidence: r.confidence || {} };
  }
  const { _confidence, confidence, ...rest } = r || {};
  return { fields: rest, confidence: _confidence || confidence || {} };
}

/** เก็บเฉพาะคีย์ที่รู้จัก + แปลง/ตรวจค่าที่มีเงื่อนไข (กัน DB ปฏิเสธ 23514) */
function buildPayload(targetType, fields) {
  const keys = FIELDS[targetType].map(f => f[0]);
  const out = {};
  for (const k of keys) {
    let v = fields[k];
    if (v == null) continue;
    if (typeof v === 'string') v = v.trim();
    if (v === '') continue;

    if (k === 'value_baht') {
      const n = Number(String(v).replace(/[,\s]/g, ''));
      if (Number.isFinite(n) && n >= 0) out[k] = n;
      continue;
    }
    if (k === 'close_month') { const f = fixYearYM(v);   if (f) out[k] = f; continue; }  // พ.ศ.→ค.ศ. · ผิด = ทิ้ง
    if (k === 'birthday')    { const f = fixYearDate(v); if (f) out[k] = f; continue; }
    if (k === 'color')       { out[k] = COLOR_IDS.includes(v) ? v : 'red';  continue; }
    if (k === 'stage')       { out[k] = STAGE_IDS.includes(v) ? v : 'lead';  continue; }
    out[k] = v;
  }
  return out;
}

// ══════════════════════════════════════════════════════════
// เช็กซ้ำกับของเดิม (dedup) — คืน { row, why } หรือ null
//
// ⚠️ เทียบกับ "รายชื่อทั้งชุด" ไม่ใช่ค้นด้วย search
//    เบอร์ที่เก็บมีขีด (081-234-5678) · เบอร์ที่ AI อ่านมาไม่มีขีด (0812345678)
//    ถ้าใช้ search แบบ ilike จะไม่เจอกัน → ต้องดึงมาเทียบ "เลขล้วน" ใน JS
//    (matchDuplicate เป็น pure function · caller เป็นคนดึง candidates แบบ cache)
// ══════════════════════════════════════════════════════════

function matchDuplicate(targetType, fields, candidates) {
  const all = candidates || [];
  if (targetType === 'customer') {
    const tel  = normDigits(fields.tel);
    const name = String(fields.name || '').trim();
    const org  = String(fields.org || '').trim();
    if (tel) {
      const hit = all.find(c => normDigits(c.tel) && normDigits(c.tel) === tel);
      if (hit) return { row: hit, why: 'เบอร์โทรตรงกัน' };
    }
    if (name) {
      const hit = all.find(c => String(c.name || '').trim() === name
                             && (!org || String(c.org || '').trim() === org));
      if (hit) return { row: hit, why: 'ชื่อ + หน่วยงานตรงกัน' };
    }
    return null;
  }
  const pno   = String(fields.pending_no || '').trim();
  const pname = String(fields.project_name || '').trim();
  const cname = String(fields.customer_name || '').trim();
  if (pno) {
    const hit = all.find(c => String(c.pending_no || '').trim() === pno);
    if (hit) return { row: hit, why: 'PENDING NO. ตรงกัน' };
  }
  if (pname) {
    const hit = all.find(c => String(c.project_name || '').trim() === pname
                           && (!cname || String(c.customer_name || '').trim() === cname));
    if (hit) return { row: hit, why: 'ชื่องาน + ลูกค้าตรงกัน' };
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// อ่านรูป → base64 (ย่อก่อนส่ง กันไฟล์ใหญ่/เปลืองเน็ต · OCR ไม่ต้องความละเอียดเต็ม)
// คืน { media_type, data } พร้อมส่งเข้า Claude vision
// ══════════════════════════════════════════════════════════

function fileToImagePart(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพ'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!m) return reject(new Error('แปลงรูปไม่สำเร็จ'));
      resolve({ media_type: m[1], data: m[2] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปไม่ได้ — ไฟล์อาจเสียหาย')); };
    img.src = url;
  });
}

// ══════════════════════════════════════════════════════════
// เปิด modal
// ══════════════════════════════════════════════════════════

/** targetType: 'customer' | 'pending' · opts.onSaved() = ให้แถบเบื้องหลัง reload หลังบันทึก */
export function openAIImport(targetType = 'customer', opts = {}) {
  if (!FIELDS[targetType]) targetType = 'customer';
  const onSaved = typeof opts.onSaved === 'function' ? opts.onSaved : () => {};

  document.getElementById('aiModal')?.remove();
  const host = document.createElement('div');
  host.className = 'modal';
  host.id = 'aiModal';
  document.body.appendChild(host);

  let source = SOURCES_FOR[targetType][0];
  const work = new Map();   // itemId → { fields } ฉบับที่กำลังแก้

  // แคชรายชื่อของเดิมไว้เทียบซ้ำ (ดึงครั้งเดียวใช้ทุกการ์ด) — ล้างทิ้งหลังบันทึกของใหม่
  let candCache = null;
  async function candidates() {
    if (candCache) return candCache;
    try {
      candCache = targetType === 'customer'
        ? await adapter.listCustomers({ status: 'all', limit: 2000 })
        : await adapter.listPending({ status: 'all', limit: 2000 });
    } catch { candCache = []; }
    return candCache;
  }

  host.innerHTML = `
    <form class="modal-box ai-box" id="aiForm" autocomplete="off">
      <div class="modal-head">
        <strong>🤖 AI Import — ${esc(DEST_LABEL[targetType])}</strong>
        <button type="button" class="btn btn-ghost btn-sm" id="aiClose">ปิด</button>
      </div>

      <div class="ai-tabs" role="tablist">
        <button type="button" class="ai-tab on" data-tab="new">นำเข้าใหม่</button>
        <button type="button" class="ai-tab" data-tab="stage">รายการรอตรวจ <span class="seg-badge" id="aiCount" hidden></span></button>
      </div>

      <div class="modal-body">
        <!-- ── นำเข้าใหม่ ── -->
        <section class="ai-pane" id="paneNew">
          <p class="ai-step">1 · เลือกแหล่งข้อมูล</p>
          <div class="ai-src" id="aiSrc">
            ${SOURCES_FOR[targetType].map(s =>
              `<button type="button" class="ai-srcbtn ${s === source ? 'on' : ''}" data-src="${s}">${esc(SOURCE_LABEL[s])}</button>`).join('')}
          </div>

          <div class="ai-auto">
            <div class="ai-auto-l">
              <strong>📷 ให้ AI อ่านรูปอัตโนมัติ</strong>
              <span>เลือกรูป/ถ่ายรูป นามบัตร · ฟอร์มกระดาษ · ลายมือ → ระบบส่งให้ Claude อ่านแล้วพักในรายการรอตรวจ (ต้องต่อเน็ต)</span>
            </div>
            <label class="btn btn-primary ai-autobtn" id="aiImgBtn">
              เลือกรูป
              <input type="file" id="aiImg" accept="image/*" hidden>
            </label>
          </div>
          <div class="ai-or"><span>หรือทำเองแบบไม่ใช้เน็ต · ฟรี</span></div>

          <p class="ai-step">2 · ก๊อปคำสั่งนี้ไปวางใน Claude พร้อมรูป/โน้ต แล้วรอ JSON</p>
          <div class="ai-prompt-wrap">
            <textarea class="ai-prompt" id="aiPrompt" readonly rows="8"></textarea>
            <button type="button" class="btn btn-ghost btn-sm ai-copy" id="aiCopy">⧉ คัดลอกคำสั่ง</button>
          </div>

          <p class="ai-step">3 · วางผล JSON ที่ Claude ตอบกลับมา</p>
          <textarea class="ai-paste inp" id="aiPaste" rows="6"
                    placeholder='วางที่นี่ เช่น [{"fields":{"name":"…"},"confidence":{"name":0.9}}]'></textarea>
          <p class="login-err" id="aiErr" role="alert" hidden></p>

          <div class="lg-add-row">
            <button type="button" class="btn btn-primary" id="aiParse">ตรวจ + เพิ่มเข้ารายการรอตรวจ →</button>
            <span class="lg-hint">ข้อมูลจะพักในรายการรอตรวจก่อน ยังไม่เข้าระบบจนกว่าจะกดยืนยันทีละรายการ</span>
          </div>
        </section>

        <!-- ── รายการรอตรวจ (staging) ── -->
        <section class="ai-pane" id="paneStage" hidden>
          <div id="aiStageList"><div class="skeleton">กำลังโหลด…</div></div>
        </section>
      </div>

      <div class="modal-foot">
        <span class="ai-note">ช่อง <span class="ai-low-chip">ไฮไลต์เหลือง</span> = AI ไม่มั่นใจ ควรตรวจก่อนบันทึก</span>
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" id="aiDone">ปิดหน้าต่าง</button>
      </div>
    </form>`;

  const q = (s) => host.querySelector(s);
  const close = () => { host.remove(); };
  const setErr = (m) => { const e = q('#aiErr'); if (!m) { e.hidden = true; return; } e.textContent = m; e.hidden = false; };

  const syncPrompt = () => { q('#aiPrompt').value = promptFor(targetType, source); };
  syncPrompt();

  q('#aiClose').addEventListener('click', close);
  q('#aiDone').addEventListener('click', close);
  host.addEventListener('mousedown', (e) => { if (e.target === host) close(); });

  // เลือกแหล่ง → อัปเดตคำสั่ง
  q('#aiSrc').addEventListener('click', (e) => {
    const b = e.target.closest('[data-src]');
    if (!b) return;
    source = b.dataset.src;
    host.querySelectorAll('#aiSrc [data-src]').forEach(x => x.classList.toggle('on', x === b));
    syncPrompt();
  });

  // คัดลอกคำสั่ง
  q('#aiCopy').addEventListener('click', async () => {
    const btn = q('#aiCopy');
    try {
      await navigator.clipboard.writeText(q('#aiPrompt').value);
    } catch {
      // เบราว์เซอร์เก่า/ไม่มีสิทธิ์ clipboard → เลือกข้อความให้กด Ctrl/⌘+C เอง
      q('#aiPrompt').focus(); q('#aiPrompt').select();
    }
    btn.textContent = '✓ คัดลอกแล้ว';
    setTimeout(() => { btn.textContent = '⧉ คัดลอกคำสั่ง'; }, 1500);
  });

  // ── สลับแท็บ ──
  function switchTab(tab) {
    host.querySelectorAll('.ai-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    q('#paneNew').hidden   = tab !== 'new';
    q('#paneStage').hidden = tab !== 'stage';
    if (tab === 'stage') loadStaging();
  }
  host.querySelectorAll('.ai-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // พักผลลง staging แล้วเด้งไปแท็บรอตรวจ — ใช้ร่วมทั้งทางวางเอง (3.5) และ AI อ่านรูป (3.8)
  async function stageRecords(records, raw) {
    for (const r of records) {
      await adapter.saveIntake({
        source,
        target_type: targetType,
        parsed:     r.fields,
        confidence: r.confidence || {},
        raw_input:  String(raw || '').slice(0, 4000),
        status:     'draft',
      });
    }
    switchTab('stage');
  }

  // ── ตรวจ + เพิ่มเข้า staging (วาง JSON เอง · 3.5) ──
  q('#aiParse').addEventListener('click', async () => {
    setErr('');
    let records;
    try { records = parsePasted(q('#aiPaste').value); }
    catch (e) { return setErr(e.message); }

    const btn = q('#aiParse');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      await stageRecords(records, q('#aiPaste').value);
      q('#aiPaste').value = '';
    } catch (e) {
      setErr(e.message);   // ตารางยังไม่ถูกสร้าง (ยังไม่รัน phase3-5.sql) จะเด้งตรงนี้
    } finally {
      btn.disabled = false; btn.textContent = 'ตรวจ + เพิ่มเข้ารายการรอตรวจ →';
    }
  });

  // ── AI อ่านรูปอัตโนมัติ (Edge Function · 3.8) ──
  q('#aiImg').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';                 // เลือกไฟล์เดิมซ้ำได้
    if (!file) return;
    setErr('');
    const btn = q('#aiImgBtn');
    const label = btn.childNodes[0];
    btn.classList.add('is-loading');
    if (label) label.nodeValue = 'กำลังให้ AI อ่าน… ';
    try {
      const image = await fileToImagePart(file);
      const res = await adapter.aiExtract({
        prompt: promptFor(targetType, source),
        image, source, target_type: targetType,
      });
      const records = parsePasted(res?.text || '');
      await stageRecords(records, '[AI อ่านจากรูป]');
    } catch (e) {
      setErr(e.message);
    } finally {
      btn.classList.remove('is-loading');
      if (label) label.nodeValue = 'เลือกรูป';
    }
  });

  // ══════════════════════════════════════════════════════════
  // รายการรอตรวจ (staging)
  // ══════════════════════════════════════════════════════════

  async function refreshCount() {
    try {
      const list = await adapter.listIntake({ targetType, status: 'draft,approved', limit: 500 });
      const el = q('#aiCount');
      if (el) { el.textContent = list.length; el.hidden = list.length === 0; }
      return list;
    } catch { return null; }
  }

  async function loadStaging() {
    const box = q('#aiStageList');
    box.innerHTML = '<div class="skeleton">กำลังโหลด…</div>';
    let list;
    try {
      list = await adapter.listIntake({ targetType, status: 'draft,approved', limit: 500 });
    } catch (e) {
      const missing = /ยังไม่ได้สร้างตาราง|does not exist|42P01/i.test(e.message);
      box.innerHTML = `<div class="empty"><strong>${missing ? 'ยังไม่ได้สร้างตาราง staging' : 'โหลดไม่สำเร็จ'}</strong>${
        missing ? 'เอาไฟล์ <code>db/phase3-5.sql</code> ไปรันใน Supabase → SQL Editor ก่อน' : esc(e.message)}</div>`;
      return;
    }
    const el = q('#aiCount');
    if (el) { el.textContent = list.length; el.hidden = list.length === 0; }

    if (!list.length) {
      box.innerHTML = `<div class="empty"><strong>ไม่มีรายการรอตรวจ</strong>
        ไปที่แท็บ "นำเข้าใหม่" เพื่อวางผล JSON จาก Claude</div>`;
      return;
    }

    box.innerHTML = list.map(cardHtml).join('');
    list.forEach(item => bindCard(box.querySelector(`[data-card="${item.id}"]`), item));
  }

  // ── การ์ด 1 รายการใน staging ──
  function cardHtml(item) {
    const fields = { ...(item.parsed || {}), ...(item.edited || {}) };
    work.set(item.id, { ...fields });
    const conf = item.confidence || {};
    const req  = REQUIRED[targetType];

    // แสดงเฉพาะช่องที่ AI กรอกมา + ช่องบังคับ (ให้การ์ดกระชับ ไม่ต้องเลื่อนผ่าน 23 ช่องว่าง)
    const shown = FIELDS[targetType].filter(([k]) => hasVal(fields[k]) || k === req);
    const hiddenCount = FIELDS[targetType].length - shown.length;

    return `
      <div class="ai-card" data-card="${esc(item.id)}">
        <div class="ai-card-head">
          <span class="ai-badge">${esc(SOURCE_LABEL[item.source] || item.source || '')}</span>
          <span class="ai-dup" data-dup></span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost btn-sm" data-act="reject" title="ทิ้งรายการนี้ ไม่เอาเข้าระบบ">🗑 ทิ้ง</button>
        </div>

        <div class="ai-fields">
          ${shown.map(f => fieldHtml(f, fields, conf)).join('')}
        </div>

        ${hiddenCount ? `<details class="ai-more">
          <summary>+ เพิ่มช่องอื่น (${hiddenCount})</summary>
          <div class="ai-fields">
            ${FIELDS[targetType].filter(([k]) => !hasVal(fields[k]) && k !== req).map(f => fieldHtml(f, fields, conf)).join('')}
          </div>
        </details>` : ''}

        <p class="login-err" data-cerr role="alert" hidden></p>
        <div class="ai-card-foot">
          <span class="ai-mergehint" data-mergehint></span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-primary btn-sm" data-act="save">บันทึกเข้าระบบ</button>
        </div>
      </div>`;
  }

  function fieldHtml([key, label, type], fields, conf) {
    const v = fields[key] ?? '';
    const c = conf[key];
    const low = c != null && c < 0.8;
    const lowCls = low ? ' ai-low' : '';
    const lowTip = low ? ` title="AI มั่นใจ ${Math.round(c * 100)}% — ตรวจก่อนบันทึก"` : '';
    const reqMark = key === REQUIRED[targetType] ? ' *' : '';

    let control;
    if (type === 'area')
      control = `<textarea class="inp${lowCls}" data-f="${key}" rows="2"${lowTip}>${esc(v)}</textarea>`;
    else if (type === 'color')
      control = `<select class="inp${lowCls}" data-f="${key}"${lowTip}>
        ${COLOR_OPTS.map(([id, lb]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${esc(lb)}</option>`).join('')}
      </select>`;
    else if (type === 'stage')
      control = `<select class="inp${lowCls}" data-f="${key}"${lowTip}>
        ${STAGE_OPTS.map(([id, lb]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${esc(lb)}</option>`).join('')}
      </select>`;
    else
      control = `<input class="inp${lowCls}" data-f="${key}" type="${type === 'number' ? 'number' : 'text'}"
                   value="${esc(v)}"${type === 'number' ? ' min="0" step="1"' : ''}${lowTip}>`;

    return `<label class="ai-fld ${type === 'area' ? 'ai-wide' : ''}">
      <span>${esc(label)}${reqMark}${low ? ' <span class="ai-low-dot" title="AI ไม่มั่นใจ">●</span>' : ''}</span>
      ${control}
    </label>`;
  }

  function bindCard(card, item) {
    if (!card) return;
    const w = work.get(item.id);
    const cerr = (m) => { const e = card.querySelector('[data-cerr]'); if (!m) { e.hidden = true; return; } e.textContent = m; e.hidden = false; };
    let dup = null;          // { row, why } ถ้าเจอของซ้ำ
    let mergeMode = 'new';   // 'new' | 'update'

    // แก้ค่าในช่อง → เก็บลง working copy + ล้างไฮไลต์ (คนตรวจแล้ว)
    card.querySelectorAll('[data-f]').forEach(el => {
      el.addEventListener('input', () => {
        w[el.dataset.f] = el.value;
        el.classList.remove('ai-low');
        // แก้ช่องที่ใช้จับซ้ำ → ค้นซ้ำใหม่
        if (['tel', 'name', 'org', 'pending_no', 'project_name', 'customer_name'].includes(el.dataset.f)) {
          clearTimeout(el._t);
          el._t = setTimeout(runDedup, 500);
        }
      });
    });

    async function runDedup() {
      const box = card.querySelector('[data-dup]');
      const hint = card.querySelector('[data-mergehint]');
      dup = matchDuplicate(targetType, w, await candidates());
      if (!dup) {
        box.textContent = '';
        hint.innerHTML = 'จะบันทึกเป็น<b>รายการใหม่</b>';
        mergeMode = 'new';
        return;
      }
      const nm = targetType === 'customer'
        ? (dup.row.name || '') + (dup.row.org ? ' · ' + dup.row.org : '')
        : (dup.row.project_name || '') + (dup.row.pending_no ? ' · ' + dup.row.pending_no : '');
      box.innerHTML = `⚠️ คล้ายของเดิม (${esc(dup.why)})`;
      hint.innerHTML = `
        <span class="ai-merge-q">พบ: <b>${esc(nm)}</b></span>
        <label class="ai-radio"><input type="radio" name="mm-${esc(item.id)}" value="update" checked> อัปเดตทับของเดิม</label>
        <label class="ai-radio"><input type="radio" name="mm-${esc(item.id)}" value="new"> สร้างใหม่แยกอีกรายการ</label>`;
      mergeMode = 'update';
      hint.querySelectorAll(`input[name="mm-${item.id}"]`).forEach(r =>
        r.addEventListener('change', () => { mergeMode = r.value; }));
    }
    runDedup();

    // ทิ้งรายการ
    card.querySelector('[data-act="reject"]').addEventListener('click', async () => {
      try { await adapter.rejectIntake(item.id); } catch (e) { return cerr(e.message); }
      card.remove();
      await refreshCount();
      if (!host.querySelector('.ai-card')) loadStaging();   // ว่างแล้วโชว์ข้อความ "ไม่มีรายการ"
    });

    // บันทึกเข้าระบบจริง
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      cerr('');
      const payload = buildPayload(targetType, w);
      const reqKey = REQUIRED[targetType];
      if (!hasVal(payload[reqKey]))
        return cerr(targetType === 'customer' ? 'ต้องมีชื่อลูกค้าก่อนบันทึก' : 'ต้องมีชื่องาน/โครงการก่อนบันทึก');

      const btn = card.querySelector('[data-act="save"]');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
      try {
        let savedId, table;
        if (targetType === 'customer') {
          const body = { ...payload };
          if (dup && mergeMode === 'update') body.id = dup.row.id;
          const saved = await adapter.saveCustomer(body);
          savedId = saved?.id; table = 'customers';
        } else {
          const { contact_name, contact_position, contact_phone, contact_email, ...main } = payload;
          if (dup && mergeMode === 'update') main.id = dup.row.id;
          const saved = await adapter.savePending(main);
          savedId = saved?.id; table = 'pending_projects';
          if (savedId && (hasVal(contact_name) || hasVal(contact_phone) || hasVal(contact_email))) {
            try {
              await adapter.saveContacts(savedId, [
                { slot: 1, name: contact_name || null, status: contact_position || null,
                  phone: contact_phone || null, email: contact_email || null },
                { slot: 2 }, { slot: 3 },
              ]);
            } catch (e) { console.warn('บันทึกผู้ติดต่อไม่สำเร็จ:', e.message); }
          }
        }

        // ปิดสถานะ staging → merged (เป็นหลักฐานว่านำเข้าจากเอกสารไหน ใครอนุมัติ)
        await adapter.approveIntake(item.id, {
          target_table: table, target_id: savedId,
          merge_mode: dup && mergeMode === 'update' ? 'update' : 'new',
          edited: w,
        });
        candCache = null;   // มีของใหม่เข้าระบบแล้ว → การ์ดถัดไปต้องเทียบซ้ำกับชุดใหม่

        // แสดงผลสำเร็จบนการ์ดแล้วเอาออก
        card.classList.add('ai-saved');
        card.querySelector('.ai-card-foot').innerHTML =
          `<span class="ai-ok">✓ บันทึกเข้าระบบแล้ว (${dup && mergeMode === 'update' ? 'อัปเดตของเดิม' : 'รายการใหม่'})</span>`;
        setTimeout(async () => {
          card.remove();
          await refreshCount();
          if (!host.querySelector('.ai-card')) loadStaging();
        }, 900);
        await onSaved();
      } catch (e) {
        cerr(e.message);
        btn.disabled = false; btn.textContent = 'บันทึกเข้าระบบ';
      }
    });
  }

  // เปิดมาแล้วมี draft ค้างอยู่ → เด้งไปแท็บรายการรอตรวจเลย (มาต่อจากเครื่องอื่นได้)
  refreshCount().then(list => { if (list && list.length) switchTab('stage'); });
}

export default { SOURCES, openAIImport };
