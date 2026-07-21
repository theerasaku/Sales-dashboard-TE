// supabase-adapter — ต่อ Supabase จริง
// โครงไว้ก่อน · เติมของจริงใน Phase 1.3 (หลังมี schema จาก 1.1)
// ใช้ REST + Auth ผ่าน fetch ตรง ๆ ไม่ต้องพึ่ง CDN library

import { CONFIG } from '../config.js';

const notReady = (what) => {
  throw new Error(`supabase-adapter: ยังไม่ได้ทำ ${what} (Phase 1.3)`);
};

const supabaseAdapter = {
  async init() {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('ยังไม่ได้กรอก SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY ใน config.js');
    }
  },

  info: () => ({ mode: 'supabase', label: 'ต่อ Supabase', online: true }),

  async getSession()  { return notReady('getSession'); },
  async signIn()      { return notReady('signIn'); },
  async signOut()     { return notReady('signOut'); },

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

export default supabaseAdapter;
