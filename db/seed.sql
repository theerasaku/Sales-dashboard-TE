-- TE Sales Dashboard — ข้อมูลตั้งต้น (step 1.1)
--
-- ⚠️ ห้ามใส่ข้อมูลลูกค้าจริงในไฟล์นี้เด็ดขาด — repo เป็น public
--    ข้อมูลจริงเข้าทาง tools/import-json.html (step 1.6) → Supabase ที่มี RLS
--
-- ขอบเขต step 1.1: teams 4 ทีม
-- lead_sources 8 เส้นทาง + app_settings (เป้า 80MB) มาใน step 3.1 (B5)
--
-- วิธีรัน: รัน schema.sql → policies.sql ให้เสร็จก่อน แล้ววางไฟล์นี้ → Run
-- รันซ้ำได้: on conflict do update ทำให้ข้อมูลไม่ซ้ำและอัปเดตชื่อได้

-- ══════════════════════════════════════════════════════════
-- ทีมขาย 4 ทีม
-- ══════════════════════════════════════════════════════════

insert into teams (code, name, description, sort_order) values
  ('GOV.1',  'GOV.1',          'งานราชการ / ประมูล e-bidding',        1),
  ('TE-IMP', 'TE-IMP',         'งานเอกชน / โรงงาน / นำเข้า',          2),
  ('GOV.4',  'GOV.4',          'งานท้องถิ่น / น้ำบาดาล',              3),
  ('SYSTEM', 'System Project', 'งานระบบ / โครงการพิเศษ',              4)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      sort_order  = excluded.sort_order;

-- ══════════════════════════════════════════════════════════
-- ตั้ง admin คนแรก (ทำหลังเชิญบัญชีตัวเองใน Supabase แล้ว)
--
-- ขั้นตอน:
--   1) Authentication → Users → Invite user → ใส่อีเมลตัวเอง
--   2) กดลิงก์ในเมล ตั้งรหัสผ่าน (trigger จะสร้างแถวใน profiles ให้อัตโนมัติ role = 'sale')
--   3) แก้อีเมลข้างล่างเป็นของตัวเอง เอา comment ออก แล้วรัน
--
-- ต้องมี admin อย่างน้อย 1 คน ไม่งั้นจะไม่มีใครแก้ role ให้คนอื่นได้เลย
-- ══════════════════════════════════════════════════════════

-- update profiles
--    set role = 'admin', full_name = 'เก๋'
--  where email = 'ใส่อีเมลของคุณตรงนี้';

-- ══════════════════════════════════════════════════════════
-- ตรวจผลหลังรันครบ 3 ไฟล์
-- ══════════════════════════════════════════════════════════

-- ทีมครบ 4 ทีมไหม
-- select code, name, sort_order from teams order by sort_order;

-- RLS เปิดครบทุกตารางไหม (rowsecurity ต้องเป็น true ทั้ง 5 แถว)
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public'
--    and tablename in ('teams','profiles','pending_projects','follow_logs','project_contacts')
--  order by tablename;

-- policy ติดครบไหม
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public' order by tablename, policyname;
