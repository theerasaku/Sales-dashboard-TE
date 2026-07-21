# CLAUDE.md — TE Sales Dashboard (พิมพ์เขียวโปรเจกต์ · v2)

> ไฟล์นี้ Claude Code อ่านอัตโนมัติทุก session เป็น "ความจำถาวร" ของโปรเจกต์
> **ทุก session ที่มาเขียนโค้ด: อ่านไฟล์นี้ให้จบก่อนเริ่มเสมอ**
> v2 (20 ก.ค. 2026) เพิ่ม: AI Intake (Obsidian/Notion/กระดาษ/นามบัตร) · Archive แสดง/ซ่อนงานจบแล้ว · แถบ Supplier

**พิกัดโปรเจกต์ (ของจริง):**
- repo: `Sales-dashboard-TE` — <https://github.com/theerasaku/Sales-dashboard-TE> (public)
- เว็บ: <https://theerasaku.github.io/Sales-dashboard-TE/> (GitHub Pages เสิร์ฟจาก `docs/`)
- ⚠️ prototype v3 ที่มีข้อมูลลูกค้าจริงเก็บที่ `_local/` ซึ่ง gitignore ไว้ — **ห้าม commit**

**⚠️ กับดักภาษาไทยบนเครื่องนี้ (เคยทำข้อมูลใน DB พังมาแล้ว):**
- `LANG`/`LC_CTYPE` ในเครื่องนี้ว่างเปล่า → **`pbcopy` เฉย ๆ จะแปลงไทยเป็น MacRoman พัง**
  ต้องใช้ **`LC_CTYPE=UTF-8 pbcopy`** เสมอเมื่อก๊อปข้อความไทย
- `pbpaste` แปลงกลับด้วยวิธีเดียวกัน → **ตรวจด้วย `pbcopy | pbpaste` จะไม่เจอบั๊ก**
  ต้องตรวจด้วย `osascript -e 'the clipboard as text'` ถึงจะเห็นของจริง
- Supabase SQL Editor / Table Editor **แสดงฟอนต์ไทยไม่ได้** → เขียนสคริปต์ที่ต้องให้ผู้ใช้อ่านผลเป็น ASCII

## กติกาการทำงาน (สำคัญที่สุด — ทำตามทุก step)
1. ทำ **ทีละ 1 step** ตาม Roadmap ด้านล่าง อย่าข้าม
2. จบ step แล้ว **commit + push ขึ้น GitHub ทุกครั้ง** (งานค้างจะไม่หาย)
3. **ทดสอบเองก่อนส่งงาน** (เปิด headless / เปิดใน browser) ต้องไม่มี JS error
4. จบ step ให้ **อัปเดตบรรทัด "สถานะ" ท้ายไฟล์นี้** + commit ไฟล์นี้ไปด้วย
5. สรุปสั้นๆ ว่าทำอะไรไป + step ต่อไปคืออะไร ให้เจ้าของโปรเจกต์ทราบ
6. **ห้ามใส่ service_role key หรือข้อมูลลูกค้าจริงใน repo เด็ดขาด** (repo เป็น public)

## เป้าหมายโปรเจกต์
ยกระบบ Sales Dashboard จาก prototype ไฟล์เดียว → **ระบบถาวรบน GitHub Pages + ฐานข้อมูลกลาง** ที่ทีมขายใช้พร้อมกันได้จากมือถือ (iPhone / Samsung S24 / iPad) และ desktop ผ่าน URL เดียว
เป้าธุรกิจที่ระบบต้องรองรับ: ปิดการขาย **80 ล้านบาท ก.ค.–ธ.ค. 2569** (แก้เป้าได้ในหน้า Admin)

## สถาปัตยกรรม (แยก 3 ชั้น)
- **Frontend:** static HTML/CSS/JS แยกไฟล์เป็น module → host บน **GitHub Pages** (เสิร์ฟจากโฟลเดอร์ `docs/`) · ธีม Linear-style dark · เป็น PWA (ติดตั้งเป็น app ได้)
- **Data Adapter (ชั้นกลาง):** UI เรียกผ่าน `docs/js/data/adapter.js` เท่านั้น → สลับ backend ได้โดยไม่แตะ UI
  - `supabase-adapter.js` = ตัวจริง · `local-adapter.js` = โหมด offline/สำรอง
