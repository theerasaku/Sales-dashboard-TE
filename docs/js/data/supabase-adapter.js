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
const SORTABLE = new Set([
  'close_month', 'decision_day', 'purchased_day', 'next_date',
  'value_baht', 'project_name', 'customer_name', 'stage', 'updated_at', 'created_at',
]);

// ฟิลด์ที่ DB จัดการเอง — ต้องตัดทิ้งก่อนส่งกลับไปเขียน ไม่งั้น PostgREST ตอบ 400
const READONLY = new Set([
  'created_at', 'updated_at', 'created_by',
  'teams', 'follow_logs', 'project_contacts', 'profiles',
]);

const PENDING_SELECT = '*,teams(code,name)';

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
   *   activeOnly (true)  ซ่อนงานที่ archive แล้ว — ค่าเริ่มต้นซ่อน (step 2.5)
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
      activeOnly = true, teamId, stage, from, to, search,
      sort = 'updated_at', dir = 'desc', limit = 500,
    } = opt;

    const p = new URLSearchParams();
    p.set('select', PENDING_SELECT);

    if (activeOnly) p.set('is_active', 'eq.true');
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

    return rest('/pending_projects?' + p.toString());
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

  // ---------- B6 Dashboard ----------

  /**
   * ตัวเลขสรุป — ตอนนี้นับได้จริงเฉพาะ pending
   * customers/activities ยังไม่มีตาราง (step 2.1) · ยอดรวม/ยอดปิดต้องใช้ views.sql (step 1.5)
   * คืน null สำหรับตัวที่ยังไม่มี เพื่อให้ UI แสดง "—" ได้ ไม่ใช่พังทั้งหน้า
   */
  async getDashboardStats() {
    return {
      pendingCount:  await countRows('/pending_projects?select=id&is_active=eq.true'),
      customerCount: null,
      activityCount: null,
      pipelineValue: null,
    };
  },

  // ---------- ยังไม่มีตารางรองรับ (สร้างใน step 2.1) ----------

  async listCustomers() { return notReady('listCustomers', '2.1'); },
  async saveCustomer()  { return notReady('saveCustomer',  '2.1'); },

  async listActivities() { return notReady('listActivities', '2.1'); },
  async saveActivity()   { return notReady('saveActivity',   '2.1'); },
};

const notReady = (what, phase) => {
  throw new Error(`ส่วนนี้ยังไม่เปิดใช้ (${what}) — มาใน Phase ${phase}`);
};

export default supabaseAdapter;
