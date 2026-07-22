// ค่าตั้งต้นของระบบ — ไฟล์นี้อยู่ใน public repo
//
// ใส่ได้เฉพาะ key สาธารณะเท่านั้น:
//   ✅ sb_publishable_... (รุ่นใหม่) หรือ anon key (รุ่นเดิม) — ออกแบบมาให้เปิดเผยได้
//   ❌ sb_secret_... / service_role key — ห้ามใส่เด็ดขาด ทะลุ RLS ได้ทุกตาราง
//
// ความปลอดภัยจริงอยู่ที่ Row Level Security ใน db/policies.sql ไม่ใช่การซ่อน key

export const CONFIG = {
  APP_NAME: 'TE Sales Dashboard',
  VERSION: '0.4.0',

  // 'local'    = เก็บใน localStorage (ไม่ต้องมี backend · ใช้ตอน dev/ออฟไลน์)
  // 'supabase' = ต่อ Supabase จริง (ต้องล็อกอินก่อนถึงใช้งานได้)
  //
  // Phase 1.2: auth ใช้งานได้จริงแล้ว · การดึงข้อมูลตาราง (pending/customers)
  // ยังเป็นโครงอยู่ จะเติมใน Phase 1.3
  DATA_MODE: 'supabase',

  // === Phase 0.2 ✅ กรอกแล้ว (project: Sales TE · region Singapore) ===
  SUPABASE_URL: 'https://ejszfgsecuuysaamvtcn.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0h8gVNyQ6hKJFPM6-_zgOw_uPI5v1V-',

  // ทีมขาย
  TEAMS: ['GOV.1', 'GOV.3', 'GOV.4', 'TE-IMP', 'System Project'],

  // เป้ายอดขายรวม หน่วย "ล้านบาท" (MB = Million Baht ไม่ใช่ megabyte)
  // ⚠️ เวลาแสดงบนหน้าจอให้เขียน "80 ล้านบาท" เสมอ ห้ามเขียน "80 MB" ทีมขายอ่านแล้วสับสน
  TARGET_MB: 80,
  TARGET_PERIOD: 'ก.ค.–ธ.ค. 2569',

  // ช่วงเป้าเป็น ค.ศ. เสมอ ('YYYY-MM') ให้ตรงกับที่เก็บใน DB
  // พ.ศ. 2569 = ค.ศ. 2026 · ใช้เทียบกับ close_month / purchased_day
  TARGET_FROM: '2026-07',
  TARGET_TO:   '2026-12',
};

// พร้อมใช้ Supabase จริงหรือยัง
export const hasSupabaseConfig = () =>
  Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY);
