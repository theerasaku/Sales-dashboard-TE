// ค่าตั้งต้นของระบบ — ไฟล์นี้อยู่ใน public repo
//
// ใส่ได้เฉพาะ key สาธารณะเท่านั้น:
//   ✅ sb_publishable_... (รุ่นใหม่) หรือ anon key (รุ่นเดิม) — ออกแบบมาให้เปิดเผยได้
//   ❌ sb_secret_... / service_role key — ห้ามใส่เด็ดขาด ทะลุ RLS ได้ทุกตาราง
//
// ความปลอดภัยจริงอยู่ที่ Row Level Security ใน db/policies.sql ไม่ใช่การซ่อน key

export const CONFIG = {
  APP_NAME: 'TE Sales Dashboard',
  VERSION: '0.1.0',

  // 'local'    = เก็บใน localStorage (ทำงานได้เลย ไม่ต้องมี backend)
  // 'supabase' = ต่อ Supabase จริง
  //
  // ⚠️ ยังต้องเป็น 'local' อยู่ จะสลับเป็น 'supabase' ได้เมื่อครบ 2 อย่าง:
  //    1) รัน db/schema.sql → policies.sql → seed.sql ใน Supabase แล้ว
  //    2) ทำ step 1.3 (เขียน supabase-adapter.js ของจริง) เสร็จ — ตอนนี้ยังเป็นโครงเปล่า
  DATA_MODE: 'local',

  // === Phase 0.2 ✅ กรอกแล้ว (project: Sales TE · region Singapore) ===
  SUPABASE_URL: 'https://ejszfgsecuuysaamvtcn.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0h8gVNyQ6hKJFPM6-_zgOw_uPI5v1V-',

  // ทีมขาย
  TEAMS: ['GOV.1', 'GOV.3', 'GOV.4', 'TE-IMP', 'System Project'],

  // เป้ายอดขายรวม (ล้านบาท)
  TARGET_MB: 80,
};

// พร้อมใช้ Supabase จริงหรือยัง
export const hasSupabaseConfig = () =>
  Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY);
