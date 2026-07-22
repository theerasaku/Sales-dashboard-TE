// แปลง JSON จากระบบเดิม → รูปแบบตารางของ Supabase (step 1.6)
//
// แยกออกมาเป็นไฟล์ต่างหากเพราะเป็น "ตรรกะล้วน" ไม่แตะ DOM ไม่แตะเครือข่าย
// → ทดสอบได้ตรง ๆ และใช้ซ้ำได้ทั้งหน้า import และปุ่ม export (step 3.6)

/** รูปแบบไฟล์สำรองของระบบนี้ — export (3.6) กับ import (1.6) ต้องใช้ค่าเดียวกัน */
export const BACKUP_FORMAT = 'te-sales-dashboard-backup';
export const BACKUP_VERSION = 1;

/**
 * prototype v3 เก็บ "ทีม" ไว้ในฟิลด์ชื่อ ownerId (ชวนเข้าใจผิดว่าเป็นคน)
 * m1–m4 คือรหัสทีมเดิม · GOV.3 เพิ่งมีทีหลัง จึงไม่มีในข้อมูลเก่า
 */
export const LEGACY_TEAM = {
  m1: 'GOV.1',
  m2: 'TE-IMP',
  m3: 'GOV.4',
  m4: 'SYSTEM',
};

const STAGE_IDS = new Set(['lead', 'qualify', 'present', 'quote', 'nego', 'won', 'lost']);

const str = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};

