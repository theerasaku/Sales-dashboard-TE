# สถานะการสร้าง TE Sales Dashboard

อ้างอิงแผนเต็ม: `pending-dashboard-build-plan.md`

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

## สิ่งที่ทำใน Phase 0.1

- โครงไฟล์ `docs/` ครบตามแผน (shell + css + adapter 3 ไฟล์ + 5 module ว่าง + PWA)
- `db/` 4 ไฟล์ SQL (โครงเปล่ารอ 1.1)
- `tools/import-json.html` (โครง)
- `docs/.nojekyll` เพื่อให้ GitHub Pages ไม่กรองไฟล์ที่ขึ้นต้นด้วย `_`
- `.gitignore` กัน key/ข้อมูลลูกค้าหลุดขึ้น public repo

## ขั้นตอนที่ผู้ใช้ต้องทำเอง (0.1 ส่วนที่เหลือ)

1. สร้าง repo ชื่อ `te-sales-dashboard` บน GitHub (public)
2. push โฟลเดอร์นี้ขึ้นไป
3. Settings → Pages → Branch `main` + โฟลเดอร์ `/docs` → Save

## ขั้นตอนต่อไป (0.2)

1. สร้าง project บน supabase.com (region: Singapore ใกล้ไทยสุด)
2. Settings → API → คัดลอก **Project URL** + **anon public key**
3. เอา 2 ค่านี้มาให้ผม แล้วผมจะใส่ใน `docs/js/config.js` และสลับ `DATA_MODE` เป็น `supabase`
