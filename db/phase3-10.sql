-- TE Sales Dashboard — step 3.10 (ช่วง A)
-- โครงสร้างทีมตาม org chart + สิทธิ์ตามลำดับชั้น + ปิดช่องโหว่ can_edit
--
-- ⚠️ ห้ามใส่ข้อมูลลูกค้าจริงในไฟล์นี้เด็ดขาด — repo เป็น public
--
-- เจ้าของเคาะ 23 ก.ค. 2569:
--   • IMP1/IMP2 เป็นทีมจริง · TE-IMP เป็น "กลุ่มแม่" ครอบไว้
--   • ให้สิทธิ์ทีมแม่ = เห็นทีมลูกทั้งหมดอัตโนมัติ (หัวหน้าแผนกอื่น/นันทวันเห็น IMP ได้)
--   • เป้าตั้งระดับทีม/ทีมย่อย (ไม่ต้องรายคน) — ตาราง team_targets เตรียมไว้ให้ช่วง B
--
-- ต้องรัน schema.sql · policies.sql · phase2.sql · phase2-4.sql · phase3-9.sql มาก่อน
-- วิธีรัน: Supabase → SQL Editor → วางทั้งไฟล์ → Run · รันซ้ำได้ทั้งไฟล์

-- ══════════════════════════════════════════════════════════
-- 1) ทีมมีลำดับชั้น + ตำแหน่งใน profiles
-- ══════════════════════════════════════════════════════════

-- ทีมอ้างทีมแม่ของตัวเอง (self-reference) — null = ทีมระดับบนสุด
-- on delete set null: ลบทีมแม่แล้วทีมลูกไม่หาย แค่กลายเป็นทีมบนสุด
alter table teams add column if not exists parent_team_id uuid references teams(id) on delete set null;

-- ตำแหน่งตาม org chart (ผู้จัดการส่วนขาย IMP1 / Senior Sale Engineer / Technical Advisor …)
-- เก็บเป็นข้อความอิสระ — ใช้แสดงบนหน้าทีมขาย ไม่เอาไปตัดสินสิทธิ์
alter table profiles add column if not exists title text;

-- ══════════════════════════════════════════════════════════
-- 2) ทีมย่อยของแผนก IMP
--
-- TE-IMP เดิมกลายเป็น "กลุ่มแม่" (parent_team_id ยังเป็น null = อยู่ระดับบนสุด)
-- งานใหม่ของ IMP ให้ผูกกับ IMP1 หรือ IMP2 (ทีมใบ) ไม่ใช่ TE-IMP โดยตรง
--
-- on conflict do update — รันซ้ำแล้วอัปเดตชื่อ/ทีมแม่ได้ ไม่สร้างซ้ำ
-- ══════════════════════════════════════════════════════════

insert into teams (code, name, description, sort_order, parent_team_id) values
  ('IMP1', 'TE IMP · ทีม 1', 'ทีมย่อย IMP กลุ่มที่ 1 (ผู้จัดการส่วน IMP1)', 41,
     (select id from teams where code = 'TE-IMP')),
  ('IMP2', 'TE IMP · ทีม 2', 'ทีมย่อย IMP กลุ่มที่ 2 (ผู้จัดการส่วน IMP2)', 42,
     (select id from teams where code = 'TE-IMP'))
on conflict (code) do update
  set name           = excluded.name,
      description    = excluded.description,
      sort_order     = excluded.sort_order,
      parent_team_id = excluded.parent_team_id;

-- ══════════════════════════════════════════════════════════
-- 3) เป้ายอดรายทีม (ใช้จริงในช่วง B — สร้างตารางไว้ก่อน)
--
-- เป้าตั้งที่ "ทีมใบ" (ทีมที่ไม่มีทีมลูก) · ทีมแม่/องค์กร = ผลรวมของทีมใบ
-- period = ช่วงเวลาเป้า (ตอนนี้ใช้ค่าเดียว 'H2-2026' = ครึ่งปีหลัง 2569)
-- ══════════════════════════════════════════════════════════

create table if not exists team_targets (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  period      text not null default 'H2-2026',
  target_baht numeric(15,2) not null default 0 check (target_baht >= 0),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (team_id, period)
);

