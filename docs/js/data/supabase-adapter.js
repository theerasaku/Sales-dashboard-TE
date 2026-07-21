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

// ---------- adapter ----------

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

  // ---------- ข้อมูล — Phase 1.3 ----------

  async listPending()   { return notReady('listPending'); },
  async getPending()    { return notReady('getPending'); },
  async savePending()   { return notReady('savePending'); },
  async deletePending() { return notReady('deletePending'); },

  async listCustomers() { return notReady('listCustomers'); },
  async saveCustomer()  { return notReady('saveCustomer'); },

  async listActivities() { return notReady('listActivities'); },
  async saveActivity()   { return notReady('saveActivity'); },

  async getDashboardStats() { return notReady('getDashboardStats'); },
};

const notReady = (what) => {
  throw new Error(`ส่วนนี้ยังไม่เปิดใช้ (${what}) — มาใน Phase 1.3`);
};

export default supabaseAdapter;
