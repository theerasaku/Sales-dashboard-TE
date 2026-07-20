// ค่าตั้งต้นของระบบ — ไฟล์นี้อยู่ใน public repo
// ใส่ได้เฉพาะ anon key เท่านั้น ห้ามใส่ service_role key เด็ดขาด

export const CONFIG = {
  APP_NAME: 'TE Sales Dashboard',
  VERSION: '0.1.0',

  // 'local'    = เก็บใน localStorage (ทำงานได้เลย ไม่ต้องมี backend)
  // 'supabase' = ต่อ Supabase จริง (ต้องกรอก SUPABASE_URL + SUPABASE_ANON_KEY ก่อน)
  DATA_MODE: 'local',

  // === Phase 0.2: กรอกหลังสร้าง project บน supabase.com ===
  // Supabase → Settings → API
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // ทีมขาย
  TEAMS: ['GOV.1', 'TE-IMP', 'GOV.4', 'System Project'],

  // เป้ายอดขายรวม (ล้านบาท)
  TARGET_MB: 80,
};

// พร้อมใช้ Supabase จริงหรือยัง
export const hasSupabaseConfig = () =>
  Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