/** รับได้ทั้ง '2026-08-15' และ Date string อื่น ๆ · คืน null ถ้าแปลงไม่ได้ */
function toDate(v) {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

/**
 * เดือนคาดปิด → 'YYYY-MM' (ค.ศ. เสมอ)
 * ⚠️ ข้อมูลเก่าบางแถวอาจเป็น พ.ศ. ('2569-08') ต้องแปลงกลับ
 *    ถ้าปล่อยเข้าไป การเรียงตามตัวอักษรจะพังทั้งระบบ
 */
export function toMonth(v) {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  if (!m) return null;
  let y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  if (y > 2400) y -= 543;              // พ.ศ. → ค.ศ.
  return `${y}-${String(mo).padStart(2, '0')}`;
}

const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** ตรวจว่าไฟล์ที่วางมาเป็นรูปแบบไหน */
export function detectFormat(data) {
  if (!data || typeof data !== 'object') return { kind: 'unknown' };
  if (data._format === BACKUP_FORMAT) return { kind: 'backup', version: data._version || 1 };
  if (Array.isArray(data.deals))       return { kind: 'prototype' };
  if (Array.isArray(data))             return { kind: 'rows' };   // array ของ deal ล้วน ๆ
  return { kind: 'unknown' };
}

/** deal ของ prototype v3 → แถว pending_projects + ลูก ๆ */
export function mapLegacyDeal(d, teamByCode = {}) {
  const teamCode = LEGACY_TEAM[d.ownerId] || null;

  const row = {
    pending_no:     str(d.pendingNo),
    project_name:   str(d.name) || '(ไม่มีชื่องาน)',
    customer_name:  str(d.customer),
    site:           str(d.site),
    project_detail: str(d.projDetail),
    quotation_no:   str(d.quotationNo),
    customer_code:  str(d.custCode),

    project_owner:  str(d.projOwner),
    contractor:     str(d.contractor),
    designer:       str(d.designer),
    consultant:     str(d.consult),

    value_baht:     toNum(d.value),
    decision_day:   toDate(d.decisionDay),
    purchased_day:  toDate(d.purchasedDay),
    close_month:    toMonth(d.closeMonth),
    project_time:   str(d.projectTime),
    product_time:   str(d.productTime),

    stage:          STAGE_IDS.has(d.stage) ? d.stage : 'lead',
    competitors:    str(d.competitors),
    customer_needs: str(d.needs),
    our_strengths:  str(d.strengths),
    win_plan:       str(d.winPlan),

    next_action:    str(d.nextAction),
    next_date:      toDate(d.nextDate),

    lead_source:    str(d.sourceId),
    sub_source:     str(d.subSource),
    product:        str(d.product),
    team_id:        teamCode ? (teamByCode[teamCode] || null) : null,

    is_active:      true,
  };

  // บันทึกติดตาม: {date, by, resp, next} → คอลัมน์ของเรา
  const logs = (Array.isArray(d.log) ? d.log : [])
    .map(l => ({
      log_date:   toDate(l.date) || new Date().toISOString().slice(0, 10),
      by_name:    str(l.by),
      response:   str(l.resp),
      next_doing: str(l.next),
    }))
    .filter(l => l.response || l.next_doing);

  // ผู้ติดต่อ 1–3 เก็บแบนอยู่ในตัว deal (c1n/c1s/c1a …)
  const contacts = [1, 2, 3].map(i => ({
    slot:    i,
    name:    str(d[`c${i}n`]),
    status:  str(d[`c${i}s`]),
    address: str(d[`c${i}a`]),
  })).filter(c => c.name || c.status || c.address);

  return { row, logs, contacts, _srcId: d.id ?? null };
}

/**
 * แปลงไฟล์ทั้งก้อน → รายการที่พร้อมนำเข้า
 * teamByCode = { 'GOV.1': uuid, … } สำหรับ map ทีม
 */
export function parseImport(data, teamByCode = {}) {
  const fmt = detectFormat(data);
  const warnings = [];

  if (fmt.kind === 'unknown') {
    throw new Error('ไม่รู้จักรูปแบบไฟล์นี้ — ต้องเป็นไฟล์สำรองของระบบ หรือ JSON จาก prototype เดิม');
  }

  // ── ไฟล์สำรองของระบบเรา: คอลัมน์ตรงกับ DB อยู่แล้ว ──
  if (fmt.kind === 'backup') {
    const t = data.tables || {};
    const pend = t.pending_projects || [];
    const logsBy = groupBy(t.follow_logs || [], 'pending_id');
    const ctcBy  = groupBy(t.project_contacts || [], 'pending_id');

    const items = pend.map(r => {
      const { id, created_at, updated_at, created_by, updated_by,
              teams, follow_logs, project_contacts, last_log, ...clean } = r;
      return {
        row: { ...clean, close_month: toMonth(clean.close_month) },
        logs: (logsBy[id] || []).map(stripLog),
        contacts: (ctcBy[id] || []).map(stripContact),
        _srcId: id ?? null,
      };
    });
    return { format: fmt, items, warnings };
  }

  // ── prototype v3 ──
  const deals = fmt.kind === 'rows' ? data : data.deals;
  const real  = deals.filter(d => !d.sample);          // ตัดข้อมูลตัวอย่างของ prototype ทิ้ง
  const skipped = deals.length - real.length;
  if (skipped > 0) warnings.push(`ข้ามข้อมูลตัวอย่างของ prototype ${skipped} รายการ (sample: true)`);

  const unknownTeams = new Set();
  const items = real.map(d => {
    if (d.ownerId && !LEGACY_TEAM[d.ownerId]) unknownTeams.add(d.ownerId);
    return mapLegacyDeal(d, teamByCode);
  });
  if (unknownTeams.size)
    warnings.push(`ไม่รู้จักรหัสทีม: ${[...unknownTeams].join(', ')} — งานเหล่านี้จะยังไม่ระบุทีม`);

  const noMonth = items.filter(i => !i.row.close_month).length;
  if (noMonth) warnings.push(`${noMonth} งานไม่มีเดือนคาดปิด — จะไม่ขึ้นในกราฟรายเดือนจนกว่าจะกรอก`);

  return { format: fmt, items, warnings };
}

function stripLog(l) {
  return {
    log_date:   toDate(l.log_date) || new Date().toISOString().slice(0, 10),
    by_name:    str(l.by_name),
    response:   str(l.response),
    next_doing: str(l.next_doing),
  };
}

function stripContact(c) {
  return {
    slot:    Number(c.slot) || 1,
    name:    str(c.name),
    status:  str(c.status),
    address: str(c.address),
    phone:   str(c.phone),
    email:   str(c.email),
  };
}

function groupBy(list, key) {
  const out = {};
  for (const r of list) (out[r[key]] ||= []).push(r);
  return out;
}

/**
 * จับคู่กับของที่มีอยู่แล้วใน DB เพื่อกันนำเข้าซ้ำ
 * จับด้วย PENDING NO. ก่อน (แม่นสุด) ถ้าไม่มีค่อยดู ชื่องาน+ลูกค้า
 */
export function markDuplicates(items, existing) {
  const byNo = new Map();
  const byName = new Map();
  for (const e of existing) {
    if (e.pending_no) byNo.set(String(e.pending_no).trim().toLowerCase(), e);
    byName.set(nameKey(e.project_name, e.customer_name), e);
  }

  return items.map(it => {
    const no = it.row.pending_no ? String(it.row.pending_no).trim().toLowerCase() : '';
    const hit = (no && byNo.get(no)) ||
                byName.get(nameKey(it.row.project_name, it.row.customer_name)) || null;
    return { ...it, dup: hit || null, dupBy: hit ? (no && byNo.get(no) ? 'PENDING NO.' : 'ชื่องาน+ลูกค้า') : null };
  });
}

const nameKey = (a, b) =>
  `${String(a || '').trim().toLowerCase()}|${String(b || '').trim().toLowerCase()}`;

/** สร้างไฟล์สำรอง (ใช้ตอน step 3.6 — วางโครงไว้ให้ format ตรงกันตั้งแต่ตอนนี้) */
export function buildBackup(tables, exportedAt) {
  return {
    _format: BACKUP_FORMAT,
    _version: BACKUP_VERSION,
    exported_at: exportedAt || new Date().toISOString(),
    tables,
  };
}
