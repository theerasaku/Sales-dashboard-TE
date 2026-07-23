-- TE Sales Dashboard — step 3.5
-- B9 · AI Intake staging — intake_items (พักข้อมูลก่อนเข้าตารางจริง)
--
-- ⚠️ ห้ามใส่ข้อมูลลูกค้าจริงในไฟล์นี้เด็ดขาด — repo เป็น public
--
-- วิธีรัน: Supabase → SQL Editor → วางทั้งไฟล์ → Run · รันซ้ำได้ทั้งไฟล์ (idempotent)
-- ต้องรัน schema.sql · policies.sql · phase2.sql · phase2-4.sql · phase3-9.sql · phase3-10.sql มาก่อน
--   (ใช้ teams, profiles, is_admin(), can_access_team(), can_edit_team(), set_updated_at())
--
-- ══════════════════════════════════════════════════════════
-- ทำไมต้องมีตาราง staging แยก — ไม่เขียนเข้าตารางจริงตรง ๆ
--
--   ถ่ายรูปนามบัตร/ฟอร์มหน้างานด้วยมือถือ → แต่มานั่งตรวจแก้บนคอมที่ออฟฟิศ
--   ถ้าเก็บใน browser state ข้อมูลไม่ข้ามเครื่อง · และไม่มีหลักฐานว่า
--   "ใครอนุมัติอะไร มาจากเอกสารไหน" → ตาราง intake_items เก็บทั้ง 3 อย่าง:
--     parsed     = สิ่งที่ AI แกะได้ (ต้นฉบับ ไม่แก้ทับ — ไว้สอบย้อนได้ว่า AI อ่านว่าอะไร)
--     edited     = สิ่งที่คนแก้ก่อนอนุมัติ (null = ไม่ได้แก้ ใช้ parsed ตรง ๆ)
--     confidence = ความมั่นใจรายช่อง {field: 0..1} → ไฮไลต์เหลืองเฉพาะช่องที่ AI ไม่มั่นใจ
--                  ไม่ให้คนไล่อ่านทั้งฟอร์ม 37 ช่อง
--
--   ⭐ ตารางนี้เป็น "ล็อกการนำเข้า" ในตัว: แถวที่ status='merged' + target_id + approved_by
--      คือหลักฐานว่านำเข้าอะไร เข้าแถวไหน ใครอนุมัติ (กติกา "log ทุกการนำเข้า")
-- ══════════════════════════════════════════════════════════

