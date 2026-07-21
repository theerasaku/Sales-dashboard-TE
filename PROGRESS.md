# สถานะการสร้าง TE Sales Dashboard

อ้างอิงแผนเต็ม: [`CLAUDE.md`](./CLAUDE.md) · แผนฉบับภาพ: [`plan/te-sales-dashboard-build-plan.html`](./plan/te-sales-dashboard-build-plan.html)

> **v2 (20 ก.ค. 2026)** — requirement ปรับใหม่: เพิ่ม AI Intake · Archive · แถบ Supplier → roadmap ขยายจาก 18 เป็น 20 step · (21 ก.ค.) เพิ่ม 3.7 ธีม/สี → 21 step

| Step | งาน | ขนาด | สถานะ |
|---|---|---|---|
| 0.1 | สร้าง repo + โครงไฟล์ + เปิด Pages | S | ✅ **เสร็จ** — เว็บขึ้นแล้ว |
| 0.2 | ตัดสินใจ DB + setup Supabase + ใส่ค่าใน config.js | S | ✅ **เสร็จ** — project `Sales TE` (Singapore) |
| 1.1 | schema.sql + policies.sql + seed.sql (B1, B2) | M | ✅ **เสร็จ** — รันจริงบน Supabase + ตรวจครบแล้ว |
| 1.2 | F1 app shell + login | M | ✅ **เสร็จ** — ล็อกอินจริงผ่าน Supabase Auth |
| 1.3 | F2 adapter layer | M | ✅ **เสร็จ** — pending CRUD + archive + follow logs + teams (customers/activities รอ 2.1) |
| 1.4 | F4 Pending UI เต็ม | L | ⬜ |
| 1.5 | B6 views + F3 dashboard | M | ⬜ |
| 1.6 | tools/import-json.html | M | ⬜ |
| 1.7 | deploy + ทดสอบ iPhone/S24/iPad | S | ⬜ |
| 2.1 | schema B3 + B4 (customers, customer_logs, activities) | S | ⬜ |
| 2.2 | F5 Book 3 สี UI | L | ⬜ |
| 2.3 | F6 แผนติดต่อลูกค้า + แจ้งเตือนงานเลยกำหนด | M | ⬜ |
| 2.4 | หน้า Admin + ทดสอบ RLS | M | ⬜ |
| 2.5 | **Archive แสดง/ซ่อนงานที่จบแล้ว** (ใหม่ v2) | M | ⬜ |
| 3.1 | B5 + F7 แหล่งงาน 8 เส้นทาง + Thai Water Expo | M | ⬜ |
| 3.2 | หน้าทีมขาย + playbook + เช็กลิสต์ชนะงาน | S | ⬜ |
| 3.3 | F8 PWA (manifest + sw + icons) | M | ⬜ |
| 3.4 | **B7 + F9 แถบ Supplier** (ใหม่ v2) | M | ⬜ |
| 3.5 | **F10 AI Intake** (ใหม่ v2) | L | ⬜ |
| 3.6 | export CSV/JSON ทุก module + backup + ทดสอบรวม | S | ⬜ |
| 3.7 | **ธีม/สี — เลือกธีมสำเร็จรูป + สีเน้น** (ใหม่) | S | ⬜ |

## สิ่งที่ทำใน Phase 0.1

- โครงไฟล์ `docs/` ครบตามแผน (shell + css + adapter 3 ไฟล์ + module + PWA)
- `db/` 4 ไฟล์ SQL (โครงเปล่ารอ 1.1)
- `tools/import-json.html` (โครง)
- `docs/.nojekyll` เพื่อให้ GitHub Pages ไม่กรองไฟล์ที่ขึ้นต้นด้วย `_`
- `.gitignore` กัน key/ข้อมูลลูกค้าหลุดขึ้น public repo

## สิ่งที่ทำใน v2 sync (20 ก.ค. 2026)

- `CLAUDE.md` v2 เข้า repo แล้ว (เดิมไฟล์หายไป README ลิงก์ไปหาไม่เจอ)
- เพิ่มโครง `docs/js/modules/suppliers.js` (F9) + `docs/js/modules/ai-intake.js` (F10)
- ต่อแท็บ Supplier เข้า sidebar + bottom bar + router ใน `app.js`
- `plan/` เก็บแผนฉบับภาพ + รายการฟิลด์ฟอร์ม Book 3 สี (สำหรับออกแบบ B3)
- `_local/` (gitignore แล้ว) เก็บ prototype v3 ไว้ใช้อ้างอิงตอน step 1.4 / 2.2

