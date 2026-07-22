// local-adapter — เก็บข้อมูลใน localStorage ใช้ทำงาน offline / dev ก่อนต่อ Supabase
// โครง API ต้องตรงกับ supabase-adapter.js เป๊ะ ๆ

const KEY = 'te-dashboard:v1';

/**
 * ⚠️ ต้องเป็นฟังก์ชัน ห้ามเป็นค่าคงที่แล้วใช้ { ...EMPTY }
 *    spread คัดลอกแค่ชั้นนอก — อาร์เรย์ข้างในยังเป็นตัวเดียวกัน
 *    ผลคือ push ข้อมูลใหม่ไปเปื้อนค่าตั้งต้น พอ "ล้างข้อมูล" แล้วของเก่าไม่หาย
 *    (เจอตอนทดสอบ step 1.6: ล้าง localStorage แล้วยังเหลือ 2 งานค้างอยู่)
 */
const emptyDb = () => ({
  pending_projects: [],
  follow_logs: [],
  project_contacts: [],
  customers: [],
  customer_logs: [],
  activities: [],
  profiles: [],
  team_access: [],
  teams_custom: [],
  app_settings: {},
  session: null,
});

let db = emptyDb();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb();
  } catch {
    db = emptyDb();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('บันทึก localStorage ไม่สำเร็จ', e);
  }
}

const uid = () => 'loc_' + Math.random().toString(36).slice(2, 10);

function upsert(table, row) {
  const list = db[table];
  if (row.id) {
    const i = list.findIndex(r => r.id === row.id);
    if (i >= 0) {
      list[i] = { ...list[i], ...row, updated_at: new Date().toISOString() };
      save();
      return list[i];
    }
  }
  const created = { ...row, id: row.id || uid(), created_at: new Date().toISOString() };
  list.push(created);
  save();
  return created;
}

