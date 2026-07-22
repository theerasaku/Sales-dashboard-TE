-- TE Sales Dashboard — step 3.1
-- B5 · lead_sources (8 เส้นทางหางาน) + expo_customers (ลูกค้าจากงานแสดงสินค้า)
--
-- วิธีรัน: วางทั้งไฟล์ใน Supabase → SQL Editor → Run (รันซ้ำได้ ไม่พัง)
-- ต้องรัน schema.sql · policies.sql · phase2.sql · phase2-4.sql · signoffs.sql มาก่อน

-- ══════════════════════════════════════════════════════════
-- 1) lead_sources — เส้นทางหางาน 8 ทาง
--
-- links เก็บเป็น jsonb array [{label, url}, ...] ไม่แยกเป็นตารางลูก
-- เพราะลิงก์ไม่เคยถูก query แยก มีแต่อ่านทั้งชุดไปแสดง
-- แยกตารางจะได้ join เพิ่มโดยไม่ได้อะไรกลับมา
-- ══════════════════════════════════════════════════════════

create table if not exists lead_sources (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,              -- 'gproc', 'dc', ... ใช้อ้างอิงในโค้ด
  icon        text,
  name        text not null,
  descr       text,                              -- ⚠️ ห้ามใช้ชื่อ desc — เป็นคำสงวนของ SQL
  cadence     text,                              -- ต้องตรวจถี่แค่ไหน
  owner_name  text,                              -- ใครรับผิดชอบเส้นทางนี้
  links       jsonb not null default '[]'::jsonb,
  subs        jsonb not null default '[]'::jsonb, -- ที่มาย่อย (ใช้กับ "แหล่งอื่น ๆ")
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_lead_sources_order on lead_sources(sort_order);

-- ══════════════════════════════════════════════════════════
-- 2) expo_customers — รายชื่อจากงานแสดงสินค้า (Thai Water Expo ฯลฯ)
--
-- ⚠️ ตารางนี้ "ตั้งใจ" ไม่ผูกสิทธิ์กับทีมแบบตารางอื่น
--
--    เหตุผล: นี่คือ "กองลีดกลาง" ที่ยังไม่มีเจ้าของ ทีมขายมาช่วยกันแบ่งกันไปตาม
--    ถ้าใช้ can_access_team() แถวที่ team_id ว่างจะเห็นได้แต่ admin
--    → ทั้งกองจะมองไม่เห็นจนกว่าจะมีคนไล่ assign ทีละแถว ซึ่งทำให้ฟีเจอร์ไร้ประโยชน์
--
--    พอ "รับไปดูแล" แล้วค่อยกดยกขึ้นเป็น Pending Project
--    ซึ่งตอนนั้นจะเข้าระบบสิทธิ์ตามทีมตามปกติ
--
--    ลบถาวรยังเป็นของ admin เท่านั้น เหมือนตารางอื่น
-- ══════════════════════════════════════════════════════════

create table if not exists expo_customers (
  id           uuid primary key default gen_random_uuid(),

  event_name   text not null default 'Thai Water Expo 2026',
  no           text,                              -- เลขลำดับในไฟล์ต้นทาง
  name         text not null,                     -- ชื่อบริษัท/หน่วยงาน
  org          text,                              -- ประเภทกิจการ
  interest     text,                              -- สนใจสินค้า/บริการอะไร
  contact      text,                              -- ผู้ติดต่อ + เบอร์ + อีเมล
  result       text,                              -- ผลการติดตาม

  -- ★ ลูกค้าที่ควรตามก่อน (ระบุความสนใจชัด / มีผู้ดูแลแล้ว)
  is_prospect  boolean not null default false,

  sale_name    text,                              -- ใครรับไปดูแล
  team_id      uuid references teams(id) on delete set null,

  status       text not null default 'new'
               check (status in ('new', 'working', 'converted', 'dropped')),

  -- ยกขึ้นเป็นงานแล้วโยงกลับ จะได้ไม่ยกซ้ำ
  pending_id   uuid references pending_projects(id) on delete set null,

  is_active    boolean not null default true,
  archived_at  timestamptz,

  created_by   uuid references profiles(id) on delete set null,
  updated_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_expo_prospect on expo_customers(is_prospect desc, name);
create index if not exists idx_expo_status   on expo_customers(status);
create index if not exists idx_expo_event    on expo_customers(event_name);

-- ══════════════════════════════════════════════════════════
-- 3) Trigger updated_at
-- ══════════════════════════════════════════════════════════

drop trigger if exists trg_lead_sources_updated on lead_sources;
drop trigger if exists trg_expo_updated         on expo_customers;

create trigger trg_lead_sources_updated before update on lead_sources
  for each row execute function set_updated_at();
create trigger trg_expo_updated         before update on expo_customers
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════
-- 4) RLS
-- ══════════════════════════════════════════════════════════

alter table lead_sources   enable row level security;
alter table expo_customers enable row level security;