## ⚠️ ข้อควรระวัง — prototype v3 มีข้อมูลลูกค้าจริง

`_local/prototype/pending-project-dashboard-v3.html` ฝังข้อมูลจริงไว้ในไฟล์:
ลูกค้า Thai Water 90 ราย · นามบัตร 27 ใบ · อีเมลจริง 102 อีเมล พร้อมเบอร์มือถือ
ที่อยู่บ้าน วันเกิด และข้อมูลครอบครัว

repo นี้เป็น **public** → ไฟล์นี้อยู่ใน `_local/` ซึ่ง gitignore ไว้แล้ว **ห้าม commit เด็ดขาด**
(ตรงกับกติกาข้อ 6 ใน CLAUDE.md) · ตอนยก UI มาใช้ใน step 1.4/2.2 ให้ยก **โครง UI/ฟอร์ม/กราฟ/palette**
มาเท่านั้น ห้ามยกอาเรย์ข้อมูล (`TW_CUSTOMERS`, `NAMECARDS`, `NAMECARDS2`, `DC_DEALS`) ติดมาด้วย
ข้อมูลจริงให้เข้าทาง step 1.6 (import JSON) → Supabase ที่มี RLS แทน

## ✅ 0.1 เสร็จแล้ว

- repo: <https://github.com/theerasaku/Sales-dashboard-TE> (public)
- เว็บ: <https://theerasaku.github.io/Sales-dashboard-TE/> — ทดสอบด้วย headless Chrome แล้ว โหลดผ่าน ไม่มี JS error
- ข้อค้างเล็กน้อย: `manifest.json` ชี้ไปที่ `icons/icon-192.png` / `icon-512.png` ซึ่งยังไม่มีไฟล์
  → ขึ้น warning ตอนติดตั้ง PWA แต่ไม่กระทบการใช้งาน · **แก้ใน step 3.3 (F8 PWA)**

## ✅ 1.1 เขียน SQL เสร็จแล้ว (รอรันจริง)

3 ไฟล์ใน `db/` — ต้องรันตามลำดับใน Supabase SQL Editor **หลังทำ 0.2 เสร็จ**

1. **`schema.sql`** — B1 (`teams`, `profiles`) + B2 (`pending_projects`, `follow_logs`, `project_contacts`)
   - ครบทุกช่องในฟอร์มกระดาษ 2 หน้า (ตรวจแล้วว่าคลุมครบ 37 ช่องที่ prototype v3 บันทึก)
   - ใส่ `is_active` + `archived_at` ไว้ตั้งแต่แรก → **step 2.5 (Archive) ไม่ต้องทำ migration**
   - trigger `updated_at` อัตโนมัติ + trigger สร้าง `profiles` อัตโนมัติตอน admin เชิญบัญชี
2. **`policies.sql`** — RLS ครบ 5 ตาราง
   - `is_admin()` / `my_team_id()` เป็น SECURITY DEFINER (ถ้าไม่ใส่ policy ของ `profiles` จะวนไม่รู้จบ)
   - trigger `guard_profile_privilege` กัน sale ตั้ง `role = 'admin'` ให้ตัวเอง
3. **`seed.sql`** — ทีม 5 ทีม + คำสั่งตั้ง admin คนแรก (comment ไว้ รอใส่อีเมลจริง)

## สถานะการรัน SQL บน Supabase (21 ก.ค. 2026)

| ไฟล์ | สถานะ | ผลตรวจจากภายนอก |
|---|---|---|
| `schema.sql` | ✅ รันแล้ว | ตารางครบ 5 ตัว |
| `policies.sql` | ✅ รันแล้ว | anon อ่าน/เขียนถูกบล็อกครบทุกตาราง (42501) |
| `seed.sql` | ✅ รันแล้ว | ทีม 5 ทีม ข้อความไทยถูกต้อง (22 chars / 60 bytes) |

