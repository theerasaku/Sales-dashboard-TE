-- TE Sales Dashboard — Row Level Security (step 1.1)
-- ความปลอดภัยจริงของระบบอยู่ที่ไฟล์นี้ frontend ใช้ anon key ที่เปิดเผยได้
-- ใครยิง REST API ตรงก็ทะลุไม่ได้ เพราะ DB บังคับสิทธิ์เอง
--
-- หลักการ:
--   เปิด RLS ทุกตาราง (ไม่มีข้อยกเว้น)
--   admin (เก๋)  → อ่าน/เขียนได้ทั้งหมด
--   sale        → อ่าน/เขียนได้เฉพาะแถวที่ team ตรงกับ profile ตัวเอง
--   ผู้ใช้ที่ is_active = false → เข้าไม่ได้เลย
--   ปิด public signup — เพิ่มผู้ใช้ด้วย invite เท่านั้น
--
-- ⚠️ ต้องปิด signup ที่หน้า Supabase ด้วย (SQL สั่งไม่ได้):
--    Authentication → Providers → Email → ปิด "Enable sign ups"
--    แล้วเชิญผู้ใช้ที่ Authentication → Users → Invite user
--
-- วิธีรัน: รัน schema.sql ให้เสร็จก่อน แล้วค่อยวางไฟล์นี้ใน SQL Editor → Run

-- ══════════════════════════════════════════════════════════
-- ฟังก์ชันช่วยตัดสินสิทธิ์
--
-- ต้องเป็น SECURITY DEFINER เพราะถูกเรียกจาก policy ของตาราง profiles เอง
-- ถ้าไม่ใส่ Postgres จะวน policy ซ้ำไม่รู้จบ (infinite recursion)
-- ══════════════════════════════════════════════════════════

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function my_team_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from profiles
  where id = auth.uid() and is_active;
$$;

-- แถวนี้เข้าถึงได้ไหม: admin ได้หมด · sale ได้เฉพาะทีมตัวเอง
-- team_id ว่าง = งานที่ยังไม่ระบุทีม เห็นได้เฉพาะ admin
create or replace function can_access_team(target_team uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select is_admin() or (target_team is not null and target_team = my_team_id());
$$;

-- ══════════════════════════════════════════════════════════
-- กันยกระดับสิทธิ์ตัวเอง
--
-- RLS ห้ามรายคอลัมน์ไม่ได้ ถ้าปล่อยให้ sale แก้ profile ตัวเองได้
-- เขาจะตั้ง role = 'admin' ให้ตัวเองแล้วเห็นงานทุกทีม
-- trigger นี้บล็อกการแก้ role / team_id / is_active ถ้าคนแก้ไม่ใช่ admin
-- ══════════════════════════════════════════════════════════

create or replace function guard_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;                       -- admin แก้ได้ทุกอย่าง
  end if;

  if new.role      is distinct from old.role
  or new.team_id   is distinct from old.team_id
  or new.is_active is distinct from old.is_active then
    raise exception 'ไม่มีสิทธิ์แก้ role / team / สถานะบัญชี — ต้องให้ admin แก้ให้เท่านั้น';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile on profiles;
create trigger trg_guard_profile
  before update on profiles
  for each row execute function guard_profile_privilege();

-- ══════════════════════════════════════════════════════════
-- เปิด RLS ทุกตาราง
-- ══════════════════════════════════════════════════════════

alter table teams            enable row level security;
alter table profiles         enable row level security;
alter table pending_projects enable row level security;
alter table follow_logs      enable row level security;
alter table project_contacts enable row level security;

-- ลบ policy เดิมก่อน เพื่อให้รันไฟล์นี้ซ้ำได้
drop policy if exists teams_select    on teams;
drop policy if exists teams_write     on teams;
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_delete on profiles;
drop policy if exists pending_select  on pending_projects;
drop policy if exists pending_insert  on pending_projects;
drop policy if exists pending_update  on pending_projects;
drop policy if exists pending_delete  on pending_projects;
drop policy if exists follow_select   on follow_logs;
drop policy if exists follow_insert   on follow_logs;
drop policy if exists follow_update   on follow_logs;
drop policy if exists follow_delete   on follow_logs;
drop policy if exists contacts_all    on project_contacts;

-- ── teams ── ทุกคนที่ล็อกอินอ่านได้ (ต้องใช้แสดงชื่อทีมในดรอปดาวน์) แก้ได้เฉพาะ admin
create policy teams_select on teams
  for select to authenticated
  using (true);

create policy teams_write on teams
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ── profiles ──
-- อ่าน: ตัวเอง · admin เห็นหมด · sale เห็นเพื่อนร่วมทีม (ต้องใช้แสดงชื่อผู้รับผิดชอบ)
create policy profiles_select on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or is_admin()
    or (team_id is not null and team_id = my_team_id())
  );

-- แก้: ตัวเอง (เฉพาะชื่อ — role/team/สถานะถูก trigger บล็อกไว้) · admin แก้ได้หมด
create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- เพิ่ม/ลบผู้ใช้: admin เท่านั้น
-- (ปกติ profile ถูกสร้างอัตโนมัติจาก trigger handle_new_user ตอน admin เชิญบัญชี)
create policy profiles_insert on profiles
  for insert to authenticated
  with check (is_admin());

create policy profiles_delete on profiles
  for delete to authenticated
  using (is_admin());

-- ── pending_projects ── หัวใจของ RLS: sale เห็นเฉพาะงานทีมตัวเอง
create policy pending_select on pending_projects
  for select to authenticated
  using (can_access_team(team_id));

create policy pending_insert on pending_projects
  for insert to authenticated
  with check (can_access_team(team_id));

create policy pending_update on pending_projects
  for update to authenticated
  using (can_access_team(team_id))
  with check (can_access_team(team_id));   -- กันย้ายงานไปทีมที่ตัวเองไม่มีสิทธิ์

create policy pending_delete on pending_projects
  for delete to authenticated
  using (can_access_team(team_id));

-- ── follow_logs ── สิทธิ์ตามงานแม่
create policy follow_select on follow_logs
  for select to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = follow_logs.pending_id and can_access_team(p.team_id)
  ));

create policy follow_insert on follow_logs
  for insert to authenticated
  with check (exists (
    select 1 from pending_projects p
    where p.id = follow_logs.pending_id and can_access_team(p.team_id)
  ));

-- แก้/ลบบันทึกติดตาม: คนเขียนเอง หรือ admin (กันคนอื่นมาลบประวัติของเรา)
create policy follow_update on follow_logs
  for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

create policy follow_delete on follow_logs
  for delete to authenticated
  using (created_by = auth.uid() or is_admin());

-- ── project_contacts ── สิทธิ์ตามงานแม่
create policy contacts_all on project_contacts
  for all to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = project_contacts.pending_id and can_access_team(p.team_id)
  ))
  with check (exists (
    select 1 from pending_projects p
    where p.id = project_contacts.pending_id and can_access_team(p.team_id)
  ));

-- ══════════════════════════════════════════════════════════
-- ปิดประตูฝั่ง role anon
-- ผู้ใช้ที่ยังไม่ล็อกอินต้องไม่เห็นอะไรเลย
-- (ทุก policy ข้างบนผูกกับ role authenticated อยู่แล้ว บรรทัดนี้กันอีกชั้น)
-- ══════════════════════════════════════════════════════════

revoke all on teams, profiles, pending_projects, follow_logs, project_contacts from anon;