drop policy if exists ls_select on lead_sources;
drop policy if exists ls_write  on lead_sources;
drop policy if exists ex_select on expo_customers;
drop policy if exists ex_insert on expo_customers;
drop policy if exists ex_update on expo_customers;
drop policy if exists ex_delete on expo_customers;

-- ── lead_sources ── ทุกคนอ่านได้ · แก้ได้เฉพาะ admin/หัวหน้า
-- (ลิงก์เป็นของกลางของทีม ปล่อยให้ sale ทุกคนแก้แล้วจะเละ)
create policy ls_select on lead_sources
  for select to authenticated
  using (true);

create policy ls_write on lead_sources
  for all to authenticated
  using (is_reviewer())
  with check (is_reviewer());

-- ── expo_customers ── กองลีดกลาง ทุกคนที่ล็อกอินเห็นและช่วยกันอัปเดตได้
-- (เหตุผลเต็มอยู่ที่หัวตารางข้อ 2)
create policy ex_select on expo_customers
  for select to authenticated
  using (true);

create policy ex_insert on expo_customers
  for insert to authenticated
  with check (true);

create policy ex_update on expo_customers
  for update to authenticated
  using (true)
  with check (true);

-- ลบถาวร = admin เท่านั้น (กติกาเดียวกับทุกตาราง — ระบบทำแค่ backup ไม่มี rollback)
create policy ex_delete on expo_customers
  for delete to authenticated
  using (is_admin());

-- ══════════════════════════════════════════════════════════
-- 5) GRANT
-- ══════════════════════════════════════════════════════════

grant select, insert, update, delete on lead_sources, expo_customers to authenticated;
revoke all on lead_sources, expo_customers from anon;

-- ══════════════════════════════════════════════════════════
-- 6) Seed — 8 เส้นทางหางาน
--
-- ⚠️ ในนี้มีแต่ลิงก์สาธารณะ (เว็บราชการ/สมาคม) กับวิธีทำงาน
--    ไม่มีชื่อ/เบอร์/อีเมลลูกค้าแม้แต่รายเดียว — repo นี้เป็น public
--
-- 🔴 ลิงก์ Google Sheet รายชื่อลูกค้า Thai Water 90 ราย "จงใจไม่ใส่" ไว้ที่นี่
--    URL ของ Sheet คือกุญแจเข้าถึงข้อมูลลูกค้าจริง ถ้าชีตตั้งเป็น "ใครมีลิงก์ก็เปิดได้"
--    การ commit URL ลง public repo = ปล่อยข้อมูลลูกค้าทั้ง 90 รายออกไป
--    → เจ้าของโปรเจกต์เพิ่มลิงก์เองจากหน้าจอ (ลิงก์แก้ได้อยู่แล้ว) ข้อมูลจะอยู่แค่ใน DB
--
-- on conflict do nothing — รันซ้ำต้องไม่ทับลิงก์ที่เจ้าของแก้ไว้แล้ว
-- ══════════════════════════════════════════════════════════

insert into lead_sources (code, icon, name, descr, cadence, sort_order, links, subs) values

('gproc', '🏛️', 'ประมูลงานราชการ — G-Procurement / G-LEAD lightwork',
 'เฝ้าประกาศจัดซื้อจัดจ้าง e-bidding จากบัญชีสมาชิกที่สมัครไว้ คัดงานประปา/บำบัดน้ำเสีย/สุขาภิบาล',
 'ตรวจทุกวันทำการ (เช้า)', 10,
 '[{"label":"ระบบ e-GP กรมบัญชีกลาง","url":"https://www.gprocurement.go.th"},
   {"label":"ค้นหาประกาศจัดซื้อจัดจ้าง","url":"https://process3.gprocurement.go.th"},
   {"label":"G-LEAD Lightwork","url":"https://lightworkai.com"},
   {"label":"เข้าสู่ระบบ G-LEAD","url":"https://glead.lightworkai.com/login"}]'::jsonb,
 '[]'::jsonb),

('dc', '🖥️', 'Data Center',
 'ติดตามโครงการก่อสร้าง/ขยาย Data Center ที่ต้องการระบบน้ำ ระบบสุขาภิบาล และบำบัดน้ำเสีย',
 'ตรวจรายสัปดาห์', 20,
 '[{"label":"DataCenterDynamics APAC","url":"https://www.datacenterdynamics.com/en/asia-pacific/"},
   {"label":"BOI ข่าวการลงทุน","url":"https://www.boi.go.th"}]'::jsonb,
 '[]'::jsonb),

('nesdc', '💧', 'พื้นที่ขาดแคลนน้ำ — สภาพัฒน์ / กชช.2ค',
 'หมู่บ้าน-ตำบลที่ขาดแคลนน้ำประปาจากข้อมูล กชช.2ค → โอกาสระบบผลิตประปาบาดาลด้วยไฟฟ้า DOS TECHNOTRONIC ขนาด 4–26 ลบ.ม./ชม.',
 'ทบทวนรายเดือน + จับคู่กับงบท้องถิ่น', 30,
 '[{"label":"สภาพัฒน์ (สศช.)","url":"https://www.nesdc.go.th"},
   {"label":"ข้อมูล จปฐ./กชช.2ค (กรมการพัฒนาชุมชน)","url":"https://rdic.cdd.go.th/bmn-service"}]'::jsonb,
 '[]'::jsonb),