### ผลตรวจรอบสุดท้าย (ผ่านครบ)

| ด่าน | ผล |
|---|---|
| ตารางเปิด RLS | 5 |
| policy | 15 |
| `authenticated` แตะตารางได้ | 5 |
| `anon` แตะตารางได้ | **0** |
| ผู้ใช้ | `theerasak@dos.co.th` → admin |
| ปิดรับสมัครสาธารณะ | ✅ ทดสอบยิง signup จากภายนอก → `Signups not allowed` |
| ข้อความไทยใน DB | ✅ YES |

### 🐞 bug ที่เจอตอนรันจริง (แก้แล้ว)

หลังรัน `schema.sql` ทั้ง 5 ตารางตอบ **42501 permission denied** ไม่ใช่ `[]`
→ project Supabase รุ่นใหม่ **ไม่ GRANT ให้ `authenticated` อัตโนมัติ** แบบรุ่นเก่า

RLS คุมแค่ "เห็นแถวไหน" ส่วน GRANT คุม "แตะตารางได้ไหม" — ขาดตัวใดตัวหนึ่งก็ใช้งานไม่ได้
ถ้าไม่เจอตรงนี้ อาการที่จะเกิดคือ **step 1.2 ล็อกอินผ่านแต่หน้าจอว่างเปล่า**

เพิ่มใน `policies.sql` แล้ว:
```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on <5 ตาราง> to authenticated;
```

### 🐞 bug ที่ 2: ตั้ง admin คนแรกไม่ได้ (แก้แล้ว)

trigger `guard_profile_privilege` เช็กแค่ `is_admin()` → ใน SQL Editor `auth.uid()` เป็น null
→ `is_admin()` = false → trigger บล็อก เกิดปัญหาไก่กับไข่ตั้ง admin คนแรกไม่ได้

แก้เป็น `if auth.uid() is null or is_admin()` — auth.uid() null = มาจาก SQL Editor /
service key ซึ่งเชื่อถือได้ ส่วนคนยิงผ่าน REST API มี auth.uid() เสมอ จึงยังบล็อกอยู่

### 🐞 bug ที่ 3: ข้อความไทยใน DB พัง (แก้แล้ว)

`LANG` ในเครื่องว่าง → `pbcopy` แปลง UTF-8 เป็น MacRoman → ไทยเพี้ยนตั้งแต่ clipboard
ตรวจไม่เจอตอนแรกเพราะใช้ `pbcopy | pbpaste` ซึ่งแปลงกลับด้วยวิธีเดียวกัน

**กติกาใหม่:** ใช้ `LC_CTYPE=UTF-8 pbcopy` เสมอ · ตรวจด้วย `osascript -e 'the clipboard as text'`
(บันทึกไว้ใน CLAUDE.md แล้ว)

## ✅ 1.2 F1 App Shell + Login (21 ก.ค. 2026)

- `supabase-adapter.js` — auth ครบวงจร: login / logout / จำ session ใน localStorage /
  ต่ออายุ token อัตโนมัติก่อนหมด 60 วิ / ดึง profile (ชื่อ-role-ทีม) ผ่าน RLS จริง
- `app.js` — ประตูตรวจสิทธิ์: ไม่มี session = เห็นแค่หน้า login เปลี่ยน hash ก็เข้าไม่ได้
  · เซสชันหมดกลางคันเด้งกลับหน้า login อัตโนมัติ
- `index.html` + `app.css` — หน้า login + ปุ่ม + แถบผู้ใช้ (สีทุกจุดมาจากตัวแปร ไม่มี hardcode)
- `config.js` — `DATA_MODE: 'supabase'` แล้ว

**ทดสอบแล้ว:**

| ทดสอบ | ผล |
|---|---|
| รหัสผ่านผิด | → "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ✅ |
| อีเมลไม่มีในระบบ | → ข้อความเดียวกัน (ไม่บอกใบ้ว่าอีเมลมีจริงไหม) ✅ |
| ยังไม่ล็อกอิน | หน้าแอปถูกซ่อน เห็นแค่ login ✅ |
| 390 / 820 / 1440px | ไม่ล้นแนวนอน · กล่องอยู่กลาง ✅ |
| ปุ่มออกจากระบบ | มีทุกขนาดจอ ✅ |
| JS error | ไม่มี ✅ |

