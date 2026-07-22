-- TE Sales Dashboard — step 3.9
-- Export PDF ตามฟอร์มต้นฉบับ (Pending Project 2 หน้า · Book 3 สี "Potential" 2 หน้า)
--
-- ⚠️ ห้ามใส่ข้อมูลลูกค้าจริงในไฟล์นี้เด็ดขาด — repo เป็น public
--
-- ไฟล์นี้เพิ่ม 3 อย่างที่ฟอร์มกระดาษมี แต่ฐานข้อมูลยังไม่มีที่เก็บ:
--   1) ตาราง pending_products — ตาราง PRODUCT ในฟอร์ม Pending หน้า 1 (สูงสุด 9 แถว)
--   2) pending_projects.result_because — ช่อง "RESULT S / M  BECAUSE ______"
--   3) customers.nickname — ชื่อเล่น (เจ้าของสั่งเพิ่ม 23 ก.ค. 2569 · ฟอร์มกระดาษเดิมไม่มี)
--
-- ต้องรัน db/schema.sql · policies.sql · phase2.sql ให้เสร็จก่อน
-- วิธีรัน: Supabase → SQL Editor → วางทั้งไฟล์ → Run · รันซ้ำได้ทั้งไฟล์

-- ══════════════════════════════════════════════════════════
-- 1) ตาราง PRODUCT ในฟอร์ม Pending
--
-- ⭐ เพดาน 9 แถวบังคับที่ DB ด้วย check + unique ไม่ต้องเขียน trigger
--    check (line_no between 1 and 9) + unique (pending_id, line_no)
--    → ใส่ได้มากสุด 9 แถวต่อโครงการพอดี ตรงกับจำนวนช่องในฟอร์มกระดาษ
--    เจ้าของสั่งไว้ว่า "สูงสุดไม่เกินจำนวนแถวที่มีใน pdf เพื่อให้จัดรูปแบบใกล้เคียงเดิมที่สุด"
--    ถ้าปล่อยให้ใส่ 20 แถว ตอนพิมพ์ตารางจะทะลุหน้าแล้วฟอร์มเพี้ยนทั้งหน้า
--
-- 💡 total / net เก็บเป็นคอลัมน์จริง ไม่ใช่ generated column
--    เพราะฟอร์มกระดาษยอมให้เขียนตัวเลขที่ไม่ตรงสูตรได้ (เช่นตกลงราคาพิเศษหน้างาน)
--    ฝั่ง UI จะคำนวณให้อัตโนมัติ แต่ผู้ใช้พิมพ์ทับได้ — เก็บตามที่คนกรอกจริง
-- ══════════════════════════════════════════════════════════

create table if not exists pending_products (
  id          uuid primary key default gen_random_uuid(),
  pending_id  uuid not null references pending_projects(id) on delete cascade,

  -- แถวที่เท่าไหร่ในฟอร์ม (1–9) — ใช้เรียงลำดับตอนพิมพ์ด้วย
  line_no     int  not null check (line_no between 1 and 9),

  product     text,                                -- PRODUCT
  amount      numeric(12,2)  check (amount   is null or amount   >= 0),  -- AMOUNT จำนวน
  price_unit  numeric(15,2)  check (price_unit is null or price_unit >= 0), -- PRICE/UNIT
  total       numeric(15,2)  check (total    is null or total    >= 0),  -- TOTAL
  discount    numeric(15,2)  check (discount is null or discount >= 0),  -- DISCOUNT
  net         numeric(15,2)  check (net      is null or net      >= 0),  -- NET
  note        text,                                -- NOTE

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (pending_id, line_no)
);

create index if not exists idx_pending_products_pid on pending_products(pending_id);

-- ══════════════════════════════════════════════════════════
-- 2) ช่องที่ฟอร์มมีแต่ตารางยังไม่มี
-- ══════════════════════════════════════════════════════════

-- "RESULT  S____  M____  BECAUSE __________"
-- S/M (สำเร็จ/พลาด) อ่านจาก stage ที่มีอยู่แล้ว (won/lost) — ขาดแค่เหตุผล
alter table pending_projects add column if not exists result_because text;

-- ชื่อเล่น — ฟอร์มกระดาษไม่มีช่องนี้ แต่เจ้าของขอให้แสดงใน PDF ด้วย
-- (ทีมขายเรียกลูกค้าด้วยชื่อเล่นกันจริง ๆ ชื่อเต็มอย่างเดียวจำไม่ได้ว่าใครเป็นใคร)
alter table customers add column if not exists nickname text;

-- ══════════════════════════════════════════════════════════
-- 3) RLS — สิทธิ์ตามงานแม่ (แบบเดียวกับ follow_logs / project_contacts)
--
-- ⭐ ถามผ่าน can_access_team() ตัวเดียวกับทั้งระบบ
--    เพิ่ม/ลดสิทธิ์หัวหน้าทีหลัง แก้ที่ฟังก์ชันเดียว ตารางนี้ตามเอง
-- ══════════════════════════════════════════════════════════

alter table pending_products enable row level security;

drop policy if exists pproducts_all on pending_products;

create policy pproducts_all on pending_products
  for all to authenticated
  using (exists (
    select 1 from pending_projects p
    where p.id = pending_products.pending_id and can_access_team(p.team_id)
  ))
  with check (exists (
    select 1 from pending_projects p
    where p.id = pending_products.pending_id and can_access_team(p.team_id)
  ));

grant select, insert, update, delete on pending_products to authenticated;
revoke all on pending_products from anon;

-- ══════════════════════════════════════════════════════════
-- 4) ตรวจผลหลังรัน
-- ══════════════════════════════════════════════════════════

select 'ตาราง pending_products' as check_item,
       count(*)::text as result, '1 expected' as note
from pg_tables where schemaname = 'public' and tablename = 'pending_products'

union all
select 'RLS เปิดแล้ว', count(*)::text, '1 expected'
from pg_tables where schemaname = 'public'
  and tablename = 'pending_products' and rowsecurity = true

union all
select 'policy', count(*)::text, '1 expected'
from pg_policies where schemaname = 'public' and tablename = 'pending_products'

union all
select 'เพดาน 9 แถว (check line_no)', count(*)::text, '1 expected'
from information_schema.check_constraints c
join information_schema.constraint_column_usage u using (constraint_name)
where u.table_name = 'pending_products' and u.column_name = 'line_no'
  and c.check_clause like '%9%'

union all
select 'คอลัมน์ result_because', count(*)::text, '1 expected'
from information_schema.columns
where table_name = 'pending_projects' and column_name = 'result_because'

union all
select 'คอลัมน์ nickname', count(*)::text, '1 expected'
from information_schema.columns
where table_name = 'customers' and column_name = 'nickname';
