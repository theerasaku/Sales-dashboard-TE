// supabase-adapter — ต่อ Supabase จริง
//
// Phase 1.2 (นี่): auth ครบวงจร — login / logout / จำ session / ต่ออายุ token + ดึง profile
// Phase 1.3 (ถัดไป): เติม query ข้อมูล pending / customers / activities
//
// ใช้ REST + Auth ผ่าน fetch ตรง ๆ ไม่พึ่ง CDN library (โหลดเร็ว + ไม่มี dependency ให้พัง)

import { CONFIG } from '../config.js';

const SESSION_KEY = 'te-dashboard:session';
const url = (p) => CONFIG.SUPABASE_URL.replace(/\/$/, '') + p;
const apikey = () => CONFIG.SUPABASE_PUBLISHABLE_KEY;

/** session ปัจจุบัน { access_token, refresh_token, expires_at, user } */
let session = null;

// ---------- เก็บ session ไว้ในเครื่อง ----------

function loadSession() {
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    session = null;
  }
}

function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('เก็บ session ไม่ได้', e);
  }
}

// ---------- แปลง error ของ Supabase เป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ----------

function friendlyError(data, res) {
  const raw = String(
    data?.error_description || data?.msg || data?.message || data?.error || ''
  ).toLowerCase();

  if (raw.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (raw.includes('email not confirmed'))       return 'ยังไม่ได้ยืนยันอีเมล — กดลิงก์ในเมลเชิญก่อน';
  if (raw.includes('signups not allowed'))       return 'ระบบปิดรับสมัคร — ติดต่อผู้ดูแลเพื่อขอบัญชี';
  if (res?.status === 429)                       return 'ลองเข้าสู่ระบบถี่เกินไป รอสักครู่แล้วลองใหม่';
  if (res?.status >= 500)                        return 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง';
  return data?.msg || data?.message || 'เข้าสู่ระบบไม่สำเร็จ';
}

async function postAuth(path, body) {
  let res, data;
  try {
    res = await fetch(url(path), {
      method: 'POST',
      headers: { apikey: apikey(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่');
  }
  if (!res.ok) throw new Error(friendlyError(data, res));
  return data;
}

/** แปลงผลจาก /auth/v1/token ให้เป็นรูป session ที่เราเก็บ */
function toSession(d) {
  return {
    access_token:  d.access_token,
    refresh_token: d.refresh_token,
    // expires_at ของ Supabase เป็นวินาที (epoch) — เก็บเป็น ms ให้เทียบกับ Date.now() ได้ตรง ๆ
    expires_at:    (d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000),
    user:          d.user || null,
  };
}

/** ต่ออายุ token ถ้าใกล้หมด (กันหมดอายุกลางคัน เผื่อไว้ 60 วินาที) */
async function ensureFreshToken() {
  if (!session) return null;
  if (Date.now() < session.expires_at - 60_000) return session;
  if (!session.refresh_token) { saveSession(null); return null; }

  try {
    const d = await postAuth('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    });
    const s = { ...toSession(d), profile: session.profile };
    saveSession(s);
    return s;
  } catch {
    // refresh token หมดอายุ/ถูกเพิกถอน → ให้ล็อกอินใหม่
    saveSession(null);
    return null;
  }
}

/** ยิง REST API ในนามผู้ใช้ที่ล็อกอินอยู่ (RLS ฝั่ง DB จะตัดสินว่าเห็นแถวไหน) */
async function rest(path, opts = {}) {
  const s = await ensureFreshToken();
  if (!s) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');

  const res = await fetch(url('/rest/v1' + path), {
    ...opts,
    headers: {
      apikey: apikey(),
      Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || `เรียกข้อมูลไม่สำเร็จ (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * นับจำนวนแถวโดยไม่ต้องโหลดข้อมูลจริงลงมือถือ
 * ใช้ header `Prefer: count=exact` แล้วอ่านจำนวนจาก Content-Range ("0-24/137")
 * RLS ยังทำงานตามปกติ → นับเฉพาะแถวที่ผู้ใช้คนนี้มีสิทธิ์เห็น
 */
async function countRows(path) {
  const s = await ensureFreshToken();
  if (!s) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');

  const res = await fetch(url('/rest/v1' + path), {
    headers: {
      apikey: apikey(),
      Authorization: `Bearer ${s.access_token}`,
      Prefer: 'count=exact',
      Range: '0-0',                 // ไม่ต้องการตัวข้อมูล ขอแค่ยอดรวม
    },
  });
  if (!res.ok) throw new Error(`นับข้อมูลไม่สำเร็จ (${res.status})`);

  const total = res.headers.get('content-range')?.split('/')[1];
  return total && total !== '*' ? Number(total) : 0;
}

/** ดึง profile ของผู้ใช้ (ชื่อ/role/ทีม) — ผ่าน RLS จริง ไม่ได้เชื่อค่าจากฝั่ง client */
async function fetchProfile(userId) {
  const rows = await rest(
    `/profiles?id=eq.${userId}&select=id,email,full_name,role,is_active,team_id,teams(code,name)`
  );
  return rows?.[0] || null;
}

/** รวม user + profile ให้เป็นรูปเดียวที่ UI ใช้ (ตรงกับ local-adapter) */
function shapeUser(authUser, profile) {
  return {
    id:        authUser?.id || profile?.id,
    email:     profile?.email || authUser?.email,
    full_name: profile?.full_name || '',
    role:      profile?.role || 'sale',
    team_id:   profile?.team_id || null,
    team:      profile?.teams?.code || null,
    team_name: profile?.teams?.name || null,
  };
}

// ---------- ตัวช่วยสร้าง query (Phase 1.3) ----------

// คอลัมน์ที่ยอมให้เรียงได้ — ห้ามเอาค่าจาก UI ไปต่อ URL ตรง ๆ
const CUST_SORTABLE = new Set([
  'name', 'org', 'color', 'updated_at', 'created_at', 'birthday',
]);

const ACT_SORTABLE = new Set([
  'due_date', 'status', 'title', 'updated_at', 'created_at',
]);

const SORTABLE = new Set([
  'close_month', 'decision_day', 'purchased_day', 'next_date',
  'value_baht', 'project_name', 'customer_name', 'stage', 'updated_at', 'created_at',
]);

// ฟิลด์ที่ DB จัดการเอง — ต้องตัดทิ้งก่อนส่งกลับไปเขียน ไม่งั้น PostgREST ตอบ 400
const READONLY = new Set([
  'created_at', 'updated_at', 'created_by',
  'teams', 'follow_logs', 'project_contacts', 'profiles',
]);

// ดึงบันทึกติดตามล่าสุด 1 รายการฝังมากับทุกแถว
// เพื่อให้เห็นความคืบหน้าจากหน้าตารางเลย ไม่ต้องเปิดเข้าไปดูทีละงาน
const PENDING_SELECT = '*,teams(code,name),follow_logs(log_date,by_name,response,next_doing)';

/** ตัด field ที่เขียนไม่ได้ + ช่องว่างเปล่าให้เป็น null (ไม่งั้น date ว่างจะ error) */
function cleanRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (READONLY.has(k)) continue;
    out[k] = v === '' ? null : v;
  }
  return out;
}

/** กันอักขระที่มีความหมายพิเศษใน PostgREST (`,` แยกเงื่อนไข · `*` คือ wildcard) */
const safeSearch = (s) => String(s || '').replace(/[,()*\\]/g, ' ').trim();

const supabaseAdapter = {
  async init() {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('ยังไม่ได้กรอก SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY ใน config.js');
    }
    loadSession();
  },

  info: () => ({ mode: 'supabase', label: 'ต่อฐานข้อมูลแล้ว', online: true }),

  // ---------- auth ----------

  /** คืน session ถ้ายังใช้ได้ · null ถ้ายังไม่ล็อกอิน/หมดอายุ */
  async getSession() {
    const s = await ensureFreshToken();
    if (!s) return null;

    // ยังไม่มี profile ติดมา (เพิ่งเปิดเบราว์เซอร์ใหม่) → ดึงเพิ่ม
    if (!s.profile) {
      try {
        const profile = await fetchProfile(s.user?.id);
        if (!profile) { saveSession(null); return null; }
        if (!profile.is_active) { saveSession(null); throw new Error('บัญชีนี้ถูกปิดใช้งาน — ติดต่อผู้ดูแล'); }
        saveSession({ ...s, profile });
        return { user: shapeUser(s.user, profile) };
      } catch (e) {
        if (String(e.message).includes('ปิดใช้งาน')) throw e;
        saveSession(null);
        return null;
      }
    }
    return { user: shapeUser(s.user, s.profile) };
  },

  async signIn(email, password) {
    const d = await postAuth('/auth/v1/token?grant_type=password', {
      email: String(email || '').trim(),
      password: password || '',
    });

    saveSession(toSession(d));

    const profile = await fetchProfile(d.user?.id);
    if (!profile) {
      saveSession(null);
      throw new Error('บัญชีนี้ยังไม่มีข้อมูลผู้ใช้ในระบบ — ติดต่อผู้ดูแล');
    }
    if (!profile.is_active) {
      saveSession(null);
      throw new Error('บัญชีนี้ถูกปิดใช้งาน — ติดต่อผู้ดูแล');
    }

    saveSession({ ...toSession(d), profile });
    return { user: shapeUser(d.user, profile) };
  },

  async signOut() {
    const token = session?.access_token;
    saveSession(null);           // ล้างฝั่งเราก่อนเสมอ ถึงยิง API ไม่ผ่านก็ต้องหลุดออก
    if (!token) return;
    try {
      await fetch(url('/auth/v1/logout'), {
        method: 'POST',
        headers: { apikey: apikey(), Authorization: `Bearer ${token}` },
      });
    } catch { /* ออฟไลน์ก็ถือว่าออกจากระบบแล้ว */ }
  },

  // ---------- B1 Teams ----------

  async listTeams() {
    return rest('/teams?select=id,code,name,description&is_active=eq.true&order=sort_order.asc');
  },

  // ---------- B2 Pending Projects ----------

  /**
   * opt:
   *   status ('active')  'active' = เฉพาะงานที่เดินอยู่ (ค่าเริ่มต้น)
   *                      'archived' = เฉพาะงานที่เก็บเข้า Archive แล้ว
   *                      'all' = ทั้งหมด
   *   teamId, stage      กรอง
   *   from, to           ช่วงเดือนคาดปิด 'YYYY-MM' (close_month)
   *   search             ค้นชื่องาน/ลูกค้า/PENDING NO.
   *   sort, dir          เรียง (ต้องอยู่ใน SORTABLE)
   *   limit              กันดึงทั้งตารางบนมือถือ
   *
   * ไม่ต้องส่ง "ดูทีมไหนได้" มาเอง — RLS ฝั่ง DB ตัดสินให้แล้ว
   */
  async listPending(opt = {}) {
    const {
      status = 'active', teamId, stage, from, to, search,
      sort = 'updated_at', dir = 'desc', limit = 500,
    } = opt;

    const p = new URLSearchParams();
    p.set('select', PENDING_SELECT);

    if (status === 'active')        p.set('is_active', 'eq.true');
    else if (status === 'archived') p.set('is_active', 'eq.false');
    // 'all' = ไม่กรอง
    if (teamId)     p.set('team_id',   `eq.${teamId}`);
    if (stage)      p.set('stage',     `eq.${stage}`);

    // ช่วงเดือนคาดปิด — close_month เก็บเป็น 'YYYY-MM' เรียงตามตัวอักษร = เรียงตามเวลาพอดี
    // ⚠️ step 1.4 ต้องเพิ่ม fallback ไปใช้ decision_day เมื่อยังไม่กรอก close_month
    //    (ตอนนี้งานที่ไม่กรอกจะหายจากผลกรอง — ตั้งใจให้เห็นชัดว่ายังไม่ได้ทำ)
    if (from) p.append('close_month', `gte.${from}`);
    if (to)   p.append('close_month', `lte.${to}`);

    const term = safeSearch(search);
    if (term) {
      p.set('or', `(project_name.ilike.*${term}*,customer_name.ilike.*${term}*,pending_no.ilike.*${term}*)`);
    }

    const col = SORTABLE.has(sort) ? sort : 'updated_at';
    const way = dir === 'asc' ? 'asc' : 'desc';
    // nullslast: งานที่ยังไม่กรอกวันที่ต้องไปอยู่ท้ายตาราง ไม่ใช่ลอยขึ้นหัว
    p.set('order', `${col}.${way}.nullslast`);
    p.set('limit', String(limit));

    // เอาเฉพาะบันทึกล่าสุด 1 อันของแต่ละงาน ไม่ต้องลากทั้งประวัติลงมือถือ
    p.set('follow_logs.order', 'log_date.desc');
    p.set('follow_logs.limit', '1');

    const rows = await rest('/pending_projects?' + p.toString());
    // แปลงให้ UI ใช้ง่าย: last_log = บันทึกล่าสุด หรือ null
    return (rows || []).map(r => ({ ...r, last_log: r.follow_logs?.[0] || null }));
  },

  /** นับจำนวนงานตามสถานะ — ใช้โชว์ป้ายบนแถบ Archive ว่ามีของอยู่กี่งาน */
  async countPending(status = 'active') {
    const flag = status === 'archived' ? 'eq.false' : 'eq.true';
    return countRows(`/pending_projects?select=id&is_active=${flag}`);
  },

  /** งาน 1 ใบ + บันทึกติดตาม + ผู้ติดต่อ — ดึงทีเดียวจบ ไม่ต้องยิง 3 รอบ */
  async getPending(id) {
    const rows = await rest(
      `/pending_projects?id=eq.${encodeURIComponent(id)}` +
      '&select=*,teams(code,name),follow_logs(*),project_contacts(*)'
    );
    return rows?.[0] || null;
  },

  /** มี id = แก้ · ไม่มี = สร้างใหม่ */
  async savePending(row) {
    const body = cleanRow(row);
    const me   = session?.user?.id || null;

    if (body.id) {
      const id = body.id;
      delete body.id;
      body.updated_by = me;
      const rows = await rest(`/pending_projects?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      return rows?.[0] || null;
    }

    body.created_by = me;
    body.updated_by = me;
    const rows = await rest('/pending_projects', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return rows?.[0] || null;
  },

  /**
   * ทางลบปกติของ sale — ไม่ได้ลบจริง แค่ย้ายเข้า archive
   * (policy `pending_delete` เปิดให้ admin เท่านั้น เพราะระบบทำแค่ backup ไม่มี rollback)
   */
  async archivePending(id, archived = true) {
    const rows = await rest(`/pending_projects?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        is_active:   !archived,
        archived_at: archived ? new Date().toISOString() : null,
        updated_by:  session?.user?.id || null,
      }),
    });
    return rows?.[0] || null;
  },

  /** ลบถาวร — admin เท่านั้น (คนอื่นจะโดน RLS ปฏิเสธที่ฝั่ง DB) */
  async deletePending(id) {
    await rest(`/pending_projects?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ---------- B2 · ผู้ติดต่อ 1–3 ----------

  /**
   * เขียนทับผู้ติดต่อทั้งชุด — upsert ทีละช่องด้วย unique(pending_id, slot)
   * ช่องที่ผู้ใช้ล้างจนว่างหมดให้ลบทิ้ง ไม่เก็บแถวเปล่าไว้ในตาราง
   */
  async saveContacts(pendingId, contacts) {
    const pid   = encodeURIComponent(pendingId);
    const keep  = [];
    const drop  = [];

    for (const c of contacts) {
      const filled = ['name', 'status', 'address', 'phone', 'email']
        .some(k => String(c[k] ?? '').trim());
      (filled ? keep : drop).push(c);
    }

    for (const c of drop) {
      await rest(`/project_contacts?pending_id=eq.${pid}&slot=eq.${Number(c.slot)}`,
                 { method: 'DELETE' });
    }

    if (keep.length) {
      await rest('/project_contacts?on_conflict=pending_id,slot', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(keep.map(c => ({ ...cleanRow(c), pending_id: pendingId }))),
      });
    }
  },

  // ---------- B2 · บันทึกติดตาม ----------

  async listFollowLogs(pendingId) {
    return rest(
      `/follow_logs?pending_id=eq.${encodeURIComponent(pendingId)}` +
      '&select=*&order=log_date.desc'
    );
  },

  async addFollowLog(log) {
    const body = cleanRow(log);
    body.created_by = session?.user?.id || null;
    const rows = await rest('/follow_logs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return rows?.[0] || null;
  },

  /**
   * แก้บันทึกที่เขียนไปแล้ว
   * RLS (policy follow_update) ปล่อยเฉพาะเจ้าของบันทึกหรือ admin
   * → คนอื่นกดแก้ก็ไม่ผ่าน DB ถึงจะแก้ HTML ในเบราว์เซอร์ก็ตาม
   * ไม่ให้แก้ pending_id / created_by — กันย้ายบันทึกข้ามงานหรือสวมชื่อคนเขียน
   */
  async updateFollowLog(id, patch) {
    const body = cleanRow(patch);
    delete body.id;
    delete body.pending_id;
    delete body.created_by;

    const rows = await rest(`/follow_logs?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    // RLS ปฏิเสธเงียบ ๆ = ได้ 200 แต่ไม่มีแถวกลับมา ต้องดักเองไม่งั้นผู้ใช้นึกว่าบันทึกสำเร็จ
    if (!rows?.length) throw new Error('แก้บันทึกนี้ไม่ได้ — แก้ได้เฉพาะบันทึกที่ตัวเองเขียน');
    return rows[0];
  },

  // ---------- B6 Dashboard ----------

  /**
   * ตัวเลขสรุป — ตอนนี้นับได้จริงเฉพาะ pending
   * customers/activities ยังไม่มีตาราง (step 2.1) · ยอดรวม/ยอดปิดต้องใช้ views.sql (step 1.5)
   * คืน null สำหรับตัวที่ยังไม่มี เพื่อให้ UI แสดง "—" ได้ ไม่ใช่พังทั้งหน้า
   */
  async getDashboardStats() {
    // ตารางของ Phase 2 อาจยังไม่ถูกสร้าง (เจ้าของยังไม่ได้รัน phase2.sql)
    // → นับไม่ได้ก็คืน null ให้ UI แสดง "—" ไม่ใช่พังทั้งหน้า
    const safe = async (fn) => { try { return await fn(); } catch { return null; } };

    return {
      pendingCount:  await countRows('/pending_projects?select=id&is_active=eq.true'),
      customerCount: await safe(() => countRows('/customers?select=id&is_active=eq.true')),
      activityCount: await safe(() => countRows('/activities?select=id&is_active=eq.true&status=eq.plan')),
      pipelineValue: null,
    };
  },

  // ---------- B3 · Book 3 สี (step 2.1) ----------

  /**
   * opt:
   *   status ('active')  active / archived / all  — เหมือน listPending
   *   color              'green' | 'yellow' | 'red'  (สีความสัมพันธ์ คนละเรื่องกับ status)
   *   teamId, saleId     กรอง
   *   search             ชื่อ / หน่วยงาน / เบอร์โทร
   */
  async listCustomers(opt = {}) {
    const {
      status = 'active', color, teamId, saleId, search,
      sort = 'updated_at', dir = 'desc', limit = 1000,
    } = opt;

    const p = new URLSearchParams();
    p.set('select', '*,teams(code,name),customer_logs(log_date,by_name,response,next_doing)');

    if (status === 'active')        p.set('is_active', 'eq.true');
    else if (status === 'archived') p.set('is_active', 'eq.false');

    if (color)  p.set('color',   `eq.${color}`);
    if (teamId) p.set('team_id', `eq.${teamId}`);
    if (saleId) p.set('sale_id', `eq.${saleId}`);

    const term = safeSearch(search);
    if (term) p.set('or', `(name.ilike.*${term}*,org.ilike.*${term}*,tel.ilike.*${term}*)`);

    const col = CUST_SORTABLE.has(sort) ? sort : 'updated_at';
    p.set('order', `${col}.${dir === 'asc' ? 'asc' : 'desc'}.nullslast`);
    p.set('limit', String(limit));
    p.set('customer_logs.order', 'log_date.desc');
    p.set('customer_logs.limit', '1');

    const rows = await rest('/customers?' + p.toString());
    return (rows || []).map(r => ({ ...r, last_log: r.customer_logs?.[0] || null }));
  },

  async getCustomer(id) {
    const rows = await rest(
      `/customers?id=eq.${encodeURIComponent(id)}&select=*,teams(code,name),customer_logs(*)`
    );
    return rows?.[0] || null;
  },

  async saveCustomer(row) {
    const body = cleanRow(row);
    const me = session?.user?.id || null;

    if (body.id) {
      const id = body.id;
      delete body.id;
      body.updated_by = me;
      const rows = await rest(`/customers?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      return rows?.[0] || null;
    }

    body.created_by = me;
    body.updated_by = me;
    const rows = await rest('/customers', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return rows?.[0] || null;
  },

  /** ทางลบปกติของ sale — ลบถาวรได้เฉพาะ admin (กติกาเดียวกับ pending) */
  async archiveCustomer(id, archived = true) {
    const rows = await rest(`/customers?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        is_active:   !archived,
        archived_at: archived ? new Date().toISOString() : null,
        updated_by:  session?.user?.id || null,
      }),
    });
    return rows?.[0] || null;
  },

  async countCustomers(status = 'active') {
    const flag = status === 'archived' ? 'eq.false' : 'eq.true';
    return countRows(`/customers?select=id&is_active=${flag}`);
  },

  // ---------- B3 · บันทึกติดตามลูกค้า ----------

  async listCustomerLogs(customerId) {
    return rest(`/customer_logs?customer_id=eq.${encodeURIComponent(customerId)}` +
                '&select=*&order=log_date.desc');
  },

  async addCustomerLog(log) {
    const body = cleanRow(log);
    body.created_by = session?.user?.id || null;
    const rows = await rest('/customer_logs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return rows?.[0] || null;
  },

  async updateCustomerLog(id, patch) {
    const body = cleanRow(patch);
    delete body.id; delete body.customer_id; delete body.created_by;
    const rows = await rest(`/customer_logs?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!rows?.length) throw new Error('แก้บันทึกนี้ไม่ได้ — แก้ได้เฉพาะบันทึกที่ตัวเองเขียน');
    return rows[0];
  },

  // ---------- B4 · Activities (step 2.1) ----------

  /** opt: status ('plan'|'done'|'cancel') · from/to = ช่วง due_date · pendingId · customerId */
  async listActivities(opt = {}) {
    const { status, from, to, pendingId, customerId, ownerId,
            sort = 'due_date', dir = 'asc', limit = 500 } = opt;

    const p = new URLSearchParams();
    p.set('select', '*,teams(code,name)');
    p.set('is_active', 'eq.true');

    if (status)     p.set('status',      `eq.${status}`);
    if (pendingId)  p.set('pending_id',  `eq.${pendingId}`);
    if (customerId) p.set('customer_id', `eq.${customerId}`);
    if (ownerId)    p.set('owner_id',    `eq.${ownerId}`);
    if (from) p.append('due_date', `gte.${from}`);
    if (to)   p.append('due_date', `lte.${to}`);

    const col = ACT_SORTABLE.has(sort) ? sort : 'due_date';
    p.set('order', `${col}.${dir === 'asc' ? 'asc' : 'desc'}.nullslast`);
    p.set('limit', String(limit));

    return rest('/activities?' + p.toString());
  },

  async saveActivity(row) {
    const body = cleanRow(row);
    const me = session?.user?.id || null;

    // ทำเสร็จแล้วต้องประทับเวลาให้อัตโนมัติ · ย้อนกลับเป็น plan ต้องล้างทิ้ง
    if (body.status === 'done' && !body.done_at) body.done_at = new Date().toISOString();
    if (body.status && body.status !== 'done')   body.done_at = null;

    if (body.id) {
      const id = body.id;
      delete body.id;
      body.updated_by = me;
      const rows = await rest(`/activities?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      return rows?.[0] || null;
    }

    body.created_by = me;
    body.updated_by = me;
    const rows = await rest('/activities', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return rows?.[0] || null;
  },

  async countActivities(status = 'plan') {
    return countRows(`/activities?select=id&is_active=eq.true&status=eq.${encodeURIComponent(status)}`);
  },
};

const notReady = (what, phase) => {
  throw new Error(`ส่วนนี้ยังไม่เปิดใช้ (${what}) — มาใน Phase ${phase}`);
};

export default supabaseAdapter;
