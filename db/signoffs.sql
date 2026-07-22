-- TE Sales Dashboard — step 2.6
-- signoffs — หัวหน้าเซ็นรับทราบการอัปเดตข้อมูล
--
-- วิธีรัน: วางทั้งไฟล์ใน Supabase → SQL Editor → Run (รันซ้ำได้ ไม่พัง)
-- ต้องรัน schema.sql · policies.sql · phase2.sql · phase2-4.sql มาก่อนแล้ว
--
-- ══════════════════════════════════════════════════════════
-- หลักการ: ตารางนี้ "เขียนได้อย่างเดียว" (append-only)
--
--   เซ็นแล้วแก้ไม่ได้ · ลบไม่ได้ · แม้แต่คนที่เซ็นเองหรือ admin ก็ลบไม่ได้
--   เพราะลายเซ็นที่ลบได้ ก็ไม่ต่างอะไรกับไม่มีลายเซ็น
--
-- บังคับ 3 ชั้นซ้อนกัน:
--   1. GRANT ให้แค่ select, insert  (ไม่ให้ update/delete ตั้งแต่ระดับตาราง)
--   2. ไม่เขียน policy สำหรับ update/delete เลย → RLS default = ปฏิเสธ
--   3. trigger เขียน signed_by / signed_at / signed_version ทับค่าที่ client ส่งมาเสมอ
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- 1) ใครเซ็นได้บ้าง
--
-- security definer เพราะถูกเรียกจาก policy ที่อ่าน profiles
-- (เหตุผลเดียวกับ is_admin() ใน policies.sql — กัน RLS วนซ้ำ)
-- ══════════════════════════════════════════════════════════

create or replace function is_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'manager') and is_active
  );
$$;

-- ══════════════════════════════════════════════════════════
-- 2) ตาราง signoffs
--
-- target_table + target_id = ชี้ได้ทั้งงาน Pending และลูกค้า Book 3 สี
-- (ไม่ใช้ FK เพราะชี้ได้ 2 ตาราง — trigger ข้อ 4 ตรวจให้แทนว่าแถวมีอยู่จริง)
-- ══════════════════════════════════════════════════════════

create table if not exists signoffs (
  id             uuid primary key default gen_random_uuid(),

  target_table   text not null
                 check (target_table in ('pending_projects', 'customers')),
  target_id      uuid not null,

  signed_by      uuid not null default auth.uid() references profiles(id),
  signed_at      timestamptz not null default now(),

  -- ⭐ กับดักลายเซ็นค้าง — คอลัมน์นี้คือหัวใจของ step นี้
  --
  -- เก็บ updated_at ของแถวตอนที่เซ็น ถ้าไม่ตรงกับ updated_at ปัจจุบัน
  -- แปลว่ามีคนแก้ข้อมูลหลังหัวหน้าเซ็นไปแล้ว → ต้องนับเป็น "ยังไม่ได้เซ็น"
  --
  -- ถ้าไม่มีคอลัมน์นี้จะเกิดเคสนี้ได้:
  --   จันทร์  หัวหน้าเซ็นรับทราบงานมูลค่า 5 ล้าน
  --   อังคาร  sale แก้เป็น 50 ล้าน
  --   → ลายเซ็นยังอยู่ กลายเป็นหัวหน้ารับรองตัวเลขที่ไม่เคยเห็น
  signed_version timestamptz not null,

  reviewed_note  text
);

create index if not exists idx_signoffs_target on signoffs(target_table, target_id, signed_at desc);
create index if not exists idx_signoffs_by     on signoffs(signed_by);

-- ══════════════════════════════════════════════════════════
-- 3) trigger — DB เป็นคนตัดสินว่าใครเซ็นและเซ็นเวอร์ชันไหน
--
-- ⚠️ ห้ามเชื่อค่าที่ client ส่งมาเด็ดขาด
--    ถ้าปล่อยให้ client ส่ง signed_version เอง หัวหน้า (หรือใครที่ขโมย token ไป)
--    ส่งเวลาอนาคตมา ลายเซ็นจะดู "ยังสด" ตลอดไปแม้ข้อมูลถูกแก้ไปแล้ว
--    → ทั้งกลไกกันลายเซ็นค้างพังทันที
--
--    signed_by ก็เช่นกัน — เขียนทับด้วย auth.uid() เสมอ กันเซ็นแทนคนอื่น
-- ══════════════════════════════════════════════════════════