create table if not exists intake_items (
  id           uuid primary key default gen_random_uuid(),

  -- แหล่งที่มาของข้อมูล (namecard→Book3 · form→Pending · obsidian/notion/manual→ทั้งสอง)
  source       text not null default 'manual'
               check (source in ('namecard', 'form', 'obsidian', 'notion', 'manual')),

  -- ปลายทางที่จะบันทึกเข้า — ตัดสินว่า merge เข้าตารางไหน
  target_type  text not null
               check (target_type in ('customer', 'pending')),

  raw_input    text,                                  -- ข้อความ/บริบทดิบที่วางเข้ามา (เผื่อสอบย้อน)
  parsed       jsonb not null default '{}'::jsonb,    -- ที่ AI แกะได้ (ต้นฉบับ ไม่แก้ทับ)
  edited       jsonb,                                 -- ที่คนแก้ก่อนอนุมัติ (null = ใช้ parsed)
  confidence   jsonb not null default '{}'::jsonb,    -- {field: 0..1} ต่ำ = ไฮไลต์เหลือง

  -- draft = ยังไม่ตรวจ · approved = ตรวจแล้วแต่ยังไม่เขียนเข้าตารางจริง (เผื่อทำเป็นขั้น)
  -- merged = เขียนเข้าตารางจริงแล้ว · rejected = ทิ้ง ไม่เอาเข้าระบบ
  status       text not null default 'draft'
               check (status in ('draft', 'approved', 'merged', 'rejected')),

  -- ตารางจริง + แถวที่ merge เข้า (ว่างจนกว่าจะอนุมัติ)
  target_table text check (target_table in ('pending_projects', 'customers')),
  target_id    uuid,
  merge_mode   text check (merge_mode in ('new', 'update')),  -- สร้างใหม่ หรือ ทับของเดิม

  note         text,

  -- team_id = ตัวที่ RLS ใช้ (เหมือนทุกตาราง) · adapter เติมทีมของผู้ใช้ให้ผ่าน fillTeam()
  -- ⚠️ ว่าง = ทุกคนที่ไม่ใช่ admin แตะไม่ได้ (can_access_team(null) = false)
  team_id      uuid references teams(id) on delete set null,

  created_by   uuid references profiles(id) on delete set null default auth.uid(),
  approved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_intake_status  on intake_items(status);
create index if not exists idx_intake_target  on intake_items(target_type, status);
create index if not exists idx_intake_team     on intake_items(team_id);
create index if not exists idx_intake_creator on intake_items(created_by);
create index if not exists idx_intake_created on intake_items(created_at desc);

-- updated_at อัตโนมัติ (ตัวเดียวกับตารางอื่น)
drop trigger if exists trg_intake_updated on intake_items;
create trigger trg_intake_updated before update on intake_items
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════
-- RLS
--   อ่าน:  ใครเห็นทีมได้ก็เห็น draft ของทีมนั้น (can_access_team ตัวกลาง)
--   เขียน: ต้องแก้ทีมนั้นได้ (can_edit_team) — sale แก้ได้เฉพาะทีมตัวเอง
--
--   ต่างจาก signoffs (append-only): intake_items เป็นกระดาษทดชั่วคราว
--   ลบ/แก้ draft ของทีมตัวเองได้ตามปกติ ไม่ใช่หลักฐานที่ห้ามแตะ
--   (หลักฐานตัวจริงคือแถว status='merged' ที่โยงไป target_id แล้ว — ยังลบได้แต่ต้องมีสิทธิ์แก้ทีม)
-- ══════════════════════════════════════════════════════════

alter table intake_items enable row level security;

drop policy if exists intake_select on intake_items;
create policy intake_select on intake_items
  for select to authenticated
  using (can_access_team(team_id));

drop policy if exists intake_insert on intake_items;
create policy intake_insert on intake_items
  for insert to authenticated
  with check (can_edit_team(team_id));

drop policy if exists intake_update on intake_items;
create policy intake_update on intake_items
  for update to authenticated
  using (can_edit_team(team_id))
  with check (can_edit_team(team_id));

drop policy if exists intake_delete on intake_items;
create policy intake_delete on intake_items
  for delete to authenticated
  using (can_edit_team(team_id));

grant select, insert, update, delete on intake_items to authenticated;
revoke all on intake_items from anon;

-- ══════════════════════════════════════════════════════════
-- ตรวจผลหลังรัน — ควรได้ตามคอลัมน์ note ทุกบรรทัด
-- ══════════════════════════════════════════════════════════

select 'ตาราง intake_items' as check_item,
       count(*)::text as result, '1 expected' as note
from pg_tables where schemaname = 'public' and tablename = 'intake_items'

union all
select 'RLS เปิดแล้ว',
       case when bool_or(rowsecurity) then 'ใช่' else 'ไม่ใช่ ✗' end, 'ใช่ expected'
from pg_tables where schemaname = 'public' and tablename = 'intake_items'

union all
select 'policy ทั้งหมด (select/insert/update/delete)',
       count(*)::text, '4 expected'
from pg_policies where schemaname = 'public' and tablename = 'intake_items'

union all
select 'policy เขียนใช้ can_edit_team',
       count(*)::text, '3 expected (insert/update/delete)'
from pg_policies
where schemaname = 'public' and tablename = 'intake_items'
  and (with_check ilike '%can_edit_team%' or qual ilike '%can_edit_team%')
  and cmd in ('INSERT', 'UPDATE', 'DELETE')

union all
select 'anon แตะ intake_items ได้',
       count(distinct table_name)::text, '0 expected'
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and table_name = 'intake_items';
