-- TE Sales Dashboard — step 3.11 (เจ้าของขอ 24 ก.ค. 2569)
-- อนุญาต "ลบถาวร" งาน/ลูกค้า เฉพาะที่ archive แล้ว (is_active = false)
--
-- ⚠️ เปลี่ยนการตัดสินใจเดิม (21 ก.ค. ที่ให้ลบถาวรได้เฉพาะ admin):
--    เจ้าของขอให้ลบงานที่สร้างผิด/ไม่ใช้แล้วได้ — แต่ต้องปลอดภัย จึงบังคับ 2 ขั้น
--      1) เก็บเข้าคลังก่อน (soft delete · is_active=false · ยังปลุกกลับได้)
--      2) แล้วจึงลบถาวรได้
--    งานที่ยัง "เดินอยู่" (is_active=true) ยังลบถาวรไม่ได้ ยกเว้น admin
--    → กันเผลอลบงานที่ยังใช้อยู่ (backup วันละครั้งกู้เคส "ลบผิดตอนบ่าย" ไม่ได้)
--
-- วิธีรัน: Supabase → SQL Editor → วางทั้งไฟล์ → Run · รันซ้ำได้
-- ต้องรัน policies.sql · phase2.sql · phase3-10.sql (ใช้ is_admin(), can_edit_team()) มาก่อน

-- ── งาน Pending ──
drop policy if exists pending_delete on pending_projects;
create policy pending_delete on pending_projects
  for delete to authenticated
  using (is_admin() or (is_active = false and can_edit_team(team_id)));

-- ── ลูกค้า Book 3 สี ──
drop policy if exists cust_delete on customers;
create policy cust_delete on customers
  for delete to authenticated
  using (is_admin() or (is_active = false and can_edit_team(team_id)));

-- ══════════════════════════════════════════════════════════
-- ตรวจผลหลังรัน
-- ══════════════════════════════════════════════════════════

select 'policy pending_delete (แก้แล้ว)' as check_item,
       count(*)::text as result, '1 expected' as note
from pg_policies
where schemaname = 'public' and tablename = 'pending_projects'
  and policyname = 'pending_delete' and qual ilike '%is_active%'

union all
select 'policy cust_delete (แก้แล้ว)', count(*)::text, '1 expected'
from pg_policies
where schemaname = 'public' and tablename = 'customers'
  and policyname = 'cust_delete' and qual ilike '%is_active%';
