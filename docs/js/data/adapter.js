// F2 — Data Adapter (หน้ากากเดียวที่ UI รู้จัก)
// UI ห้ามเรียก Supabase หรือ localStorage ตรง ๆ ต้องผ่านไฟล์นี้เท่านั้น
// เปลี่ยน DB ในอนาคต = เขียน adapter ใหม่ 1 ไฟล์ UI ไม่ต้องแก้

import { CONFIG, hasSupabaseConfig } from '../config.js';

let impl = null;

/** เลือก implementation ตาม CONFIG.DATA_MODE แล้ว init ครั้งเดียว */
export async function initAdapter() {
  const wantSupabase = CONFIG.DATA_MODE === 'supabase' && hasSupabaseConfig();

  if (wantSupabase) {
    const m = await import('./supabase-adapter.js');
    impl = m.default;
  } else {
    const m = await import('./local-adapter.js');
    impl = m.default;
  }

  await impl.init();
  return impl.info();
}

function need() {
  if (!impl) throw new Error('ยังไม่ได้เรียก initAdapter()');
  return impl;
}

// ---- API ที่ UI ใช้ (Phase 1 จะเติมให้ครบทุก entity) ----

export const adapter = {
  info:              ()      => need().info(),

  // auth
  getSession:        ()      => need().getSession(),
  signIn:            (e, p)  => need().signIn(e, p),
  signOut:           ()      => need().signOut(),

  // B1 teams
  listTeams:         ()      => need().listTeams(),

  // B2 pending projects
  listPending:       (opt)   => need().listPending(opt),
  getPending:        (id)    => need().getPending(id),
  savePending:       (row)   => need().savePending(row),
  // ทางลบปกติของ sale = archive (ลบถาวรได้เฉพาะ admin — ระบบทำแค่ backup ไม่มี rollback)
  archivePending:    (id, a) => need().archivePending(id, a),
  deletePending:     (id)    => need().deletePending(id),

  // B2 บันทึกติดตาม
  listFollowLogs:    (pid)   => need().listFollowLogs(pid),
  addFollowLog:      (log)   => need().addFollowLog(log),

  // B3 book 3 สี
  listCustomers:     (opt)   => need().listCustomers(opt),
  saveCustomer:      (row)   => need().saveCustomer(row),

  // B4 activities
  listActivities:    (opt)   => need().listActivities(opt),
  saveActivity:      (row)   => need().saveActivity(row),

  // B6 dashboard
  getDashboardStats: ()      => need().getDashboardStats(),
};

export default adapter;