- **Backend/DB:** เส้นทางหลัก = **Supabase** (PostgreSQL + Auth + Row Level Security)
  - schema เขียนเป็น **SQL มาตรฐาน** ใน `db/` เพื่อให้ย้ายไป SQLite/PocketBase บน VPS Hostinger ได้ภายหลัง
- **Multi-user:** `admin` (เจ้าของ เห็น/แก้ทั้งหมด) + `sale` (เห็น/แก้เฉพาะงานทีมตัวเอง)
  - ทีม: **GOV.1** (ราชการ/ประมูล), **GOV.3**, **GOV.4** (ท้องถิ่น/บาดาล), **TE-IMP** (เอกชน/โรงงาน), **System Project**

## Mobile (mobile-first)
- ≤430px (iPhone/S24): แท็บนำทางเป็น **bottom bar**, ตาราง → **การ์ด**, ปุ่ม/จุดแตะ ≥44px
- 431–1024px (iPad): layout 2 คอลัมน์
- >1024px: เต็มจอเหมือน desktop
- PWA: manifest + service worker → "Add to Home Screen" ได้ทั้ง Safari (iPhone/iPad) และ Chrome (S24)

## Security 5 ชั้น
1. **Auth** — Supabase Auth (email+password), **ปิดรับสมัครสาธารณะ** admin เชิญบัญชีให้ทีมเท่านั้น
2. **RLS** — บังคับสิทธิ์ที่ตัว DB: admin ทั้งหมด / sale เฉพาะทีม (ยิง API ตรงก็ทะลุไม่ได้)
3. **Key** — frontend ใช้ **anon key เท่านั้น** (เปิดเผยได้), service_role ห้ามอยู่ใน repo
4. **HTTPS** — ทุกเส้นทาง (GitHub Pages + Supabase บังคับอยู่แล้ว)
5. **Audit + Backup** — ทุก record เก็บ created_by/updated_at + Supabase backup อัตโนมัติ + ปุ่ม export JSON/CSV

## โครงสร้างไฟล์ (skeleton มีแล้วใน repo นี้)
```
docs/                         ← GitHub Pages เสิร์ฟโฟลเดอร์นี้
  index.html                  ← โครงหน้า + โหลด module
  css/app.css                 ← ธีม Linear-dark + responsive
  js/app.js                   ← F1 shell + router + auth
  js/config.js                ← Supabase URL + anon key + สวิตช์เลือก adapter
  js/data/adapter.js          ← F2 interface กลาง (UI เรียกอันนี้เท่านั้น)
  js/data/supabase-adapter.js ← ตัวจริง
  js/data/local-adapter.js    ← offline/สำรอง
  js/modules/dashboard.js     ← F3
  js/modules/pending.js       ← F4
  js/modules/book3.js         ← F5
  js/modules/activities.js    ← F6
  js/modules/sources.js       ← F7 (แหล่งงาน + ทีม + กลยุทธ์)
  js/modules/suppliers.js     ← F9 Supplier (ใหม่ v2)
  js/modules/ai-intake.js     ← F10 AI Intake (ใหม่ v2)
  manifest.json, sw.js        ← F8 PWA
  icons/                      ← ไอคอน app
db/
  schema.sql                  ← B1–B5 ตาราง (SQL มาตรฐาน)
  policies.sql                ← RLS สิทธิ์ admin/sale
  views.sql                   ← B6 สรุปตัวเลข dashboard
  seed.sql                    ← ข้อมูลตั้งต้น (5 ทีม, 8 แหล่งงาน)
tools/
  import-json.html            ← ย้ายข้อมูล JSON v1/v2/v3 เดิม → DB
```

