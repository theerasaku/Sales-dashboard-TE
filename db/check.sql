-- TE Sales Dashboard — สคริปต์ตรวจสุขภาพระบบ
--
-- รันใน Supabase SQL Editor เมื่อไหร่ก็ได้ ไม่แก้ไขข้อมูลอะไรทั้งสิ้น (อ่านอย่างเดียว)
-- ใช้ตรวจว่า schema.sql / policies.sql / seed.sql ติดครบจริงไหม
--
-- ผลที่ถูกต้องหลังรันครบ 3 ไฟล์:
--   ทีมทั้งหมด           5    GOV.1, GOV.3, GOV.4, TE-IMP, SYSTEM
--   ตารางที่เปิด RLS      5    ครบทั้ง 5 ตาราง
--   policy ทั้งหมด       15
--   ตารางที่ authenticated แตะได้  5
--   ผู้ใช้ในระบบ          ตามจำนวนที่เชิญ (ต้องมี admin อย่างน้อย 1 คน)

select 'ทีมทั้งหมด' as รายการ,
       count(*)::text as จำนวน,
       coalesce(string_agg(code, ', ' order by sort_order), '(ยังไม่มี)') as รายละเอียด
  from teams

union all
select 'ตารางที่เปิด RLS',
       count(*)::text,
       coalesce(string_agg(tablename, ', ' order by tablename), '(ยังไม่เปิด)')
  from pg_tables
 where schemaname = 'public'
   and rowsecurity
   and tablename in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'policy ทั้งหมด',
       count(*)::text,
       '(ควรเป็น 15)'
  from pg_policies
 where schemaname = 'public'

union all
select 'ตารางที่ authenticated แตะได้',
       count(distinct table_name)::text,
       coalesce(string_agg(distinct table_name, ', '), '(ไม่มีสิทธิ์เลย — ต้องรัน policies.sql ใหม่)')
  from information_schema.role_table_grants
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'ตารางที่ anon แตะได้ (ต้องเป็น 0)',
       count(distinct table_name)::text,
       coalesce(string_agg(distinct table_name, ', '), '(ไม่มี — ถูกต้อง ✅)')
  from information_schema.role_table_grants
 where grantee = 'anon'
   and table_schema = 'public'
   and table_name in ('teams','profiles','pending_projects','follow_logs','project_contacts')

union all
select 'ผู้ใช้ในระบบ',
       count(*)::text,
       coalesce(string_agg(email || ' → ' || role, ', ' order by email),
                '(ยังไม่มี — ต้อง Invite user ก่อน)')
  from profiles;