const localAdapter = {
  async init() { load(); },

  info: () => ({ mode: 'local', label: 'โหมดออฟไลน์ (localStorage)', online: false }),

  // auth — โหมด local ไม่มี auth จริง สมมติเป็น admin (รูปข้อมูลต้องตรงกับ supabase-adapter)
  async getSession() { return db.session; },
  async signIn(email) {
    db.session = {
      user: {
        id: 'local-user',
        email: email || 'local@te',
        full_name: 'โหมดออฟไลน์',
        role: 'admin',
        team_id: null,
        team: null,
        team_name: null,
      },
    };
    save();
    return db.session;
  },
  async signOut() { db.session = null; save(); },

  // B1
  async listTeams() {
    const base = [
      { id: 'GOV.1',  code: 'GOV.1',  name: 'GOV.1' },
      { id: 'GOV.3',  code: 'GOV.3',  name: 'GOV.3' },
      { id: 'GOV.4',  code: 'GOV.4',  name: 'GOV.4' },
      { id: 'TE-IMP', code: 'TE-IMP', name: 'TE-IMP' },
      { id: 'SYSTEM', code: 'SYSTEM', name: 'System Project' },
    ];
    // ทีมที่เพิ่มจากหน้า Admin ตอนทดสอบโหมดออฟไลน์ (ของจริงอยู่ในตาราง teams)
    const extra = db.teams_custom.filter(t => !base.some(b => b.code === t.code));
    return [...base, ...extra];
  },

  // B2 — กรอง/เรียงในหน่วยความจำ ให้ผลลัพธ์เหมือน supabase-adapter
  async listPending(opt = {}) {
    const {
      status = 'active', teamId, stage, from, to, search,
      sort = 'updated_at', dir = 'desc', limit = 500,
    } = opt;

    let rows = [...db.pending_projects];
    if (status === 'active')        rows = rows.filter(r => r.is_active !== false);
    else if (status === 'archived') rows = rows.filter(r => r.is_active === false);
    if (teamId)     rows = rows.filter(r => r.team_id === teamId);
    if (stage)      rows = rows.filter(r => r.stage === stage);
    if (from)       rows = rows.filter(r => r.close_month && r.close_month >= from);
    if (to)         rows = rows.filter(r => r.close_month && r.close_month <= to);

    const term = String(search || '').trim().toLowerCase();
    if (term) {
      rows = rows.filter(r =>
        [r.project_name, r.customer_name, r.pending_no]
          .some(v => String(v || '').toLowerCase().includes(term)));
    }

    // ค่าว่างไปท้ายตารางเสมอ (ให้ตรงกับ nullslast ของ PostgREST)
    const sign = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x > y ? sign : x < y ? -sign : 0;
    });

    // แนบบันทึกล่าสุดให้เหมือน supabase-adapter (UI อ่าน row.last_log)
    return rows.slice(0, limit).map(r => ({
      ...r,
      last_log: db.follow_logs
        .filter(l => l.pending_id === r.id)
        .sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)))[0] || null,
    }));
  },

  async countPending(status = 'active') {
    return db.pending_projects.filter(r =>
      status === 'archived' ? r.is_active === false : r.is_active !== false).length;
  },

  async getPending(id) {
    const row = db.pending_projects.find(r => r.id === id);
    if (!row) return null;
    return {
      ...row,
      follow_logs: db.follow_logs.filter(l => l.pending_id === id),
      project_contacts: db.project_contacts.filter(c => c.pending_id === id),
    };
  },
  async savePending(r)  { return upsert('pending_projects', r); },

  async archivePending(id, archived = true) {
    const row = db.pending_projects.find(r => r.id === id);
    if (!row) return null;
    row.is_active   = !archived;
    row.archived_at = archived ? new Date().toISOString() : null;
    save();
    return row;
  },

  async deletePending(id) {
    db.pending_projects = db.pending_projects.filter(r => r.id !== id);
    save();
  },

  async saveContacts(pendingId, contacts) {
    db.project_contacts = db.project_contacts.filter(c => c.pending_id !== pendingId);
    for (const c of contacts) {
      const filled = ['name', 'status', 'address', 'phone', 'email']
        .some(k => String(c[k] ?? '').trim());
      if (filled) db.project_contacts.push({ ...c, pending_id: pendingId, id: uid() });
    }
    save();
  },

  async listFollowLogs(pendingId) {
    return db.follow_logs
      .filter(l => l.pending_id === pendingId)
      .sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
  },
  async addFollowLog(log) {
    return upsert('follow_logs', { ...log, created_by: db.session?.user?.id || null });
  },

  async updateFollowLog(id, patch) {
    const row = db.follow_logs.find(l => l.id === id);
    if (!row) throw new Error('ไม่พบบันทึกนี้');
    // เลียนแบบ RLS ของ supabase: แก้ได้เฉพาะบันทึกที่ตัวเองเขียน
    const me = db.session?.user;
    if (row.created_by && me && row.created_by !== me.id && me.role !== 'admin')
      throw new Error('แก้บันทึกนี้ไม่ได้ — แก้ได้เฉพาะบันทึกที่ตัวเองเขียน');
    const { id: _i, pending_id: _p, created_by: _c, ...safe } = patch;
    Object.assign(row, safe, { updated_at: new Date().toISOString() });
    save();
    return row;
  },

  // B3 — กรอง/เรียงในหน่วยความจำ ให้ผลตรงกับ supabase-adapter
  async listCustomers(opt = {}) {
    const { status = 'active', color, teamId, saleId, search,
            sort = 'updated_at', dir = 'desc', limit = 1000 } = opt;

    let rows = [...db.customers];
    if (status === 'active')        rows = rows.filter(r => r.is_active !== false);
    else if (status === 'archived') rows = rows.filter(r => r.is_active === false);
    if (color)  rows = rows.filter(r => r.color === color);
    if (teamId) rows = rows.filter(r => r.team_id === teamId);
    if (saleId) rows = rows.filter(r => r.sale_id === saleId);

    const term = String(search || '').trim().toLowerCase();
    if (term) rows = rows.filter(r =>
      [r.name, r.org, r.tel].some(v => String(v || '').toLowerCase().includes(term)));

    const sign = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x > y ? sign : x < y ? -sign : 0;
    });

    return rows.slice(0, limit).map(r => ({
      ...r,
      last_log: db.customer_logs
        .filter(l => l.customer_id === r.id)
        .sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)))[0] || null,
    }));
  },

  async getCustomer(id) {
    const row = db.customers.find(r => r.id === id);
    if (!row) return null;
    return { ...row, customer_logs: db.customer_logs.filter(l => l.customer_id === id) };
  },

  async saveCustomer(r) { return upsert('customers', r); },

  async archiveCustomer(id, archived = true) {
    const row = db.customers.find(r => r.id === id);
    if (!row) return null;
    row.is_active   = !archived;
    row.archived_at = archived ? new Date().toISOString() : null;
    save();
    return row;
  },

  async countCustomers(status = 'active') {
    return db.customers.filter(r =>
      status === 'archived' ? r.is_active === false : r.is_active !== false).length;
  },

  async listCustomerLogs(customerId) {
    return db.customer_logs
      .filter(l => l.customer_id === customerId)
      .sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
  },
  async addCustomerLog(log) {
    return upsert('customer_logs', { ...log, created_by: db.session?.user?.id || null });
  },
  async updateCustomerLog(id, patch) {
    const row = db.customer_logs.find(l => l.id === id);
    if (!row) throw new Error('ไม่พบบันทึกนี้');
    const me = db.session?.user;
    if (row.created_by && me && row.created_by !== me.id && me.role !== 'admin')
      throw new Error('แก้บันทึกนี้ไม่ได้ — แก้ได้เฉพาะบันทึกที่ตัวเองเขียน');
    const { id: _i, customer_id: _c, created_by: _b, ...safeP } = patch;
    Object.assign(row, safeP, { updated_at: new Date().toISOString() });
    save();
    return row;
  },

  // B4
  async listActivities(opt = {}) {
    const { status, from, to, pendingId, customerId, ownerId,
            sort = 'due_date', dir = 'asc', limit = 500 } = opt;

    let rows = db.activities.filter(r => r.is_active !== false);
    if (status)     rows = rows.filter(r => r.status === status);
    if (pendingId)  rows = rows.filter(r => r.pending_id === pendingId);
    if (customerId) rows = rows.filter(r => r.customer_id === customerId);
    if (ownerId)    rows = rows.filter(r => r.owner_id === ownerId);
    if (from)       rows = rows.filter(r => r.due_date && r.due_date >= from);
    if (to)         rows = rows.filter(r => r.due_date && r.due_date <= to);

    const sign = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x > y ? sign : x < y ? -sign : 0;
    });

    // พ่วงชื่องาน/ลูกค้าที่ผูกไว้ ให้รูปข้อมูลตรงกับ embed ของ supabase-adapter เป๊ะ ๆ
    return rows.slice(0, limit).map(r => ({
      ...r,
      pending_projects: r.pending_id
        ? (({ project_name, is_active }) => ({ project_name, is_active }))(
            db.pending_projects.find(p => p.id === r.pending_id) || {})
        : null,
      customers: r.customer_id
        ? (({ name, org, is_active }) => ({ name, org, is_active }))(
            db.customers.find(c => c.id === r.customer_id) || {})
        : null,
    }));
  },

  async saveActivity(r) {
    const row = { ...r };
    if (row.status === 'done' && !row.done_at) row.done_at = new Date().toISOString();
    if (row.status && row.status !== 'done')   row.done_at = null;
    // เลียนแบบ supabase-adapter: เติมทีม/เจ้าของจาก session (ดูเหตุผลเรื่อง RLS ที่ไฟล์นั้น)
    if (!row.id || 'team_id' in row) {
      if (!row.team_id) row.team_id = db.session?.user?.team_id || null;
    }
    if (!row.id && !row.owner_id) row.owner_id = db.session?.user?.id || null;
    // embed เป็นของอ่านอย่างเดียว ห้ามเก็บลงตาราง (supabase ตัดทิ้งด้วย READONLY)
    delete row.pending_projects;
    delete row.customers;
    delete row.teams;
    return upsert('activities', row);
  },

  async countActivities(status = 'plan') {
    return db.activities.filter(r => r.is_active !== false && r.status === status).length;
  },

  // B1 — Admin (step 2.4) · โหมด local ไม่มี RLS จริง จำลองให้รูปข้อมูลตรงกัน
  async listProfiles() {
    if (!db.profiles.length && db.session?.user) {
      // โหมดออฟไลน์มีผู้ใช้คนเดียว — ปั้นแถวจาก session ให้หน้า Admin มีอะไรแสดง
      db.profiles.push({ ...db.session.user, is_active: true });
      save();
    }
    return db.profiles.map(r => ({
      ...r,
      teams: r.team_id ? { code: r.team_id, name: r.team_id } : null,
    }));
  },

  async saveProfile(id, patch) {
    const row = db.profiles.find(r => r.id === id);
    if (!row) throw new Error('ไม่พบผู้ใช้คนนี้');
    const { id: _i, email: _e, ...safe } = patch;
    Object.assign(row, safe);
    save();
    return row;
  },

  async listTeamAccess(profileId) {
    return db.team_access.filter(r => !profileId || r.profile_id === profileId);
  },

  async setTeamAccess(profileId, teamIds) {
    db.team_access = db.team_access.filter(r => r.profile_id !== profileId);
    for (const team_id of (teamIds || []).filter(Boolean)) {
      db.team_access.push({ profile_id: profileId, team_id, can_edit: true });
    }
    save();
    return db.team_access.filter(r => r.profile_id === profileId);
  },

  async saveTeam(row) { return upsert('teams_custom', row); },

  async getSettings() {
    return db.app_settings || {};
  },

  async saveSetting(key, value) {
    db.app_settings = { ...(db.app_settings || {}), [key]: value };
    save();
    return { key, value };
  },

  // B6 — Phase 1.5 จะคำนวณจริง (รูปข้อมูลต้องตรงกับ supabase-adapter: null = ยังนับไม่ได้)
  async getDashboardStats() {
    return {
      pendingCount:   db.pending_projects.filter(r => r.is_active !== false).length,
      customerCount:  db.customers.filter(r => r.is_active !== false).length,
      activityCount:  db.activities.filter(r => r.is_active !== false && r.status === 'plan').length,
      pipelineValue:  null,
    };
  },
};

export default localAdapter;
