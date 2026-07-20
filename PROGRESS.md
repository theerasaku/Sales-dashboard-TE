# สถานะการสร้าง TE Sales Dashboard

อ้างอิงแผนเต็ม: [`CLAUDE.md`](./CLAUDE.md) · แผนฉบับภาพ: [`plan/te-sales-dashboard-build-plan.html`](./plan/te-sales-dashboard-build-plan.html)

> **v2 (20 ก.ค. 2026)** — requirement ปรับใหม่: เพิ่ม AI Intake · Archive · แถบ Supplier → roadmap ขยายจาก 18 เป็น 20 step

| Step | งาน | ขนาด | สถานะ |
|---|---|---|---|
| 0.1 | สร้าง repo + โครงไฟล์ + เปิด Pages | S | ✅ โครงไฟล์เสร็จ — รอ push + เปิด Pages |
| 0.2 | ตัดสินใจ DB + setup Supabase + ใส่ค่าใน config.js | S | ⏳ รอ URL + anon key จากผู้ใช้ |
| 1.1 | schema.sql + policies.sql + seed.sql (B1, B2) | M | ⬜ |
| 1.2 | F1 app shell + login | M | ⬜ |
| 1.3 | F2 adapter layer | M | ⬜ |
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

## ขั้นตอนที่ผู้ใช้ต้องทำเอง (0.1 ส่วนที่เหลือ)

1. สร้าง repo ชื่อ `te-sales-dashboard` บน GitHub (public)
2. push โฟลเดอร์นี้ขึ้นไป
3. Settings → Pages → Branch `main` + โฟลเดอร์ `/docs` → Save

## ขั้นตอนต่อไป (0.2)

1. สร้าง project บน supabase.com (region: Singapore ใกล้ไทยสุด)
2. Settings → API → คัดลอก **Project URL** + **anon public key**
3. เอา 2 ค่านี้มาให้ผม แล้วผมจะใส่ใน `docs/js/config.js` และสลับ `DATA_MODE` เป็น `supabase`