('dwr', '📋', 'งบประมาณ กรมทรัพยากรน้ำ / กรมทรัพยากรน้ำบาดาล',
 'ติดตามแผนงบประมาณและโครงการจัดสรรของ ทน. และ ทบ. เพื่อเข้าเสนอก่อนตั้งงบ/ก่อนประกาศ',
 'ทบทวนรายเดือน (รอบงบ 2570 ด้วย)', 40,
 '[{"label":"กรมทรัพยากรน้ำ","url":"https://www.dwr.go.th"},
   {"label":"กรมทรัพยากรน้ำบาดาล","url":"https://www.dgr.go.th"},
   {"label":"สำนักงบประมาณ","url":"https://www.bb.go.th"}]'::jsonb,
 '[]'::jsonb),

('designer', '📐', 'ผู้ออกแบบ / ที่ปรึกษา งานอาคาร-ประปา-บำบัดน้ำเสีย',
 'สร้างสัมพันธ์กับผู้ออกแบบและบริษัทที่ปรึกษา ให้ระบุ (spec-in) สินค้า DOS ในแบบตั้งแต่ต้นทาง',
 'เยี่ยม/ติดตามรายสัปดาห์', 50,
 '[{"label":"สมาคมสถาปนิกสยาม (ASA)","url":"https://asa.or.th"},
   {"label":"วิศวกรรมสถานฯ (วสท.)","url":"https://eit.or.th"}]'::jsonb,
 '[]'::jsonb),

('kidney', '🏥', 'มูลนิธิโรคไต / ศูนย์ไตเทียม',
 'ติดตามศูนย์ฟอกไตเปิดใหม่-ขยาย เสนอระบบบำบัดน้ำเสียฟอกไตด้วยไฟฟ้า DOS ECOTRONIC',
 'ติดตามรายสัปดาห์', 60,
 '[{"label":"มูลนิธิโรคไตแห่งประเทศไทย","url":"https://www.kidneythai.org"},
   {"label":"สมาคมโรคไตแห่งประเทศไทย","url":"https://www.nephrothai.org"}]'::jsonb,
 '[]'::jsonb),

('thaiwater', '🌊', 'ลูกค้าจากงาน Thai Water Expo 2026',
 'ติดตามลูกค้าจากบูธงาน Thai Water 2026 — เน้นกลุ่ม Prospect (มีผู้ดูแล/ระบุความสนใจชัด) ให้ติดต่อกลับก่อน · รายชื่ออยู่ในแถบ "Thai Water Expo"',
 'ติดตามต่อเนื่องภายใน 2 สัปดาห์หลังงาน แล้วรีวิวรายสัปดาห์', 70,
 '[{"label":"เว็บงาน Thai Water Expo","url":"https://www.thai-water.com"}]'::jsonb,
 '[]'::jsonb),

('other', '🤝', 'ลูกค้าแหล่งอื่น ๆ',
 'งานที่เข้ามาทางอื่น เช่น ลูกค้าแนะนำ โทรเข้าบริษัท หรือ agent/ทีมขายหามาให้ — ระบุที่มาย่อยได้ตอนเพิ่มงาน',
 'บันทึกทันทีที่มีการติดต่อเข้ามา', 80,
 '[]'::jsonb,
 '["ลูกค้าแนะนำ (referral)","โทรเข้าบริษัท","Agent / ทีมขายหามาให้"]'::jsonb)

on conflict (code) do nothing;

-- ══════════════════════════════════════════════════════════
-- 7) ตรวจผลหลังรัน
-- ══════════════════════════════════════════════════════════

select 'ตาราง 2 ตารางใหม่' as check_item,
       count(*)::text as result, '2 expected' as note
from pg_tables where schemaname = 'public' and tablename in ('lead_sources', 'expo_customers')

union all
select 'RLS เปิดครบ', count(*)::text, '2 expected'
from pg_tables where schemaname = 'public'
  and tablename in ('lead_sources', 'expo_customers') and rowsecurity = true

union all
select 'policy รวม', count(*)::text, '6 expected'
from pg_policies where schemaname = 'public' and tablename in ('lead_sources', 'expo_customers')

union all
select 'แหล่งงานที่ตั้งต้นให้', count(*)::text, '8 expected'
from lead_sources

union all
-- 16 ไม่ใช่ 17 — ต้นแบบมี 17 แต่ตัดลิงก์ Google Sheet ข้อมูลลูกค้าออก (ดูเหตุผลข้อ 6)
select 'ลิงก์รวมทุกแหล่ง', sum(jsonb_array_length(links))::text, '16 expected'
from lead_sources

union all
select 'anon แตะ 2 ตารางใหม่ได้', count(distinct table_name)::text, '0 expected'
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and table_name in ('lead_sources', 'expo_customers');