-- ══════════════════════════════════════════════════════════
-- 4) can_access_team() — เพิ่มการไล่ขึ้นทีมแม่ (VIEW)
--
-- ⭐ นี่คือจุดเดียวที่เปลี่ยน แล้วทั้งระบบตามหมด (ทุกตารางเรียกฟังก์ชันนี้)
--    เห็นทีม T ได้ ถ้า "ทีมที่ได้รับสิทธิ์" (ทีมตัวเอง หรือใน team_access)
--    เป็น T เอง หรือเป็นทีมแม่/ปู่ของ T
--    → ให้สิทธิ์ TE-IMP = เห็น IMP1, IMP2 อัตโนมัติ
--
-- ⚠️ ยังห้าม policy ของ team_access เรียกฟังก์ชันนี้ (จะวนซ้ำไม่รู้จบ)
-- ══════════════════════════════════════════════════════════

create or replace function can_access_team(target_team uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive chain as (
    -- เริ่มที่ตัว target แล้วไล่ขึ้นหาแม่ทีละชั้น (org ลึกแค่ 2 ชั้น เผื่อไว้ 10)
    select target_team as tid, 0 as depth
    union all
    select t.parent_team_id, c.depth + 1
    from teams t
    join chain c on t.id = c.tid
    where t.parent_team_id is not null and c.depth < 10
  )
  select
    is_admin()
    or (target_team is not null and exists (
          select 1 from chain
          where tid = my_team_id()
             or tid in (select team_id from team_access where profile_id = auth.uid())
        ));
$$;

-- ══════════════════════════════════════════════════════════
-- 5) can_edit_team() — สิทธิ์ "แก้" (ไล่ขึ้นทีมแม่เหมือนกัน แต่ต้อง can_edit)
--
-- 🔴 ปิดช่องโหว่ที่ค้างมาตั้งแต่ 2.4:
--    team_access มีคอลัมน์ can_edit แต่ไม่เคยมี policy ไหนใช้เลย
--    → หัวหน้าที่ได้สิทธิ์ "ดู" ทีมอื่น แก้ข้อมูลทีมนั้นได้ด้วย (ติ๊ก can_edit ไปก็ไม่มีผล)
--
-- กติกา: แก้ทีม T ได้ ถ้า
--    • เป็น admin · หรือ
--    • T เป็นทีมตัวเอง (หรือทีมลูกของทีมตัวเอง) — เจ้าของทีมแก้งานทีมตัวเองได้เสมอ · หรือ
--    • มี team_access ที่ can_edit = true ครอบ T อยู่ (T เอง หรือทีมแม่ของ T)
-- ══════════════════════════════════════════════════════════

create or replace function can_edit_team(target_team uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive chain as (
    select target_team as tid, 0 as depth
    union all
    select t.parent_team_id, c.depth + 1
    from teams t
    join chain c on t.id = c.tid
    where t.parent_team_id is not null and c.depth < 10
  )
  select
    is_admin()
    or (target_team is not null and (
          my_team_id() in (select tid from chain)
          or exists (
               select 1 from team_access ta
               where ta.profile_id = auth.uid() and ta.can_edit
                 and ta.team_id in (select tid from chain)
             )
        ));
$$;

-- ══════════════════════════════════════════════════════════
-- 6) เปลี่ยน policy ฝั่ง "เขียน" ให้ใช้ can_edit_team()
--    ฝั่ง "อ่าน" (select) ยังใช้ can_access_team() เหมือนเดิม
--
--    ผลลัพธ์: หัวหน้าแผนกอื่นที่ได้สิทธิ์ดู IMP → เห็นงาน IMP ได้
--             แต่แก้ไม่ได้ ถ้าไม่ได้ติ๊ก can_edit
--    เจ้าของทีมตัวเอง (sale) → แก้งานทีมตัวเองได้เหมือนเดิมทุกประการ
-- ══════════════════════════════════════════════════════════

-- ── pending_projects ──
drop policy if exists pending_insert on pending_projects;
create policy pending_insert on pending_projects
  for insert to authenticated
  with check (can_edit_team(team_id));

drop policy if exists pending_update on pending_projects;
create policy pending_update on pending_projects
  for update to authenticated
  using (can_edit_team(team_id))
  with check (can_edit_team(team_id));

-- ── customers ──
drop policy if exists cust_insert on customers;
create policy cust_insert on customers
  for insert to authenticated
  with check (can_edit_team(team_id));

drop policy if exists cust_update on customers;
create policy cust_update on customers
  for update to authenticated
  using (can_edit_team(team_id))
  with check (can_edit_team(team_id));

