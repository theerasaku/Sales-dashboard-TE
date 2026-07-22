-- TE Sales Dashboard — Phase 2 schema (step 2.1)
-- ขอบเขต: B3 Book 3 สี (customers + customer_logs) · B4 Activities
--
-- ⚠️ ไฟล์นี้ "รันเพิ่ม" ไม่ต้องรัน schema.sql / policies.sql ซ้ำ
--    (ของเดิมทำงานอยู่แล้ว รันซ้ำโดยไม่จำเป็นมีแต่ความเสี่ยง)
--
-- วิธีรัน: Supabase → SQL Editor → วางทั้งไฟล์ → Run
-- รันซ้ำได้ (idempotent) ทุกจุดใช้ IF NOT EXISTS / drop policy if exists
--
-- ต้องรัน schema.sql + policies.sql ของ Phase 1 มาก่อน เพราะไฟล์นี้ใช้:
--   teams, profiles, pending_projects, is_admin(), can_access_team(), set_updated_at()

-- ══════════════════════════════════════════════════════════
-- B3 · Book 3 สี (ลูกค้ารายบุคคล)
--
-- ที่มาของฟิลด์: ฟอร์มกระดาษ "BOOK 3 สี" 2 หน้า (ดู plan/form-book3-si-fields.md)
-- ══════════════════════════════════════════════════════════

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),

  -- ── หน้า 1: ข้อมูลลูกค้า ──
  no            text,                              -- No. รหัสในสมุด
  name          text not null,                     -- NAME / SURNAME (ฟอร์มแยก · เก็บรวมช่องเดียว)
  position      text,                              -- POSITION
  org           text,                              -- หน่วยงาน/บริษัท (ฟอร์มกระดาษไม่มีช่องนี้ แต่จำเป็น)
  birthday      date,                              -- BIRTHDAY (AGE คำนวณเอา ไม่เก็บ)
  tel           text,                              -- CONTACT (TELEPHONE)
  email         text,                              -- CONTACT (EMAIL)

  addr_office   text,                              -- ADDRESS (OFFICE)
  addr_home     text,                              -- ADDRESS (HOME)
  addr_hometown text,                              -- ADDRESS (HOMETOWN) ภูมิลำเนา

  education     text,                              -- EDUCATION 1–3 (ฟอร์ม 3 บรรทัด → text หลายบรรทัด)
  family        text,                              -- FAMILY: คู่สมรส / บุตร / อื่น ๆ + POSITION ของแต่ละคน
  hobby         text,                              -- HOBBY
  favorite      text,                              -- FAVORITE
  photo_url     text,                              -- กรอบรูปมุมขวาบนของฟอร์ม

  -- ── สี 3 ระดับ (หัวใจของ "Book 3 สี") ──
  -- ตั้งชื่อว่า color ไม่ใช่ status เพราะ status ในระบบนี้หมายถึง active/archive อยู่แล้ว
  -- ถ้าใช้ชื่อซ้ำกันจะสับสนทั้งใน adapter และตอนอ่าน query ทีหลัง
  -- ⚠️ prototype v3 ใช้ 'g'/'y'/'r' → ตอน import ต้อง map เป็นคำเต็ม
  --    green  = สนิท / ซื้อประจำ
  --    yellow = ซื้อบ้าง / มีโอกาส
  --    red    = เพิ่งเริ่มติดต่อ / โอกาสน้อย
  color         text not null default 'red'
                check (color in ('green', 'yellow', 'red')),

  -- ── ผู้รับผิดชอบ ──
  -- team_id คือตัวที่ RLS ใช้ตัดสินสิทธิ์ (เหมือน pending_projects)
  -- sale_id บอกว่า "คนไหน" ดูแล — ว่างได้ ถ้ายังไม่ระบุตัวบุคคล
  team_id       uuid references teams(id) on delete set null,
  sale_id       uuid references profiles(id) on delete set null,
  sale_name     text,                              -- ชื่อ sale จากข้อมูลเก่าที่ยังจับคู่บัญชีไม่ได้

  -- ── archive (เตรียมไว้ให้ step 2.5 ไม่ต้อง migration) ──
  is_active     boolean not null default true,
  archived_at   timestamptz,

  -- ── audit (Security ข้อ 5) ──
  created_by    uuid references profiles(id) on delete set null,
  updated_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_cust_team   on customers(team_id);
