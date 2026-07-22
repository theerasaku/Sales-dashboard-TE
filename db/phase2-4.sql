-- TE Sales Dashboard — step 2.4
-- role `manager` (หัวหน้างาน) + ตาราง team_access + app_settings (เป้ายอดขาย)
--
-- วิธีรัน: วางทั้งไฟล์ใน Supabase → SQL Editor → Run (รันซ้ำได้ ไม่พัง)
-- ต้องรัน schema.sql · policies.sql · phase2.sql มาก่อนแล้ว
--
-- ══════════════════════════════════════════════════════════
-- แนวคิดสำคัญ: แยก "ทำอะไรได้" ออกจาก "ที่ไหน"
--
--   role        บอกว่าทำอะไรได้   (manager เซ็นรับทราบได้ · sale ไม่ได้)
--   team_access บอกว่าดูทีมไหนได้  (หัวหน้าสายราชการดู GOV.1/3/4 แต่ไม่เห็น TE-IMP)
--
-- ถ้าใช้ role อย่างเดียวจะทำแบบนี้ไม่ได้ ต้องเลือกระหว่าง
-- "เห็นทุกทีม" กับ "เห็นทีมเดียว" ซึ่งไม่ตรงกับของจริง
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- 1) เพิ่ม role 'manager'
--
-- ⚠️ ชื่อ constraint ต้องตรงกับที่ Postgres ตั้งให้ตอน schema.sql
--    (คอลัมน์ role ประกาศ check ไว้ในตัว → ได้ชื่อ profiles_role_check)
--    ใช้ if exists กันพลาดถ้าเคยเปลี่ยนชื่อไปแล้ว
-- ══════════════════════════════════════════════════════════

alter table profiles drop constraint if exists profiles_role_check;

alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'sale'));

-- ══════════════════════════════════════════════════════════
-- 2) team_access — หัวหน้าคนไหนดูทีมไหนได้บ้าง
--
-- ตารางนี้ใช้กับ manager เป็นหลัก แต่ไม่ได้ห้าม sale
-- (เผื่อกรณี sale คนหนึ่งช่วยดูอีกทีมชั่วคราว — ให้สิทธิ์เป็นราย ๆ ได้เลย)
-- ══════════════════════════════════════════════════════════

create table if not exists team_access (
  profile_id uuid not null references profiles(id) on delete cascade,
  team_id    uuid not null references teams(id)    on delete cascade,

  -- false = ดูได้อย่างเดียว · true = แก้ได้ด้วย
  -- ตอนนี้ยังไม่มีที่ไหนอ่านค่านี้ (ทุกอย่างเป็น "ดูได้ = แก้ได้")
  -- เตรียมช่องไว้ให้ step 2.6 ซึ่งหัวหน้าอาจต้องดูอย่างเดียวแล้วเซ็นรับทราบ
  can_edit   boolean not null default true,

  granted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  primary key (profile_id, team_id)
);

create index if not exists idx_team_access_profile on team_access(profile_id);
create index if not exists idx_team_access_team    on team_access(team_id);

-- ══════════════════════════════════════════════════════════
-- 3) can_access_team() — จุดเดียวที่ตัดสินสิทธิ์ของทั้งระบบ
--
-- ⭐ ทั้ง 8 ตารางเรียกฟังก์ชันนี้ตัวเดียวกันหมด
--    เพิ่มเงื่อนไขตรงนี้ครั้งเดียว = ทุกตารางตามหมด ไม่ต้องไล่แก้ policy ทีละอัน
--
-- ⚠️ ต้องเป็น security definer (ของเดิมไม่ใช่)
--    เพราะต้องอ่าน team_access ซึ่งมี RLS ของตัวเองอยู่
--    ถ้าไม่ใส่ การอ่านจะถูก policy ของ team_access กรองอีกชั้น แล้ววนกลับมาไม่รู้จบ
--
-- ⚠️ policy ของ team_access ห้ามเรียก can_access_team() เด็ดขาด (จะวนซ้ำ)
--    ดูข้อ 4 — ใช้ is_admin() กับ profile_id = auth.uid() เท่านั้น
-- ══════════════════════════════════════════════════════════

create or replace function can_access_team(target_team uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    is_admin()
    or (target_team is not null and target_team = my_team_id())
    or (target_team is not null and exists (
          select 1 from team_access ta
          where ta.profile_id = auth.uid()
            and ta.team_id    = target_team
        ));
$$;

-- ══════════════════════════════════════════════════════════
-- 4) RLS ของ team_access
--
-- อ่าน:  ตัวเอง (จะได้รู้ว่าตัวเองดูทีมไหนได้) · admin เห็นหมด
-- เขียน: admin เท่านั้น
--
-- ⭐ ไม่เขียน policy ให้ manager แก้ team_access เลย — RLS default = ปฏิเสธ
--    manager จึงเพิ่มทีมให้ตัวเองไม่ได้ แม้จะยิง REST API ตรงจากมือถือ
--    (บังคับที่ DB ไม่ใช่ที่ JS — กติกาเดียวกับตาราง signoffs ใน step 2.6)
-- ══════════════════════════════════════════════════════════

alter table team_access enable row level security;

drop policy if exists ta_select on team_access;
drop policy if exists ta_write  on team_access;

create policy ta_select on team_access
  for select to authenticated
  using (profile_id = auth.uid() or is_admin());