-- ── activities ──
drop policy if exists act_insert on activities;
create policy act_insert on activities
  for insert to authenticated
  with check (can_edit_team(team_id));

drop policy if exists act_update on activities;
create policy act_update on activities
  for update to authenticated
  using (can_edit_team(team_id))
  with check (can_edit_team(team_id));

-- ── follow_logs · customer_logs : "เพิ่มบันทึก" = แก้ข้อมูลของงาน → ใช้ can_edit_team ──
drop policy if exists follow_insert on follow_logs;
create policy follow_insert on follow_logs
  for insert to authenticated
  with check (exists (
    select 1 from pending_projects p
    where p.id = follow_logs.pending_id and can_edit_team(p.team_id)
  ));

drop policy if exists clog_insert on customer_logs;
create policy clog_insert on customer_logs
  for insert to authenticated
  with check (exists (
    select 1 from customers c
    where c.id = customer_logs.customer_id and can_edit_team(c.team_id)
  ));

-- ── project_contacts : แยก for-all เดิม เป็น "อ่าน (view)" + "เขียน (edit)" ──
drop policy if exists contacts_all    on project_contacts;
drop policy if exists contacts_select on project_contacts;
drop policy if exists contacts_write  on project_contacts;

create policy contacts_select on project_contacts
  for select to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = project_contacts.pending_id and can_access_team(p.team_id)
  ));

create policy contacts_write on project_contacts
  for all to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = project_contacts.pending_id and can_edit_team(p.team_id)
  ))
  with check (exists (
    select 1 from pending_projects p
    where p.id = project_contacts.pending_id and can_edit_team(p.team_id)
  ));

-- ── pending_products (สร้างที่ phase3-9) : แยกเป็น view + edit เช่นกัน ──
drop policy if exists pproducts_all    on pending_products;
drop policy if exists pproducts_select on pending_products;
drop policy if exists pproducts_write  on pending_products;

create policy pproducts_select on pending_products
  for select to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = pending_products.pending_id and can_access_team(p.team_id)
  ));

create policy pproducts_write on pending_products
  for all to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = pending_products.pending_id and can_edit_team(p.team_id)
  ))
  with check (exists (
    select 1 from pending_projects p
    where p.id = pending_products.pending_id and can_edit_team(p.team_id)
  ));

-- ══════════════════════════════════════════════════════════
-- 7) RLS ของ team_targets
--    อ่าน: ใครเห็นทีมได้ก็เห็นเป้าทีมนั้น · เขียน: admin หรือหัวหน้าที่แก้ทีมนั้นได้
-- ══════════════════════════════════════════════════════════

alter table team_targets enable row level security;

drop policy if exists tt_select on team_targets;
create policy tt_select on team_targets
  for select to authenticated
  using (can_access_team(team_id));

drop policy if exists tt_write on team_targets;
create policy tt_write on team_targets
  for all to authenticated
  using (can_edit_team(team_id))
  with check (can_edit_team(team_id));

grant select, insert, update, delete on team_targets to authenticated;
revoke all on team_targets from anon;

-- ══════════════════════════════════════════════════════════
-- 8) ตรวจผลหลังรัน
-- ══════════════════════════════════════════════════════════

select 'คอลัมน์ parent_team_id' as check_item,
       count(*)::text as result, '1 expected' as note
from information_schema.columns
where table_name = 'teams' and column_name = 'parent_team_id'

union all
select 'คอลัมน์ profiles.title', count(*)::text, '1 expected'
from information_schema.columns
where table_name = 'profiles' and column_name = 'title'

union all
select 'ทีมย่อย IMP (มีทีมแม่)', count(*)::text, '2 expected'
from teams where code in ('IMP1', 'IMP2') and parent_team_id is not null

union all
select 'ตาราง team_targets', count(*)::text, '1 expected'
from pg_tables where schemaname = 'public' and tablename = 'team_targets'

union all
select 'ฟังก์ชัน can_edit_team', count(*)::text, '1 expected'
from pg_proc where proname = 'can_edit_team'

union all
select 'can_access_team ไล่ทีมแม่แล้ว (มี recursive)', count(*)::text, '1 expected'
from pg_proc where proname = 'can_access_team' and prosrc ilike '%recursive%'

union all
select 'policy เขียนใช้ can_edit_team', count(*)::text, '10+ expected'
from pg_policies
where schemaname = 'public' and with_check ilike '%can_edit_team%';