create index if not exists idx_cust_sale   on customers(sale_id);
create index if not exists idx_cust_color  on customers(color);
create index if not exists idx_cust_active on customers(is_active);
-- ใช้จับคู่กันซ้ำตอน import / AI Intake (นามบัตร) — เบอร์โทรกับชื่อคือกุญแจหลัก
create index if not exists idx_cust_tel    on customers(tel) where tel is not null;
create index if not exists idx_cust_name   on customers(name);

-- ── บันทึกการติดตามลูกค้า (โครงเดียวกับ follow_logs ของ B2) ──
create table if not exists customer_logs (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  log_date    date not null default current_date,   -- DATE
  by_name     text,                                 -- BY
  response    text,                                 -- RESPONSE
  next_doing  text,                                 -- NEXT DOING
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_clog_customer on customer_logs(customer_id, log_date desc);

-- ══════════════════════════════════════════════════════════
-- B4 · Activities (แผนติดต่อลูกค้ารายสัปดาห์)
-- ══════════════════════════════════════════════════════════

create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),

  title       text not null,                        -- สิ่งที่จะทำ
  detail      text,
  act_type    text,                                 -- เข้าพบ / โทร / ส่งใบเสนอราคา / นำเสนอ ฯลฯ

  due_date    date,                                 -- กำหนดทำภายใน
  done_at     timestamptz,                          -- ทำเสร็จเมื่อไหร่

  status      text not null default 'plan'
              check (status in ('plan', 'done', 'cancel')),

  -- ผูกกับงานหรือลูกค้า (จะผูกอันไหนก็ได้ หรือไม่ผูกเลยก็ได้)
  pending_id  uuid references pending_projects(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,

  team_id     uuid references teams(id) on delete set null,   -- ตัวที่ RLS ใช้
  owner_id    uuid references profiles(id) on delete set null,

  is_active   boolean not null default true,
  archived_at timestamptz,

  created_by  uuid references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_act_team   on activities(team_id);
create index if not exists idx_act_owner  on activities(owner_id);
create index if not exists idx_act_status on activities(status);
-- ใช้หา "งานค้าง/เลยกำหนด" บน dashboard — index เฉพาะที่ยังไม่เสร็จ ประหยัดกว่า index ทั้งตาราง
create index if not exists idx_act_due    on activities(due_date)
       where status = 'plan' and due_date is not null;
create index if not exists idx_act_pending  on activities(pending_id)  where pending_id  is not null;
create index if not exists idx_act_customer on activities(customer_id) where customer_id is not null;

-- ══════════════════════════════════════════════════════════
-- Trigger updated_at (ใช้ฟังก์ชัน set_updated_at() จาก schema.sql)
-- ══════════════════════════════════════════════════════════

drop trigger if exists trg_customers_updated     on customers;
drop trigger if exists trg_customer_logs_updated on customer_logs;
drop trigger if exists trg_activities_updated    on activities;

create trigger trg_customers_updated     before update on customers
  for each row execute function set_updated_at();
create trigger trg_customer_logs_updated before update on customer_logs
  for each row execute function set_updated_at();
create trigger trg_activities_updated    before update on activities
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════
-- RLS — ใช้กติกาเดียวกับ Phase 1
--   admin เห็นหมด · sale เห็นเฉพาะทีมตัวเอง
--   ทุกตารางเรียกผ่าน can_access_team() ตัวเดียวกัน
--   → ตอน step 2.4 เพิ่ม role manager แก้แค่ฟังก์ชันเดียว ทั้งระบบตามหมด
-- ══════════════════════════════════════════════════════════

alter table customers     enable row level security;
alter table customer_logs enable row level security;
alter table activities    enable row level security;

drop policy if exists cust_select on customers;
drop policy if exists cust_insert on customers;
drop policy if exists cust_update on customers;
drop policy if exists cust_delete on customers;
drop policy if exists clog_select on customer_logs;
drop policy if exists clog_insert on customer_logs;
drop policy if exists clog_update on customer_logs;
drop policy if exists clog_delete on customer_logs;
drop policy if exists act_select  on activities;
drop policy if exists act_insert  on activities;
drop policy if exists act_update  on activities;
drop policy if exists act_delete  on activities;

-- ── customers ──
create policy cust_select on customers
  for select to authenticated
  using (can_access_team(team_id));

create policy cust_insert on customers
  for insert to authenticated
  with check (can_access_team(team_id));

create policy cust_update on customers
  for update to authenticated
  using (can_access_team(team_id))
  with check (can_access_team(team_id));   -- กันย้ายลูกค้าไปทีมที่ตัวเองไม่มีสิทธิ์

-- ⚠️ ลบถาวร = admin เท่านั้น (กติกาเดียวกับ pending_projects)
--    ระบบทำแค่ backup ไม่มี rollback รายแถว → sale ให้ใช้ archive (is_active = false) แทน
create policy cust_delete on customers
  for delete to authenticated
  using (is_admin());

-- ── customer_logs ── สิทธิ์ตามลูกค้าเจ้าของบันทึก
create policy clog_select on customer_logs
  for select to authenticated
  using (exists (
    select 1 from customers c
    where c.id = customer_logs.customer_id and can_access_team(c.team_id)
  ));

create policy clog_insert on customer_logs
  for insert to authenticated
  with check (exists (
    select 1 from customers c
    where c.id = customer_logs.customer_id and can_access_team(c.team_id)
  ));

-- แก้/ลบบันทึก: คนเขียนเอง หรือ admin (กันคนอื่นมาลบประวัติของเรา)
create policy clog_update on customer_logs
  for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- TODO step 2.6: เมื่อหัวหน้าเซ็นรับทราบแล้ว ต้องล็อกไม่ให้ลบบันทึกย้อนหลัง
create policy clog_delete on customer_logs
  for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- ── activities ──
create policy act_select on activities
  for select to authenticated
  using (can_access_team(team_id));

create policy act_insert on activities
  for insert to authenticated
  with check (can_access_team(team_id));

create policy act_update on activities
  for update to authenticated
  using (can_access_team(team_id))
  with check (can_access_team(team_id));

create policy act_delete on activities
  for delete to authenticated
  using (is_admin());

-- ══════════════════════════════════════════════════════════
-- GRANT — คนละชั้นกับ RLS ต้องมีครบทั้งคู่
--   GRANT = "แตะตารางนี้ได้ไหม"   (ไม่มี → error 42501)
--   RLS   = "แตะได้แล้วเห็นแถวไหน"
--
-- ⚠️ project นี้ไม่ GRANT ให้ authenticated อัตโนมัติ (เจอมาแล้วตอน Phase 1)
--    ถ้าไม่มีบล็อกนี้ ล็อกอินสำเร็จแล้วก็ยังอ่านข้อมูลไม่ได้
-- ══════════════════════════════════════════════════════════

grant select, insert, update, delete
  on customers, customer_logs, activities
  to authenticated;

revoke all on customers, customer_logs, activities from anon;

-- ══════════════════════════════════════════════════════════
-- ตรวจผลหลังรัน — ควรได้ 3 ตาราง · RLS เปิดครบ · policy 12 · anon แตะไม่ได้
-- ══════════════════════════════════════════════════════════

select 'tables' as check_item,
       count(*)::text as result,
       '3 expected' as note
from pg_tables
where schemaname = 'public'
  and tablename in ('customers', 'customer_logs', 'activities')

union all
select 'rls enabled',
       count(*)::text,
       '3 expected'
from pg_tables
where schemaname = 'public'
  and tablename in ('customers', 'customer_logs', 'activities')
  and rowsecurity = true

union all
select 'policies',
       count(*)::text,
       '12 expected'
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'customer_logs', 'activities')

union all
select 'anon can touch',
       count(distinct table_name)::text,
       '0 expected'
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in ('customers', 'customer_logs', 'activities');
