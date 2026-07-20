-- TE Sales Dashboard — schema (step 1.1)
-- ขอบเขต: B1 Users & Teams · B2 Pending Projects
-- B3/B4 (customers, activities) มาใน step 2.1 · B5 ใน 3.1 · B7 Supplier ใน 3.4
--
-- เขียนเป็น SQL มาตรฐานให้ย้ายค่ายได้ (Supabase / Postgres ทั่วไป)
-- จุดที่ผูกกับ Supabase มีจุดเดียว: profiles.id → auth.users(id)
-- ถ้าย้ายไป SQLite/PocketBase ให้ตัด FK บรรทัดนั้นแล้วจัดการ auth เอง
--
-- วิธีรัน: Supabase → SQL Editor → วางไฟล์นี้ → Run
--          แล้วค่อยรัน policies.sql → seed.sql ตามลำดับ
--
-- รันซ้ำได้ (idempotent): ใช้ IF NOT EXISTS ทุกจุด

-- ══════════════════════════════════════════════════════════
-- ส่วนกลาง
-- ══════════════════════════════════════════════════════════

-- gen_random_uuid() — Supabase เปิดให้แล้ว แต่ใส่ไว้กันเหนียวตอนย้ายค่าย
create extension if not exists pgcrypto;

-- อัปเดต updated_at อัตโนมัติทุกครั้งที่แก้แถว (Security ข้อ 5: audit)
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ══════════════════════════════════════════════════════════
-- B1 · Users & Teams
-- ══════════════════════════════════════════════════════════