## Backend 7 module
- **B1 Users & Teams** — `profiles` (role admin/sale, team), `teams` · ผูก Supabase Auth
- **B2 Pending Projects** — `pending_projects` (ครบฟอร์มกระดาษ 2 หน้า: PENDING NO., SITE, PROJECT DETAIL, QUOTATION NO, มูลค่า, OWNER/CONTRACTOR/DESIGNER/CONSULT, DECISION/PURCHASED DAY, COMPETITOR, Win plan, สถานะ funnel, **สถานะ active/จบแล้ว — archive**) + `follow_logs` (DATE/BY/RESPONSE/NEXT DOING) + `project_contacts` (CONTACT TO 1–3)
- **B3 Book 3 สี** — `customers` (🟢 สนิท/ซื้อประจำ · 🟡 มีโอกาส · 🔴 เพิ่งเริ่ม, sale ผู้ดูแล, **สถานะ active/ไม่ active — archive**) + `customer_logs`
- **B4 Activities** — `activities` (กิจกรรมรายสัปดาห์ ผูก pending/customer, due date, สถานะ)
- **B5 Lead Sources & Settings** — `lead_sources` (8 เส้นทาง + ลิงก์แก้ได้: e-GP, G-LEAD, Data Center, กชช.2ค, กรมทรัพยากรน้ำ/บาดาล, ผู้ออกแบบ ASA/วสท., มูลนิธิโรคไต), `expo_customers` (Thai Water Expo 90 ราย, ★37 prospect), `app_settings` (เป้า 80MB, แผนรายเดือน)
- **B6 Dashboard Views** — `views.sql`/RPC สรุปตัวเลข (ยอดปิดเทียบเป้า, pipeline coverage, funnel, top3 งานใหญ่, งานเลยกำหนด — **นับเฉพาะงาน active**)
- **B7 Suppliers (ใหม่ v2)** — `suppliers` (ผู้ขาย/ผู้รับเหมา/วัสดุก่อสร้าง/วัตถุดิบ/บริการ, ผู้ติดต่อ, เรตติ้ง, ราคา/เงื่อนไข) + `supplier_categories` (กลุ่มหลัก→กลุ่มย่อย เพิ่ม/แก้เองได้) + `project_suppliers` (ผูก supplier ↔ pending project สำหรับ sourcing ต่อโครงการ)

## Frontend 10 module
F1 App Shell + Login · F2 Data Adapter · F3 Dashboard ภาพรวม · F4 Pending Project UI (+toggle แสดง/ซ่อนงานจบแล้ว) · F5 Book 3 สี UI (+ปุ่มยกลูกค้า→Pending, +toggle ซ่อนลูกค้าไม่ active) · F6 แผนติดต่อลูกค้า · F7 แหล่งงาน+ทีม+กลยุทธ์ playbook · F8 PWA+Responsive · **F9 Supplier Tab (ใหม่ v2)** — แถบ Supplier กลุ่มย่อยกรองได้ เพิ่ม/แก้กลุ่มจากหน้าจอ · **F10 AI Intake (ใหม่ v2)** — ปุ่ม 🤖 AI Import ทุกแท็บ: รูปนามบัตร→Book 3 สี, รูปฟอร์มกระดาษ/ลายมือ→Pending, Obsidian, Notion — AI แกะเป็น JSON ตาม schema แล้วระบบแสดง preview + merge กันซ้ำ (จับคู่เบอร์โทร/ชื่อบริษัท/PENDING NO.) ก่อนบันทึกจริง + log ทุกการนำเข้า

## Roadmap 20 step (S/M/L = ขนาดงาน; L = งานใหญ่ ยิงตอนโควตาเหลือเยอะ)

### Phase 0 — เตรียมฐาน
- **0.1 (S)** ยืนยันโครง repo นี้ + push ขึ้น GitHub + เปิด GitHub Pages จาก `docs/`
- **0.2 (S)** ตัดสินใจ DB + สมัคร Supabase → เอา Project URL + anon key ใส่ `docs/js/config.js` (คู่มือใน README)

### Phase 1 — MVP (จบแล้วใช้งานจริงได้)
- **1.1 (M)** `db/schema.sql` + `policies.sql` + `seed.sql` สำหรับ B1, B2 → รันใน Supabase SQL Editor
- **1.2 (M)** F1 App Shell + Login (Supabase Auth, bottom bar มือถือ, ธีมดาร์ก)
- **1.3 (M)** F2 Data Adapter (adapter.js + supabase-adapter.js + local-adapter.js)
- **1.4 (L)** F4 Pending Project เต็มระบบ (ฟอร์ม + ตาราง sort/ซ่อนคอลัมน์ + บันทึกติดตาม + Win plan + CSV; มือถือเป็นการ์ด)
- **1.5 (M)** B6 `views.sql` + F3 Dashboard ภาพรวม (เทียบเป้า 80MB, กราฟแผน vs ปิดจริง, funnel, top3, งานเลยกำหนด)
- **1.6 (M)** `tools/import-json.html` ย้ายข้อมูล JSON v1/v2/v3 เดิม → Supabase
- **1.7 (S)** Deploy + ทดสอบจริง 3 เครื่อง (iPhone/S24/iPad): login, เพิ่มงาน, ดู dashboard

