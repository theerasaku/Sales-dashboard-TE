// local-adapter — เก็บข้อมูลใน localStorage ใช้ทำงาน offline / dev ก่อนต่อ Supabase
// โครง API ต้องตรงกับ supabase-adapter.js เป๊ะ ๆ

const KEY = 'te-dashboard:v1';

const EMPTY = {
  pending_projects: [],
  customers: [],
  activities: [],
  session: null,
};

let db = { ...EMPTY };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    db = { ...EMPTY };
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

  // auth — โหมด local ไม่มี auth จริง สมมติเป็น admin
  async getSession() { return db.session; },
  async signIn(email) {
    db.session = { user: { id: 'local-user', email: email || 'local@te', role: 'admin', team: null } };
    save();
    return db.session;
  },
  async signOut() { db.session = null; save(); },

  // B2
  async listPending()   { return [...db.pending_projects]; },
  async getPending(id)  { return db.pending_projects.find(r => r.id === id) || null; },
  async savePending(r)  { return upsert('pending_projects', r); },
  async deletePending(id) {
    db.pending_projects = db.pending_projects.filter(r => r.id !== id);
    save();
  },

  // B3
  async listCustomers() { return [...db.customers]; },
  async saveCustomer(r) { return upsert('customers', r); },

  // B4
  async listActivities() { return [...db.activities]; },
  async saveActivity(r)  { return upsert('activities', r); },

  // B6 — Phase 1.5 จะคำนวณจริง
  async getDashboardStats() {
    return {
      pendingCount:   db.pending_projects.length,
      customerCount:  db.customers.length,
      activityCount:  db.activities.length,
      pipelineValue:  0,
    };
  },
};

export default localAdapter;