-- ทีมขาย 4 ทีม (ข้อมูลตั้งต้นอยู่ใน seed.sql)
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- GOV.1 / TE-IMP / GOV.4 / SYSTEM
  name        text not null,                     -- ชื่อที่แสดงบนหน้าจอ
  description text,                              -- ขอบเขตงานของทีม
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- โปรไฟล์ผู้ใช้ — ผูก 1:1 กับ Supabase Auth
-- ปิดรับสมัครสาธารณะ: admin เชิญบัญชีเท่านั้น (Security ข้อ 1)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'sale'
             check (role in ('admin', 'sale')),
  team_id    uuid references teams(id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_team on profiles(team_id);
create index if not exists idx_profiles_role on profiles(role);

-- ══════════════════════════════════════════════════════════
-- B2 · Pending Projects (ครบฟอร์มกระดาษ 2 หน้า)
-- ══════════════════════════════════════════════════════════

create table if not exists pending_projects (
  id            uuid primary key default gen_random_uuid(),

  -- ── หัวฟอร์ม ──
  pending_no    text,                            -- PENDING NO. (Sale code count)
  project_name  text not null,                   -- ชื่องาน/โครงการ
  customer_name text,                            -- ลูกค้า / หน่วยงาน
  site          text,                            -- SITE สถานที่ตั้งโครงการ
  project_detail text,                           -- PROJECT DETAIL (รายละเอียด 1–4)
  quotation_no  text,                            -- QUOTATION NO
  customer_code text,                            -- CUSTOMER CODE

  -- ── ผู้เกี่ยวข้องในโครงการ ──
  project_owner text,                            -- OWNER เจ้าของโครงการ
  contractor    text,                            -- CONTRACTOR ผู้รับเหมา
  designer      text,                            -- DESIGNER ผู้ออกแบบ
  consultant    text,                            -- CONSULT ที่ปรึกษา

  -- ── เงิน & เวลา ──
  value_baht    numeric(15,2) not null default 0 -- มูลค่างาน (บาท)
                check (value_baht >= 0),
  decision_day  date,                            -- DECISION DAY วันตัดสินใจ
  purchased_day date,                            -- PURCHASED DAY วันสั่งซื้อ
  close_month   text                             -- เดือนที่คาดปิด 'YYYY-MM'
                check (close_month is null or close_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  project_time  text,                            -- PROJECT TIME ระยะเวลาโครงการ
  product_time  text,                            -- PRODUCT TIME ระยะส่งมอบสินค้า

  -- ── funnel & แผนชนะงาน ──
  -- % โอกาสของแต่ละขั้นเก็บใน views.sql (step 1.5) ไม่ hard-code ในตาราง
  stage         text not null default 'lead'
                check (stage in ('lead','qualify','present','quote','nego','won','lost')),
  competitors   text,                            -- COMPETITOR คู่แข่ง
  customer_needs text,                           -- ความต้องการจริงของลูกค้า
  our_strengths text,                            -- จุดแข็งของเราในงานนี้
  win_plan      text,                            -- Win plan แผนการชนะงาน

  -- ── การติดตาม ──
  next_action   text,                            -- งานถัดไปที่ต้องทำ
  next_date     date,                            -- กำหนดทำภายใน

  -- ── ที่มา & ผู้รับผิดชอบ ──
  lead_source   text,                            -- แหล่งที่มาของงาน (FK → lead_sources ใน step 3.1)
  sub_source    text,                            -- ที่มาย่อย (กรณีแหล่งอื่น ๆ)
  product       text,                            -- กลุ่มสินค้า/ระบบ
  team_id       uuid references teams(id) on delete set null,
  owner_id      uuid references profiles(id) on delete set null,  -- sale ผู้ดูแล (รายคน)
  -- ⚠️ ตอน import (step 1.6): ฟิลด์ ownerId ใน JSON prototype v3 คือ "ทีม" ไม่ใช่คน
  --    (m1=GOV.1, m2=TE-IMP, m3=GOV.4, m4=System project) → ต้อง map เข้า team_id
  --    ส่วน owner_id ค่อยกรอกทีหลังเมื่อรู้ว่า sale คนไหนรับผิดชอบ

  -- ── archive (เตรียมไว้ให้ step 2.5 ไม่ต้อง migration ทีหลัง) ──
  -- true = งานที่ยังเดินอยู่ · false = จบแล้ว/พับไปแล้ว ซ่อนจากหน้าจอเป็นค่าเริ่มต้น
  -- dashboard + views.sql นับเฉพาะ is_active = true
  is_active     boolean not null default true,
  archived_at   timestamptz,

  -- ── audit (Security ข้อ 5) ──
  created_by    uuid references profiles(id) on delete set null,
  updated_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pending_team   on pending_projects(team_id);
create index if not exists idx_pending_owner  on pending_projects(owner_id);
create index if not exists idx_pending_stage  on pending_projects(stage);
create index if not exists idx_pending_active on pending_projects(is_active);
create index if not exists idx_pending_next   on pending_projects(next_date)
       where next_date is not null;
-- ค้นซ้ำตอน import / AI Intake (step 1.6, 3.5) จับคู่ด้วย PENDING NO.
create index if not exists idx_pending_no     on pending_projects(pending_no)
       where pending_no is not null;

-- บันทึกการติดตาม — ตาราง DATE / BY / RESPONSE / NEXT DOING ในฟอร์มกระดาษ
create table if not exists follow_logs (
  id          uuid primary key default gen_random_uuid(),
  pending_id  uuid not null references pending_projects(id) on delete cascade,
  log_date    date not null default current_date,   -- DATE
  by_user_id  uuid references profiles(id) on delete set null,
  by_name     text,                                 -- BY (เผื่อคนนอกระบบ/ข้อมูลนำเข้า)
  response    text,                                 -- RESPONSE ผลการติดตาม
  next_doing  text,                                 -- NEXT DOING สิ่งที่ต้องทำต่อ
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_follow_pending on follow_logs(pending_id, log_date desc);

-- ผู้ติดต่อในโครงการ — CONTACT TO 1–3 ในฟอร์มกระดาษ
create table if not exists project_contacts (
  id          uuid primary key default gen_random_uuid(),
  pending_id  uuid not null references pending_projects(id) on delete cascade,
  slot        int  not null check (slot between 1 and 3),  -- ช่อง 1–3 ตามฟอร์ม
  name        text,                                 -- ชื่อ-ตำแหน่ง
  status      text,                                 -- STATUS เช่น ผู้ตัดสินใจ / ผู้ใช้งาน
  address     text,                                 -- ADDRESS / ช่องทางติดต่อ
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (pending_id, slot)
);

create index if not exists idx_contacts_pending on project_contacts(pending_id);

-- ══════════════════════════════════════════════════════════
-- Trigger updated_at
-- ══════════════════════════════════════════════════════════

drop trigger if exists trg_teams_updated            on teams;
drop trigger if exists trg_profiles_updated         on profiles;
drop trigger if exists trg_pending_updated          on pending_projects;
drop trigger if exists trg_project_contacts_updated on project_contacts;

create trigger trg_teams_updated            before update on teams
  for each row execute function set_updated_at();
create trigger trg_profiles_updated         before update on profiles
  for each row execute function set_updated_at();
create trigger trg_pending_updated          before update on pending_projects
  for each row execute function set_updated_at();
create trigger trg_project_contacts_updated before update on project_contacts
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════
-- สร้าง profile อัตโนมัติเมื่อ admin เชิญบัญชีใหม่เข้ามา
-- (Supabase ยิง trigger นี้ตอนมีแถวใหม่ใน auth.users)
-- role เริ่มต้น = 'sale' เสมอ · จะเป็น admin ต้องให้ admin เดิมแก้ให้เท่านั้น
-- ══════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