### Phase 2 — ลูกค้า + ทีม
- **2.1 (S)** schema B3 + B4 (customers, customer_logs, activities) + RLS
- **2.2 (L)** F5 Book 3 สี UI (กรองสี/ทีม/sale, log รายคน, ปุ่มยก → Pending)
- **2.3 (M)** F6 แผนติดต่อลูกค้า + แจ้งเตือนงานเลยกำหนดบน dashboard
- **2.4 (M)** หน้า Admin (จัดการผู้ใช้/ทีม/เป้าหมาย) + ทดสอบ RLS ว่า sale เห็นเฉพาะทีมตัวเอง
- **2.5 (M, ใหม่ v2)** Archive แสดง/ซ่อนงานที่จบแล้ว — field สถานะใน pending_projects/customers (migration ไม่กระทบข้อมูลเดิม), toggle "แสดงงานที่จบแล้ว" ในหน้า Pending + Book 3 สี (ค่าเริ่มต้นซ่อน), ปุ่มเปลี่ยนสถานะ/ปลุกกลับ active, dashboard + views.sql นับเฉพาะ active

### Phase 3 — ครบระบบ + Supplier + AI Intake + PWA
- **3.1 (M)** B5 + F7 แหล่งงาน 8 เส้นทาง (ลิงก์แก้ได้) + หน้า Thai Water Expo (★ prospect ขึ้นก่อน, ปุ่ม → Pending)
- **3.2 (S)** หน้าทีมขาย 5 ทีม + playbook กลยุทธ์ 8 เส้นทาง + เช็กลิสต์ชนะงาน 7 ข้อ
- **3.3 (M)** F8 PWA (manifest + sw + icons) → ติดตั้งบน iPhone/iPad/S24
- **3.4 (M, ใหม่ v2)** B7 + F9 แถบ Supplier — ตาราง suppliers/supplier_categories/project_suppliers + RLS, แถบใหม่กลุ่มย่อยกรองได้ (ผู้ขาย/ผู้รับเหมา/วัสดุก่อสร้าง/วัตถุดิบ/บริการ) เพิ่ม/แก้กลุ่มจากหน้าจอ, ปุ่มหา supplier จากหน้า Pending
- **3.5 (L, ใหม่ v2)** F10 AI Intake — modal 🤖 AI Import 4 แหล่ง: รูปนามบัตร→Book 3 สี · รูปฟอร์มกระดาษ/ลายมือ→Pending · Obsidian (`raw/TE-Pending project`, `raw/TE-Book 3 สี`) · Notion — คำสั่งสำเร็จรูปให้ Claude คืน JSON ตาม schema, preview+merge กันซ้ำก่อนบันทึก, log ทุกการนำเข้า
- **3.6 (S)** ปุ่ม export CSV/JSON ทุก module + วิธี backup รายสัปดาห์ + ทดสอบรวมทั้งระบบปิดโครงการ

## หมายเหตุการต่อยอด
- prototype เดิม (v3) เป็น artifact ชื่อ `pending-project-dashboard` บน claude.ai — ยก UI/ฟอร์ม/กราฟ/palette CVD-safe มาใช้ได้ ประหยัดเวลา (ถ้าเข้าถึงไม่ได้ ให้เจ้าของแนบไฟล์ HTML prototype มา)
- นามบัตร 11 รายถูก import จาก Obsidian ในระบบเดิมแล้ว (sale ธีระศักดิ์) — ต้องคง migrate มาด้วยใน step 1.6/2.1

---
## สถานะโครงการ
**ล่าสุด: 0.1 เสร็จ (Pages เปิดใช้แล้ว) + 1.1 เขียน SQL เสร็จ — ถัดไป 0.2 สมัคร Supabase แล้วรัน SQL ทั้ง 3 ไฟล์**
_(เมื่อทำ step เสร็จ ให้อัปเดตบรรทัดนี้ เช่น "ล่าสุด: 1.3 เสร็จ, ถัดไป 1.4" แล้ว commit ไฟล์นี้)_