**🐞 bug ที่เจอตอนทดสอบ (แก้แล้ว):** `.sidebar-foot` ถูกซ่อนตั้งแต่ ≤1024px
แต่ปุ่มออกจากระบบสำรองตั้งไว้ที่ ≤430px → **บน iPad จะไม่มีปุ่มออกจากระบบเลย**
แก้เป็น `.only-compact` โผล่ตั้งแต่ ≤1024px

> ⚠️ บทเรียนการทดสอบ: `--window-size=390` ของ Chrome headless **ไม่ได้ให้ viewport 390px**
> (ขั้นต่ำ ~500px) ภาพ screenshot จึงเป็นการครอบตัด ทำให้ดูเหมือน layout พัง
> ต้องวัดผ่าน iframe ที่กำหนดความกว้างเองถึงจะได้ค่าจริง

## ✅ 1.3 F2 Data Adapter (21 ก.ค. 2026)

เติม query จริงใน `supabase-adapter.js` + ทำ `local-adapter.js` ให้ผลลัพธ์ตรงกัน

| เมธอด | ทำอะไร |
|---|---|
| `listTeams()` | 5 ทีมที่ active |
| `listPending(opt)` | กรอง activeOnly/team/stage/**ช่วงเดือนคาดปิด**/ค้นหา + เรียง + limit |
| `getPending(id)` | งาน + `follow_logs` + `project_contacts` ยิงครั้งเดียว |
| `savePending(row)` | มี id = PATCH · ไม่มี = POST · ใส่ created_by/updated_by ให้อัตโนมัติ |
| `archivePending(id, on)` | **ทางลบปกติของ sale** — set is_active=false |
| `deletePending(id)` | ลบถาวร (RLS ปล่อยเฉพาะ admin) |
| `listFollowLogs` / `addFollowLog` | บันทึกติดตาม |

`listCustomers` / `listActivities` / `getDashboardStats` ยังเป็น `notReady()` ตามเดิม —
ตาราง customers/activities สร้างใน 2.1 · views ใน 1.5 **ไม่ใช่ของค้าง แต่ยังไม่ถึงคิว**

**สิ่งที่กันไว้ในโค้ด**
- `SORTABLE` whitelist — ไม่เอาชื่อคอลัมน์จาก UI ไปต่อ URL ตรง ๆ
- `READONLY` — ตัด `created_at`/`teams`/`follow_logs` ทิ้งก่อน PATCH ไม่งั้น PostgREST ตอบ 400
- `safeSearch()` — ล้าง `,()*\` ที่เป็นอักขระพิเศษของ PostgREST
- ช่องว่างเปล่า → `null` (ไม่งั้นคอลัมน์ date ที่ปล่อยว่างจะ error)
- `nullslast` ทุก order — งานที่ยังไม่กรอกวันที่ต้องอยู่ท้าย ไม่ใช่ลอยขึ้นหัวตาราง

**ผลทดสอบ**
- `node --check` ผ่านทั้ง 4 ไฟล์
- เช็ก parity: facade เรียก 17 เมธอด → มีครบทั้ง 2 adapter
- ยิง query จริงของ `listPending` ใส่ live DB → `401 / 42501 permission denied for anon`
  พิสูจน์ 2 อย่าง: **anon อ่านไม่ได้จริง** และ **PostgREST แปล query ผ่าน**
  (ยิง `order=close_month.WRONGDIR` เทียบ ได้ `400 PGRST100` คนละแบบ → 401 เมื่อกี้แปลว่า syntax ถูก)

> ⚠️ **ยังไม่ได้ทดสอบด้วยบัญชีที่ล็อกอินจริง** — ไม่มีรหัสผ่านฝั่งผู้ช่วย
> และตาราง `pending_projects` ยังว่าง (ข้อมูลเข้าใน 1.4/1.6)
> เส้นทาง "ล็อกอิน → อ่านข้อมูลได้จริง" จะพิสูจน์ได้ตอน 1.4

## ขั้นตอนต่อไป

step 1.4 (L) — F4 Pending Project UI เต็มระบบ + กรอง/เรียงตามเดือนที่คาดปิด