create policy ta_write on team_access
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ══════════════════════════════════════════════════════════
-- 5) guard_profile_privilege() — กันยกระดับสิทธิ์ตัวเอง (ปรับข้อความให้ครอบคลุม manager)
--
-- ตรรกะเดิมถูกอยู่แล้ว: ใครไม่ใช่ admin ห้ามแก้ role / team_id / is_active
-- manager ก็ไม่ใช่ admin → ตั้งตัวเองเป็น admin ไม่ได้ ✓
--
-- ส่วน "กันแก้ team_access ของตัวเอง" ไม่ต้องใช้ trigger
-- เพราะ policy ta_write ข้างบนปิดตายให้ทุกคนที่ไม่ใช่ admin อยู่แล้ว (เข้มกว่า)
-- ══════════════════════════════════════════════════════════

create or replace function guard_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() เป็น null = มาจาก SQL Editor / service key / migration → ปล่อยผ่าน
  -- (จำเป็น ไม่งั้นตั้ง admin คนแรกไม่ได้เลย — ไก่กับไข่)
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.role      is distinct from old.role
  or new.team_id   is distinct from old.team_id
  or new.is_active is distinct from old.is_active then
    raise exception
      'ไม่มีสิทธิ์แก้ role / ทีม / สถานะบัญชี — ต้องให้ admin แก้ให้เท่านั้น (หัวหน้างานก็แก้เองไม่ได้)';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile
  before update on profiles
  for each row execute function guard_profile_privilege();

-- ══════════════════════════════════════════════════════════
-- 6) app_settings — ค่าตั้งระบบที่แก้ได้จากหน้า Admin (เป้ายอดขาย ฯลฯ)
--
-- เก็บเป็น key/value + jsonb เพื่อให้เพิ่มค่าใหม่ทีหลังได้โดยไม่ต้อง migration
-- (step 3.1 จะเพิ่มแผนรายเดือนลงตารางนี้ ไม่ใช่สร้างตารางใหม่)
-- ══════════════════════════════════════════════════════════

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated on app_settings;
create trigger trg_settings_updated before update on app_settings
  for each row execute function set_updated_at();

alter table app_settings enable row level security;

drop policy if exists settings_select on app_settings;
drop policy if exists settings_write  on app_settings;

-- ทุกคนที่ล็อกอินอ่านได้ (dashboard ต้องใช้เป้าไปคำนวณ) · แก้ได้เฉพาะ admin
create policy settings_select on app_settings
  for select to authenticated
  using (true);

create policy settings_write on app_settings
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ค่าตั้งต้น: เป้า 80 ล้านบาท ก.ค.–ธ.ค. 2569 (ครึ่งปีหลัง ไม่ใช่ทั้งปี)
-- ⚠️ on conflict do nothing — รันไฟล์ซ้ำต้องไม่ทับเป้าที่เจ้าของแก้ไว้แล้ว
insert into app_settings (key, value) values
  ('sales_target', '{"target_mb": 80, "from": "2026-07", "to": "2026-12", "period": "ก.ค.–ธ.ค. 2569"}'::jsonb)
on conflict (key) do nothing;

-- ══════════════════════════════════════════════════════════
-- 7) GRANT — คนละชั้นกับ RLS ต้องมีครบทั้งคู่
-- ══════════════════════════════════════════════════════════

grant select, insert, update, delete on team_access, app_settings to authenticated;
revoke all on team_access, app_settings from anon;

-- ══════════════════════════════════════════════════════════
-- 8) ตรวจผลหลังรัน — ควรได้ตามคอลัมน์ note ทุกบรรทัด
-- ══════════════════════════════════════════════════════════

select 'role manager ใช้ได้' as check_item,
       case when pg_get_constraintdef(oid) like '%manager%' then 'ใช่' else 'ไม่ใช่ ✗' end as result,
       'ใช่ expected' as note
from pg_constraint
where conname = 'profiles_role_check'

union all
select 'ตาราง team_access + app_settings',
       count(*)::text, '2 expected'
from pg_tables
where schemaname = 'public' and tablename in ('team_access', 'app_settings')

union all
select 'RLS เปิดครบ',
       count(*)::text, '2 expected'
from pg_tables
where schemaname = 'public'
  and tablename in ('team_access', 'app_settings')
  and rowsecurity = true

union all
select 'policy ของ 2 ตารางใหม่',
       count(*)::text, '4 expected'
from pg_policies
where schemaname = 'public' and tablename in ('team_access', 'app_settings')

union all
select 'can_access_team อ่าน team_access แล้ว',
       case when prosrc like '%team_access%' then 'ใช่' else 'ไม่ใช่ ✗' end,
       'ใช่ expected'
from pg_proc where proname = 'can_access_team'

union all
select 'can_access_team เป็น security definer',
       case when prosecdef then 'ใช่' else 'ไม่ใช่ ✗' end,
       'ใช่ expected — ไม่งั้นอ่าน team_access ไม่ได้'
from pg_proc where proname = 'can_access_team'

union all
select 'anon แตะ 2 ตารางใหม่ได้',
       count(distinct table_name)::text, '0 expected'
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and table_name in ('team_access', 'app_settings')

union all
select 'เป้ายอดขายตั้งต้น',
       coalesce((select value->>'target_mb' from app_settings where key = 'sales_target'), 'ไม่มี ✗'),
       '80 expected';