create or replace function set_signoff_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated timestamptz;
begin
  if new.target_table = 'pending_projects' then
    select updated_at into v_updated from pending_projects where id = new.target_id;
  else
    select updated_at into v_updated from customers where id = new.target_id;
  end if;

  if v_updated is null then
    raise exception 'ไม่พบรายการที่จะเซ็นรับทราบ (อาจถูกลบไปแล้ว)';
  end if;

  new.signed_version := v_updated;              -- เวอร์ชันจริงจาก DB ไม่ใช่จาก client
  new.signed_by      := coalesce(auth.uid(), new.signed_by);
  new.signed_at      := now();
  return new;
end;
$$;

drop trigger if exists trg_signoff_meta on signoffs;
create trigger trg_signoff_meta
  before insert on signoffs
  for each row execute function set_signoff_meta();

-- ══════════════════════════════════════════════════════════
-- 4) RLS
--
-- อ่าน:  ใครเห็นแถวต้นทางได้ ก็เห็นลายเซ็นของแถวนั้น (ใช้ can_access_team() ตัวเดิม)
-- เขียน: ต้องเป็น admin/manager + ต้องเซ็นในนามตัวเอง + ต้องมีสิทธิ์เห็นแถวนั้น
--
-- ⭐ ไม่เขียน policy update / delete เลย — RLS default = ปฏิเสธทุกคน
--    ไม่มีใครลบลายเซ็นได้ แม้แต่คนที่เซ็นเองหรือ admin
-- ══════════════════════════════════════════════════════════

alter table signoffs enable row level security;

drop policy if exists signoff_select on signoffs;
drop policy if exists signoff_insert on signoffs;

create policy signoff_select on signoffs
  for select to authenticated
  using (
    (target_table = 'pending_projects' and exists (
       select 1 from pending_projects p
       where p.id = signoffs.target_id and can_access_team(p.team_id)))
    or
    (target_table = 'customers' and exists (
       select 1 from customers c
       where c.id = signoffs.target_id and can_access_team(c.team_id)))
  );

create policy signoff_insert on signoffs
  for insert to authenticated
  with check (
    signed_by = auth.uid()          -- เซ็นแทนคนอื่นไม่ได้
    and is_reviewer()               -- sale เซ็นไม่ได้ ต่อให้ยิง REST API ตรงจากมือถือ
    and (
      (target_table = 'pending_projects' and exists (
         select 1 from pending_projects p
         where p.id = signoffs.target_id and can_access_team(p.team_id)))
      or
      (target_table = 'customers' and exists (
         select 1 from customers c
         where c.id = signoffs.target_id and can_access_team(c.team_id)))
    )
  );

-- ══════════════════════════════════════════════════════════
-- 5) GRANT — ให้แค่ select, insert
--
-- ⚠️ ห้ามใส่ update, delete ตรงนี้เด็ดขาด
--    นี่คือชั้นที่ 1 ของ 3 ชั้น ถ้าใครเผลอเพิ่ม policy delete ทีหลัง
--    ชั้นนี้จะยังกันไว้อยู่
-- ══════════════════════════════════════════════════════════

grant select, insert on signoffs to authenticated;
revoke all on signoffs from anon;

-- ══════════════════════════════════════════════════════════
-- 6) ตรวจผลหลังรัน — ควรได้ตามคอลัมน์ note ทุกบรรทัด
-- ══════════════════════════════════════════════════════════

select 'ตาราง signoffs' as check_item,
       count(*)::text as result, '1 expected' as note
from pg_tables where schemaname = 'public' and tablename = 'signoffs'

union all
select 'RLS เปิดแล้ว',
       case when bool_or(rowsecurity) then 'ใช่' else 'ไม่ใช่ ✗' end, 'ใช่ expected'
from pg_tables where schemaname = 'public' and tablename = 'signoffs'

union all
select 'policy ทั้งหมด (select + insert)',
       count(*)::text, '2 expected'
from pg_policies where schemaname = 'public' and tablename = 'signoffs'

union all
select '⭐ policy สำหรับ update/delete',
       count(*)::text, '0 expected — ต้องไม่มี ไม่งั้นลบลายเซ็นได้'
from pg_policies
where schemaname = 'public' and tablename = 'signoffs' and cmd in ('UPDATE', 'DELETE')

union all
select '⭐ สิทธิ์ update/delete ที่ให้ authenticated',
       count(*)::text, '0 expected — ต้องไม่มี'
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public'
  and table_name = 'signoffs' and privilege_type in ('UPDATE', 'DELETE')

union all
select 'trigger เขียน signed_by/version ให้เอง',
       count(*)::text, '1 expected'
from pg_trigger where tgname = 'trg_signoff_meta' and not tgisinternal

union all
select 'anon แตะ signoffs ได้',
       count(distinct table_name)::text, '0 expected'
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and table_name = 'signoffs';
