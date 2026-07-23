# CLAUDE.md — TE Sales Dashboard (พิมพ์เขียวโปรเจกต์ · v3)

> ไฟล์นี้ Claude Code อ่านอัตโนมัติทุก session เป็น "ความจำถาวร" ของโปรเจกต์
> **ทุก session ที่มาเขียนโค้ด: อ่านไฟล์นี้ให้จบก่อนเริ่มเสมอ**
> v2 (20 ก.ค. 2026) เพิ่ม: AI Intake (Obsidian/Notion/กระดาษ/นามบัตร) · Archive แสดง/ซ่อนงานจบแล้ว · แถบ Supplier
> v3 (21 ก.ค. 2026) เพิ่ม: Backup (**ไม่ทำ rollback**) · role หัวหน้างาน + team_access · หัวหน้าเซ็นรับทราบ · AI Intake อัตโนมัติผ่าน Edge Function · Pending กรอง/เรียงตามเดือนที่คาดปิด

**พิกัดโปรเจกต์ (ของจริง):**
- repo: `Sales-dashboard-TE` — <https://github.com/theerasaku/Sales-dashboard-TE> (public)
- เว็บ: <https://theerasaku.github.io/Sales-dashboard-TE/> (GitHub Pages เสิร์ฟจาก `docs/`)
- ⚠️ prototype v3 ที่มีข้อมูลลูกค้าจริงเก็บที่ `_local/` ซึ่ง gitignore ไว้ — **ห้าม commit**

**⚠️ กับดักภาษาไทยบนเครื่องนี้ (เคยทำข้อมูลใน DB พังมาแล้ว):**
- `LANG`/`LC_CTYPE` ในเครื่องนี้ว่างเปล่า → **`pbcopy` เฉย ๆ จะแปลงไทยเป็น MacRoman พัง**
  ต้องใช้ **`LC_CTYPE=UTF-8 pbcopy`** เสมอเมื่อก๊อปข้อความไทย
- `pbpaste` แปลงกลับด้วยวิธีเดียวกัน → **ตรวจด้วย `pbcopy | pbpaste` จะไม่เจอบั๊ก**
  ต้องตรวจด้วย `osascript -e 'the clipboard as text'` ถึงจะเห็นของจริง
- Supabase **แสดงไทยได้ปกติ** — ถ้าเห็นตัวอักษรมั่วแปลว่าข้อความพังตั้งแต่ก่อนเข้าไป ไม่ใช่ปัญหาฟอนต์
  (เคยวินิจฉัยผิดว่าเป็นฟอนต์ แล้วปล่อยข้อมูลพังค้างใน DB อยู่หลายรอบ)
- บทเรียน: **เครื่องมือที่ใช้ตรวจ ต้องไม่ใช่ตัวเดียวกับที่อาจเป็นต้นเหตุ**

## ⚠️ กับดักที่เสียเวลาไปแล้ว 2 รอบ — อ่านก่อนแก้บั๊ก UI
- **`dispatchEvent` ไม่ใช่การคลิกจริง** — `preventDefault` ที่บล็อกของจำเป็นจะรอดสายตาเทสต์สังเคราะห์
  สิ่งที่ผู้ใช้ต้อง "กด" ให้ทดสอบด้วย **puppeteer-core + CDP** (`p.click()` = hit-test จริง)
- **แก้แล้วผู้ใช้ยังเจอบั๊กเดิม → สงสัย cache ก่อนสงสัยตรรกะ**
  GitHub Pages ส่ง `cache-control: max-age=600` · `sw.js` แก้ให้ใช้ `fetch(req, {cache:'no-cache'})` แล้ว
  และ **หน้าจอแสดงเลขเวอร์ชัน** (`CONFIG.VERSION`) — ถามผู้ใช้ว่าเห็นเลขอะไรจะรู้ทันทีว่ารันโค้ดไหน
- **การวาด DOM ใหม่ระหว่างจัดการ event ทำให้ `e.target.closest()` ของ listener ถัดไปพัง**
  (target หลุดจาก DOM แล้ว) → ใช้ `e.composedPath()` แทน

## กติกาการทำงาน (สำคัญที่สุด — ทำตามทุก step)
1. ทำ **ทีละ 1 step** ตาม Roadmap ด้านล่าง อย่าข้าม
2. จบ step แล้ว **commit + push ขึ้น GitHub ทุกครั้ง** (งานค้างจะไม่หาย)
3. **ทดสอบเองก่อนส่งงาน** (เปิด headless / เปิดใน browser) ต้องไม่มี JS error
4. จบ step ให้ **อัปเดตบรรทัด "สถานะ" ท้ายไฟล์นี้** + commit ไฟล์นี้ไปด้วย
5. สรุปสั้นๆ ว่าทำอะไรไป + step ต่อไปคืออะไร ให้เจ้าของโปรเจกต์ทราบ
6. **ห้ามใส่ service_role key หรือข้อมูลลูกค้าจริงใน repo เด็ดขาด** (repo เป็น public)
7. ⭐ **ก่อนหยุดรอเจ้าของทุกครั้ง — เขียน `autolog.md` ก่อนเสมอ**
   - เพิ่มรายการใหม่ **ไว้บนสุด** ใต้บรรทัด `<!-- ⬇️ เพิ่มรายการใหม่ใต้บรรทัดนี้ ⬇️ -->` (ใหม่สุดอยู่บน)
   - ใช้รูปแบบที่หัวไฟล์กำหนดไว้ · **บันทึกทุกครั้งที่แตะไฟล์ ไม่ใช่เฉพาะตอนปิด step**
     (งานที่ยังไม่ปิด step / แก้บั๊กย่อย / เอกสาร ก็ต้องบันทึก — ไม่งั้นไทม์ไลน์ขาด)
   - **เขียนของค้างและของที่ทดสอบไม่ได้ลงไปตรง ๆ** อย่าเขียนแต่ของที่สำเร็จ
     ไฟล์นี้มีไว้ให้ session ถัดไปรู้ว่าอะไรยังไม่จบ ถ้ารายงานแต่ด้านดีจะเสียประโยชน์ทั้งไฟล์
   - อย่าเขียนซ้ำกับไฟล์อื่น: `PROGRESS.md` = รายละเอียดลึกรายเสต็ป · `autolog.md` = ไทม์ไลน์สั้น ๆ ว่าแตะอะไรเมื่อไหร่

## เป้าหมายโปรเจกต์
ยกระบบ Sales Dashboard จาก prototype ไฟล์เดียว → **ระบบถาวรบน GitHub Pages + ฐานข้อมูลกลาง** ที่ทีมขายใช้พร้อมกันได้จากมือถือ (iPhone / Samsung S24 / iPad) และ desktop ผ่าน URL เดียว
เป้าธุรกิจที่ระบบต้องรองรับ: ปิดการขาย **80 ล้านบาท ก.ค.–ธ.ค. 2569** (แก้เป้าได้ในหน้า Admin)

## สถาปัตยกรรม (แยก 3 ชั้น)
- **Frontend:** static HTML/CSS/JS แยกไฟล์เป็น module → host บน **GitHub Pages** (เสิร์ฟจากโฟลเดอร์ `docs/`) · ธีม Linear-style dark · เป็น PWA (ติดตั้งเป็น app ได้)
- **Data Adapter (ชั้นกลาง):** UI เรียกผ่าน `docs/js/data/adapter.js` เท่านั้น → สลับ backend ได้โดยไม่แตะ UI
  - `supabase-adapter.js` = ตัวจริง · `local-adapter.js` = โหมด offline/สำรอง
- **Backend/DB:** เส้นทางหลัก = **Supabase** (PostgreSQL + Auth + Row Level Security)
  - schema เขียนเป็น **SQL มาตรฐาน** ใน `db/` เพื่อให้ย้ายไป SQLite/PocketBase บน VPS Hostinger ได้ภายหลัง
- **Edge Function (ชั้นที่ 4 · มาใน step 3.8):** Supabase Edge Function สำหรับงานที่ต้องถือความลับ
  - ใช้เคสเดียวตอนนี้: เรียก Claude API อ่าน OCR ให้ AI Intake
  - **เหตุผลที่ต้องมีชั้นนี้:** `ANTHROPIC_API_KEY` ใส่ใน frontend ไม่ได้เด็ดขาด
    repo เป็น public + ต่อให้ private ใครเปิด DevTools ก็อ่าน key ได้อยู่ดี → โดนยิงจนบิลบาน
- **Multi-user:** `admin` (เจ้าของ เห็น/แก้ทั้งหมด) + `manager` (หัวหน้า ดูข้ามทีมตามที่กำหนด + เซ็นรับทราบ) + `sale` (เห็น/แก้เฉพาะงานทีมตัวเอง)
  - ทีม: **GOV.1** (ราชการ/ประมูล), **GOV.3** (ทหาร/HomePro/กรมทางหลวง), **GOV.4** (ท้องถิ่น/บาดาล), **TE-IMP** (เอกชน/โรงงาน), **System Project**
  - **แยก "ทำอะไรได้" ออกจาก "ที่ไหน":** `role` บอกว่าเซ็นรับทราบได้ไหม · ตาราง `team_access` บอกว่าดูทีมไหนได้บ้าง
    (ของจริงหัวหน้าสายราชการดู GOV.1/3/4 แต่ไม่ควรเห็น TE-IMP — ใช้ role อย่างเดียวไม่พอ)
  - ⭐ ทั้ง 5 ตารางเรียกผ่าน `can_access_team()` ตัวเดียวกันหมด → **เพิ่มสิทธิ์หัวหน้าแก้ที่ฟังก์ชันเดียว ทั้งระบบตามหมด**

## ธีม/สี — กติกาที่ห้ามพลาด (เตรียมไว้ให้ step 3.7)
- **สีทุกสีต้องมาจากตัวแปรใน `:root` ของ `docs/css/app.css` เท่านั้น** ห้าม hardcode hex ในโค้ด/CSS ส่วนอื่น
- **กราฟ SVG ต้องใช้ `fill="var(--chart-N)"` ห้ามฝัง hex** (prototype v3 ฝัง hex ไว้ — ยกมาต้องแปลงก่อน)
  ถ้าฝัง hex เปลี่ยนธีมแล้วกราฟจะไม่เปลี่ยนตาม ต้องไล่แก้ทั้งหน้าทีหลัง
- สวิตช์ธีมอยู่ที่ `<html data-theme="dark">` → เพิ่มโหมดสว่างโดยเขียนชุดตัวแปรใต้ `[data-theme="light"]`
- ให้เลือกจาก **ธีมสำเร็จรูปที่คัดมาแล้ว** ไม่เปิดให้จิ้มสีอิสระ — กัน palette เสีย CVD-safe และคอนทราสต์ตก

## Mobile (mobile-first)
- ≤430px (iPhone/S24): แท็บนำทางเป็น **bottom bar**, ตาราง → **การ์ด**, ปุ่ม/จุดแตะ ≥44px
- 431–1024px (iPad): layout 2 คอลัมน์
- >1024px: เต็มจอเหมือน desktop
- PWA: manifest + service worker → "Add to Home Screen" ได้ทั้ง Safari (iPhone/iPad) และ Chrome (S24)

## Security 5 ชั้น
1. **Auth** — Supabase Auth (email+password), **ปิดรับสมัครสาธารณะ** admin เชิญบัญชีให้ทีมเท่านั้น
2. **RLS** — บังคับสิทธิ์ที่ตัว DB: admin ทั้งหมด / manager ตาม team_access / sale เฉพาะทีม (ยิง API ตรงก็ทะลุไม่ได้)
3. **Key** — frontend ใช้ **anon key เท่านั้น** (เปิดเผยได้), service_role ห้ามอยู่ใน repo
4. **HTTPS** — ทุกเส้นทาง (GitHub Pages + Supabase บังคับอยู่แล้ว)
5. **Audit + Backup** — ทุก record เก็บ created_by/updated_at + Supabase backup อัตโนมัติ + ปุ่ม export JSON/CSV

## Backup & กู้คืน — ขอบเขตที่ตัดสินใจแล้ว (v3)
**ทำแค่ backup · ไม่ทำ rollback รายแถว** (เจ้าของโปรเจกต์ตัดสินใจ 21 ก.ค. 2026)
→ **ห้ามเสนอ/สร้างตาราง `record_history` + trigger เก็บ old_data อีก** ตัดออกจากแผนแล้ว

3 ชั้น:
1. **Supabase อัตโนมัติ** — วันละครั้ง เก็บ 7 วัน (Free tier) · ไม่ต้องเขียนโค้ด
   ข้อจำกัดที่ต้องรู้: กู้ได้ทีละ **ทั้ง project** เท่านั้น · PITR ต้องอัป Pro ($25/เดือน) ค่อยตัดสินใจเมื่อข้อมูลเยอะ
2. **ปุ่ม Export** (step 3.6) — JSON ทุกตารางรวมไฟล์เดียว + CSV รายโมดูล
3. **รูทีนรายสัปดาห์** — กด export ทุกวันศุกร์ เก็บนอกระบบ (เอกสาร ไม่ใช่โค้ด)

**ทางกู้คืน = `tools/import-json.html` (step 1.6) ทำหน้าที่นี้ในตัว**
```
ปุ่ม Export (3.6) → te-backup-YYYY-MM-DD.json → เก็บไว้
                        ↓ ถ้าข้อมูลพัง
                 import-json.html (1.6) → กลับเข้า Supabase
```
🔒 **เงื่อนไขที่ห้ามพลาด: รูปแบบ JSON ที่ 3.6 export ออก ต้องเป็นรูปแบบเดียวกับที่ 1.6 import อ่านได้**
ถ้าปล่อยให้ออกแบบคนละแบบ จะได้ไฟล์ backup ที่เอากลับเข้าไม่ได้ — ตอนทำ 1.6 ให้ล็อก schema ของไฟล์ไว้ก่อน

**Soft delete แทนการลบถาวร** (คนละเรื่องกับ rollback):
- `pending_delete` policy = `is_admin()` เท่านั้น (แก้แล้ว 21 ก.ค. 2026)
- sale ลบ = set `is_active = false` → ปลุกกลับได้จากหน้า Archive (step 2.5)
- เหตุผล: backup วันละครั้งกู้เคส "กดลบผิดตอนบ่าย" ไม่ได้เลย

## หัวหน้าเซ็นรับทราบ (step 2.6) — กติกาความปลอดภัย
ตาราง `signoffs` เป็น **append-only** เขียนได้อย่างเดียว แก้/ลบไม่ได้
- `signed_by uuid not null default auth.uid()` + policy `with check (signed_by = auth.uid() and role in ('admin','manager'))`
  → **sale ยิง REST API ตรงจากมือถือก็เซ็นแทนหัวหน้าไม่ได้** บังคับที่ DB ไม่ใช่ที่ JS
- ⭐ **ไม่เขียน policy สำหรับ update/delete เลย** — RLS default = ปฏิเสธ → ไม่มีใครลบลายเซ็นได้ แม้แต่คนที่เซ็นเอง
- **กับดักลายเซ็นค้าง:** เก็บ `signed_version timestamptz` = `updated_at` ของแถวตอนที่เซ็น
  ถ้าไม่ตรงกับ `updated_at` ปัจจุบัน → ขึ้นป้าย "⚠️ แก้ไขหลังเซ็น — รอตรวจใหม่" และนับเป็นยังไม่ได้เซ็น
  (ไม่งั้น: หัวหน้าเซ็นวันจันทร์ตอน 5 ล้าน → sale แก้เป็น 50 ล้านวันอังคาร → ลายเซ็นยังอยู่)
- ใช้กับทั้ง `pending_projects` และ `customers` (Book 3 สี) — คอลัมน์ `target_table` + `target_id`

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
  js/modules/ai-intake.js     ← F10 AI Intake (ใหม่ v2)
  manifest.json, sw.js        ← F8 PWA
  icons/                      ← ไอคอน app
db/
  schema.sql                  ← B1–B5 ตาราง (SQL มาตรฐาน)
  policies.sql                ← RLS สิทธิ์ admin/sale
  views.sql                   ← B6 สรุปตัวเลข dashboard
  seed.sql                    ← ข้อมูลตั้งต้น (5 ทีม, 8 แหล่งงาน)
docs/tools/
  import-json.html            ← ย้ายข้อมูล JSON v1/v2/v3 เดิม → DB + กู้คืนไฟล์สำรอง
                                 รองรับ 3 รูปแบบ: ไฟล์สำรองของระบบ · deals จาก prototype ·
                                 รายชื่อจากงานแสดงสินค้า (→ expo_customers)
                                 ⚠️ ต้องอยู่ใต้ docs/ เท่านั้น — GitHub Pages เสิร์ฟแค่โฟลเดอร์นี้
                                 🔴 เคยมีซากไฟล์ placeholder ค้างที่ `tools/` ระดับ repo
                                    เจ้าของเปิดผิดไฟล์แล้วเห็นว่า "ยังไม่ได้ทำ" — ลบทิ้งแล้ว
                                    **ย้ายไฟล์ทีหลังต้องลบของเก่าเสมอ อย่าปล่อยไว้ให้เปิดผิด**

(ไฟล์เอกสารระดับ repo — แต่ละไฟล์มีหน้าที่เดียว อย่าเขียนซ้ำกัน)
  CLAUDE.md                   ← แผน + กติกา + สเปค (ไฟล์นี้)
  PROGRESS.md                 ← รายละเอียดลึกรายเสต็ป: เหตุผลการตัดสินใจ + ผลทดสอบเต็ม
  autolog.md                  ← ไทม์ไลน์ทุกการเปลี่ยนแปลง — เขียนทุกครั้งก่อนหยุดรอเจ้าของ (กติกาข้อ 7)
  WishtoHave.md               ← ฟังก์ชันที่เจ้าของอยากได้ แต่ยังไม่อยู่ใน roadmap
                                 เจ้าของจดดิบ ๆ ใน "📥 กล่องรับ" · Claude ประเมินเมื่อถูกสั่งให้อ่าน
                                 → ตอบ 5 ข้อ: step ไหน · กระทบโครงสร้างไหม · ต้อง migration ไหม ·
                                   ⭐ ราคาถ้าเลื่อน · ติดอะไรก่อน — แล้วย้ายลง "✅ ประเมินแล้ว"
                                 ⚠️ ห้ามแอบใส่ของใน roadmap เพิ่มเอง ต้องให้เจ้าของเคาะก่อนเสมอ
  Workflow/index.html         ← แผนผังภาพรวมว่าโมดูลไหนสร้างถึงไหน (เปิดด้วยเบราว์เซอร์)
```

## Backend 9 module (ใช้งานจริง 8 · B7 Supplier พักไว้)
- **B1 Users & Teams** — `profiles` (role admin/manager/sale, team), `teams`, `team_access` (ใหม่ v3: profile_id × team_id + can_edit) · ผูก Supabase Auth
- **B2 Pending Projects** — `pending_projects` (ครบฟอร์มกระดาษ 2 หน้า: PENDING NO., SITE, PROJECT DETAIL, QUOTATION NO, มูลค่า, OWNER/CONTRACTOR/DESIGNER/CONSULT, DECISION/PURCHASED DAY, COMPETITOR, Win plan, สถานะ funnel, **สถานะ active/จบแล้ว — archive**) + `follow_logs` (DATE/BY/RESPONSE/NEXT DOING) + `project_contacts` (CONTACT TO 1–3)
- **B3 Book 3 สี** — `customers` (🟢 สนิท/ซื้อประจำ · 🟡 มีโอกาส · 🔴 เพิ่งเริ่ม, sale ผู้ดูแล, **สถานะ active/ไม่ active — archive**) + `customer_logs`
- **B4 Activities** — `activities` (กิจกรรมรายสัปดาห์ ผูก pending/customer, due date, สถานะ)
- **B5 Lead Sources & Settings** — `lead_sources` (8 เส้นทาง + ลิงก์แก้ได้: e-GP, G-LEAD, Data Center, กชช.2ค, กรมทรัพยากรน้ำ/บาดาล, ผู้ออกแบบ ASA/วสท., มูลนิธิโรคไต), `expo_customers` (Thai Water Expo 90 ราย, ★37 prospect), `app_settings` (เป้า 80MB, แผนรายเดือน)
- **B6 Dashboard Views** — `views.sql`/RPC สรุปตัวเลข (ยอดปิดเทียบเป้า, pipeline coverage, funnel, top3 งานใหญ่, งานเลยกำหนด — **นับเฉพาะงาน active**)
- **B7 Suppliers** — ⏸️ **พักไว้** (เจ้าของสั่ง 23 ก.ค. 2569) สเปคย้ายไปหัวข้อ "แผนอัปเดตอนาคต" ท้ายไฟล์
- **B8 Sign-off (ใหม่ v3, step 2.6)** — `signoffs` append-only (target_table/target_id, signed_by, signed_at, reviewed_note, signed_version) · กติกาเต็มอยู่หัวข้อ "หัวหน้าเซ็นรับทราบ" ด้านบน
- **B9 AI Intake staging (ใหม่ v3, step 3.5)** — `intake_items` (source, raw_input, parsed jsonb, edited jsonb, confidence jsonb, status draft/approved/rejected/merged, target_id, created_by, approved_by)
  - **ข้อมูลลง staging ก่อนเสมอ ห้ามเขียนเข้าตารางจริงตรง ๆ** — ถ่ายรูปหน้างานด้วยมือถือ แต่มานั่งตรวจแก้บนคอมที่ออฟฟิศ ถ้าเก็บใน browser state ข้อมูลไม่ข้ามเครื่อง และไม่มีหลักฐานว่าใครอนุมัติอะไรมาจากเอกสารไหน
  - `confidence` รายช่อง → ไฮไลต์เหลืองเฉพาะช่องที่ AI ไม่มั่นใจ ไม่ให้คนไล่อ่านทั้งฟอร์ม 37 ช่อง

## Frontend 10 module (ใช้งานจริง 9 · F9 Supplier พักไว้)
F1 App Shell + Login · F2 Data Adapter · F3 Dashboard ภาพรวม · F4 Pending Project UI (+toggle แสดง/ซ่อนงานจบแล้ว) · F5 Book 3 สี UI (+ปุ่มยกลูกค้า→Pending, +toggle ซ่อนลูกค้าไม่ active) · F6 แผนติดต่อลูกค้า · F7 แหล่งงาน+ทีม+กลยุทธ์ playbook · F8 PWA+Responsive · ~~F9 Supplier Tab~~ ⏸️ พักไว้ (ดู "แผนอัปเดตอนาคต") · **F10 AI Intake (ใหม่ v2)** — ปุ่ม 🤖 AI Import ทุกแท็บ: รูปนามบัตร→Book 3 สี, รูปฟอร์มกระดาษ/ลายมือ→Pending, Obsidian, Notion — AI แกะเป็น JSON ตาม schema แล้วระบบแสดง preview + merge กันซ้ำ (จับคู่เบอร์โทร/ชื่อบริษัท/PENDING NO.) ก่อนบันทึกจริง + log ทุกการนำเข้า

## Roadmap 24 step ที่ทำจริงรอบนี้ (S/M/L = ขนาดงาน; L = งานใหญ่ ยิงตอนโควตาเหลือเยอะ)
_3.4 แถบ Supplier ถอดออก 23 ก.ค. 2569 (ไปอยู่ "แผนอัปเดตอนาคต") · **เพิ่ม 3.9 พิมพ์ฟอร์ม PDF** วันเดียวกัน_
_v3 เพิ่ม 2 step: **2.6** หัวหน้าเซ็นรับทราบ · **3.8** AI Intake อัตโนมัติ_
**ลำดับบังคับ:** 2.4 (สร้าง role `manager`) ต้องจบก่อน 2.6 (เซ็นรับทราบ) — ไม่มี role ก็ไม่มีใครเซ็นได้

### Phase 0 — เตรียมฐาน
- **0.1 (S)** ยืนยันโครง repo นี้ + push ขึ้น GitHub + เปิด GitHub Pages จาก `docs/`
- **0.2 (S)** ตัดสินใจ DB + สมัคร Supabase → เอา Project URL + anon key ใส่ `docs/js/config.js` (คู่มือใน README)

### Phase 1 — MVP (จบแล้วใช้งานจริงได้)
- **1.1 (M)** `db/schema.sql` + `policies.sql` + `seed.sql` สำหรับ B1, B2 → รันใน Supabase SQL Editor
- **1.2 (M)** F1 App Shell + Login (Supabase Auth, bottom bar มือถือ, ธีมดาร์ก)
- **1.3 (M)** F2 Data Adapter (adapter.js + supabase-adapter.js + local-adapter.js)
- **1.4 (L)** F4 Pending Project เต็มระบบ (ฟอร์ม + ตาราง sort/ซ่อนคอลัมน์ + บันทึกติดตาม + Win plan + CSV; มือถือเป็นการ์ด)
  - **กรอง/เรียงตามเดือนที่คาดปิด** (ใหม่ v3) — ใช้ `close_month` ที่มีอยู่แล้วใน schema (`'YYYY-MM'` text เรียงตามตัวอักษร = เรียงตามเวลาพอดี ไม่ต้อง migration)
  - preset: `เดือนนี้` · `ไตรมาสนี้` · **`ครึ่งปีหลัง 69`** (= `2026-07`..`2026-12` ตรงกับเป้า 80 ล้าน) · `กำหนดเอง`
  - ⚠️ **ห้ามใช้ช่องพิมพ์อิสระ ใช้ dropdown** — โชว์ "ก.ค. 69" แต่ส่งค่า `2026-07`
    ถ้าให้พิมพ์เอง ทีมจะกรอก `2569-07` ซึ่งผ่าน check constraint (ตัวเลข 4 หลัก) แต่เรียงผิดทั้งระบบ
  - งานที่ยังไม่กรอก `close_month` จะหายจากตารางตอนกรอง → query ใช้ `coalesce(close_month, to_char(decision_day,'YYYY-MM'))` แล้วติดป้าย "(ประเมิน)" ให้เห็นว่าอันไหนคนกรอก อันไหนระบบเดา
  - แยกให้ชัด: `close_month` = **คาดว่าจะปิด** (pipeline) · `purchased_day` + `stage='won'` = **ปิดจริง** (นับเข้าเป้า 80 ล้าน) — 1.5 ต้องเทียบสองเส้นนี้
  - ต้องเพิ่ม index: `create index idx_pending_close_month on pending_projects(close_month);`
- **1.5 (M)** B6 `views.sql` + F3 Dashboard ภาพรวม (เทียบเป้า 80 ล้านบาท, กราฟแผน vs ปิดจริง, funnel, top3, งานเลยกำหนด)
  - ⚠️ **หน่วยบนหน้าจอเขียน "ล้านบาท" เสมอ ห้ามเขียน "MB"** — `CONFIG.TARGET_MB` ย่อจาก Million Baht
    แต่ทีมขายอ่าน "80 MB" เป็นเมกะไบต์ (เคยพลาดมาแล้วตอน 1.3)
  - ช่วงเป้าอยู่ที่ `CONFIG.TARGET_PERIOD` = ก.ค.–ธ.ค. 2569 (ครึ่งปีหลัง ไม่ใช่ทั้งปี)
- **1.6 (M)** `tools/import-json.html` ย้ายข้อมูล JSON v1/v2/v3 เดิม → Supabase
  - 🔒 **เครื่องมือนี้ = ทางกู้คืน backup ด้วย** → ต้องล็อกรูปแบบไฟล์ให้ตรงกับที่ 3.6 export ออก (ดูหัวข้อ Backup)
- **1.7 (S)** Deploy + ทดสอบจริง 3 เครื่อง (iPhone/S24/iPad): login, เพิ่มงาน, ดู dashboard

### Phase 2 — ลูกค้า + ทีม
- **2.1 (S)** schema B3 + B4 (customers, customer_logs, activities) + RLS
- **2.2 (L)** F5 Book 3 สี UI (กรองสี/ทีม/sale, log รายคน, ปุ่มยก → Pending)
- **2.3 (M)** F6 แผนติดต่อลูกค้า + แจ้งเตือนงานเลยกำหนดบน dashboard
- **2.4 (M)** หน้า Admin (จัดการผู้ใช้/ทีม/เป้าหมาย) + ทดสอบ RLS ว่า sale เห็นเฉพาะทีมตัวเอง
  - **+ role `manager` และตาราง `team_access`** (ใหม่ v3) — เพิ่ม `'manager'` ใน check constraint ของ `profiles.role`,
    สร้าง `team_access`, แก้ `can_access_team()` เพิ่มเงื่อนไข `exists (select 1 from team_access where profile_id = auth.uid() and team_id = target_team)`
  - ⚠️ `guard_profile_privilege()` ต้องกัน manager ตั้งตัวเองเป็น admin **และกันแก้ `team_access` ของตัวเอง**
  - หน้า Admin ต้องมี UI ติ๊กว่าหัวหน้าคนไหนดูทีมไหนได้ + ทดสอบว่า manager เห็นเฉพาะทีมที่ได้รับสิทธิ์
- **2.5 (M, ใหม่ v2)** Archive แสดง/ซ่อนงานที่จบแล้ว — field สถานะใน pending_projects/customers (migration ไม่กระทบข้อมูลเดิม), toggle "แสดงงานที่จบแล้ว" ในหน้า Pending + Book 3 สี (ค่าเริ่มต้นซ่อน), ปุ่มเปลี่ยนสถานะ/ปลุกกลับ active, dashboard + views.sql นับเฉพาะ active

- **2.6 (M, ใหม่ v3)** หัวหน้าเซ็นรับทราบ — `db/signoffs.sql` (ตาราง + RLS append-only ตามหัวข้อ "หัวหน้าเซ็นรับทราบ"),
  แถบลายเซ็นในหน้า Pending (F4) และ Book 3 สี (F5) แสดง "ตรวจโดย … เมื่อ …" หรือ "⚠️ แก้ไขหลังเซ็น",
  หน้า "รอตรวจ" ของหัวหน้า (รายการที่ยังไม่เซ็น/เซ็นแล้วแต่ถูกแก้), ทดสอบว่า sale เซ็นเอง/ลบลายเซ็นไม่ได้จริง
  - **ต้องทำหลัง 2.4** (ยังไม่มี role `manager` ก็ยังไม่มีใครเซ็นได้)

### Phase 3 — ครบระบบ + AI Intake + PWA + พิมพ์ฟอร์ม
- **3.1 (M)** B5 + F7 แหล่งงาน 8 เส้นทาง (ลิงก์แก้ได้) + หน้า Thai Water Expo (★ prospect ขึ้นก่อน, ปุ่ม → Pending)
- **3.2 (S)** ✅ หน้าทีมขาย 5 ทีม + playbook กลยุทธ์ 8 เส้นทาง + เช็กลิสต์ชนะงาน 7 ข้อ
  - ทำเป็น **แถบย่อยในหน้าแหล่งงาน** (F7 = แหล่งงาน+ทีม+กลยุทธ์ ตามที่วางไว้แต่แรก) ไม่เพิ่มปุ่มในแถบนำทาง
  - เช็กลิสต์ 7 ข้อผูกกับช่องจริงในฟอร์ม Pending → ระบบนับเองว่าแต่ละข้อยังขาดกี่งาน เป็นเงินเท่าไหร่
  - playbook เก็บใน `lead_sources.playbook` หัวหน้าแก้ได้จากหน้าจอ (`db/phase3-2.sql`)
- **3.3 (M)** ✅ F8 PWA (manifest + sw + icons) → ติดตั้งบน iPhone/iPad/S24
  - ไอคอน 5 ไฟล์ · **maskable ต้องแยกไฟล์** (Android ครอบวงกลมแล้วตัดขอบ ~20%)
  - **iOS ไม่อ่านไอคอนใน manifest.json** ต้องมี `apple-touch-icon` แยก ไม่งั้น Safari จับภาพหน้าจอมาทำไอคอน
  - precache 25 ไฟล์ · แถบ ออฟไลน์ / มีเวอร์ชันใหม่ / ติดตั้งเป็นแอป (`docs/js/ui/pwa.js`)
- ~~**3.4** แถบ Supplier~~ — ⏸️ **ถอดออกจากแผนรอบนี้** (เจ้าของสั่ง 23 ก.ค. 2569) ย้ายไปหัวข้อ "แผนอัปเดตอนาคต" ท้ายไฟล์
- **3.5 (L, ใหม่ v2)** F10 AI Intake — modal 🤖 AI Import 4 แหล่ง: รูปนามบัตร→Book 3 สี · รูปฟอร์มกระดาษ/ลายมือ→Pending · Obsidian (`raw/TE-Pending project`, `raw/TE-Book 3 สี`) · Notion — คำสั่งสำเร็จรูปให้ Claude คืน JSON ตาม schema, preview+merge กันซ้ำก่อนบันทึก, log ทุกการนำเข้า
- **3.6 (S)** ปุ่ม export CSV/JSON ทุก module + วิธี backup รายสัปดาห์ + ทดสอบรวมทั้งระบบปิดโครงการ
  - **ไฟล์ backup รวม** `te-backup-YYYY-MM-DD.json` = ทุกตารางในไฟล์เดียว **รูปแบบเดียวกับที่ 1.6 import อ่านได้**
  - ต้องทดสอบวงจรจริง: export → ลบข้อมูลใน project ทดสอบ → import กลับ → ข้อมูลครบเหมือนเดิม
- **3.7 (S, ใหม่)** ธีม/สี — หน้าตั้งค่าเลือกธีมสำเร็จรูป (Linear Dark / สว่าง / คอนทราสต์สูง) + สีเน้น,
  จำค่าไว้ใน localStorage, สลับด้วย `data-theme` (โครงเตรียมไว้แล้วตั้งแต่ 1.2/1.5)
- **3.8 (M, ใหม่ v3)** AI Intake อัตโนมัติ — Supabase Edge Function ถือ `ANTHROPIC_API_KEY` ฝั่งเซิร์ฟเวอร์,
  รับรูป/ข้อความ → เรียก Claude vision อ่านลายมือไทย → คืน JSON + confidence รายช่อง → เขียนลง `intake_items`
  ```
  มือถือถ่ายรูป → Edge Function (ถือ key) → Claude vision → intake_items (staging)
                                                    ↓ sale เปิดดู แก้ไข กดอนุมัติ
                                          pending_projects / customers
  ```
  - **ทำหลัง 3.5** — 3.5 สร้างระบบ staging + preview + merge ให้ถูกต้องก่อน (ใช้วิธีก๊อปคำสั่งไปวางใน Claude เอง ฟรี ไม่มีค่า API)
    3.8 แค่เปลี่ยนว่า "JSON มาจากไหน" ส่วนที่เหลือใช้ของเดิมทั้งหมด
  - ⚠️ key ต้องอยู่ใน Supabase secrets เท่านั้น **ห้ามอยู่ใน repo หรือ frontend เด็ดขาด**


- **3.9 (M, ใหม่ 23 ก.ค. 2569)** ✅ **Export PDF ตามฟอร์มต้นฉบับ** — เจ้าของขอเอง พร้อมแนบไฟล์ฟอร์มกระดาษ 2 ชุด
  - พิมพ์ **Pending Project 2 หน้า** และ **Book 3 สี "Potential" 2 หน้า** ให้ตำแหน่งข้อมูลตรงกับกระดาษต้นฉบับ
  - ใช้ **สั่งพิมพ์ของเบราว์เซอร์ + print stylesheet** ไม่ใช้ library ทำ PDF
    (ภาษาไทยไม่เพี้ยน · ไม่ต้องฝังฟอนต์ · ไม่พึ่ง CDN ซึ่ง PWA ออฟไลน์ใช้ไม่ได้อยู่แล้ว)
  - `db/phase3-9.sql` เพิ่ม `pending_products` (**เพดาน 9 แถวบังคับที่ DB**), `result_because`, `customers.nickname`
  - 🔴 **ห้ามเปลี่ยนเพดาน 9 แถว** — มาจากจำนวนช่องในฟอร์มกระดาษ เกินแล้วตารางทะลุหน้า ฟอร์มเพี้ยนทั้งหน้า
  - Book 3 สี **เพิ่ม 2 ช่องที่กระดาษเดิมไม่มี** ตามที่เจ้าของสั่ง: ชื่อเล่น · หน่วยงาน/บริษัท

- **3.10 (L, ใหม่ 23 ก.ค. 2569)** ✅ **โครงสร้างทีมตาม org chart + สิทธิ์ลำดับชั้น + เป้ารายทีม** — เจ้าของขอเอง พร้อม org chart
  - **ช่วง A** (`db/phase3-10.sql`): `teams.parent_team_id` (IMP1/IMP2 เป็นทีมย่อยของ TE-IMP) · `profiles.title`
    - ⭐ `can_access_team()` ไล่ขึ้นทีมแม่ (recursive) — ให้สิทธิ์ทีมแม่ = เห็นทีมลูกทั้งหมด
    - 🔴 ปิดช่องโหว่ `can_edit` (ค้างมาตั้งแต่ 2.4) — เพิ่ม `can_edit_team()` แยก "ดู" ออกจาก "แก้"
    - หน้า Admin: ทีมลำดับชั้น · แผงสิทธิ์แยก ดู/แก้ · ปุ่มเห็นทั้งองค์กร · ช่องตำแหน่ง
  - **ช่วง B**: เป้ารายทีม (`team_targets`) ตั้งที่ทีมย่อย · หน้าภาพรวมมีตัวเลือกขอบเขต + กล่องสรุปรวม
    - เลือกดูเป้ารายทีม/กลุ่ม → รวมขึ้นเป็นทีมใหญ่/องค์กรอัตโนมัติ
  - **สรุปโครงสร้างสิทธิ์:** MD/Director/นันทวัน = manager + ติ๊ก "เห็นทั้งองค์กร" · IMP1/IMP2 = manager ทีมย่อยตัวเอง
## 📦 แผนอัปเดตอนาคต — ยังไม่ทำในรอบนี้

> ของในหัวข้อนี้ **ไม่อยู่ใน 22 step** ที่กำลังทำ · หยิบขึ้นมาทำเมื่อระบบหลักใช้งานจริงนิ่งแล้ว
> **ห้ามแอบดึงกลับเข้า roadmap เอง** ต้องให้เจ้าของโปรเจกต์เคาะก่อนเสมอ (กติกาเดียวกับ WishtoHave.md)

### แถบ Supplier (เดิม step 3.4 · B7 + F9)
_ถอดออกจากแผน 23 ก.ค. 2569 โดยเจ้าของโปรเจกต์ — "ยังไม่ต้องใช้ฟังก์ชันนี้"_

**สถานะตอนนี้:** ถอดออกจากหน้าจอหมดแล้ว (ปุ่มในแถบนำทาง · router · precache) และ
**ลบ `docs/js/modules/suppliers.js` ทิ้งแล้ว** ไม่ปล่อยไฟล์ placeholder ค้างไว้
(บทเรียนจาก `tools/import-json.html` ที่เคยค้างจนเจ้าของเปิดผิดไฟล์แล้วเข้าใจว่างานยังไม่เสร็จ)

**ยังไม่ได้แตะฐานข้อมูล** — ไม่มีตาราง suppliers ใน Supabase อยู่แล้ว จึงไม่มีอะไรต้อง migration
ตอนหยิบกลับมาทำก็เริ่มจากศูนย์ได้เลย ไม่มีหนี้ค้าง

**สเปคที่เก็บไว้ (ถ้าวันหนึ่งกลับมาทำ):**
- `suppliers` — ผู้ขาย / ผู้รับเหมา / วัสดุก่อสร้าง / วัตถุดิบ / บริการ พร้อมผู้ติดต่อ เรตติ้ง ราคา/เงื่อนไข
- `supplier_categories` — กลุ่มหลัก → กลุ่มย่อย เพิ่ม/แก้เองได้จากหน้าจอ
- แถบใหม่ในแอป กรองตามกลุ่มย่อยได้
- RLS ใช้ `can_access_team()` ตัวเดียวกับตารางอื่น

🚫 **ตัดออกถาวรแล้ว ไม่ต้องเสนอกลับ:** ตาราง `project_suppliers` และ **ปุ่มหา supplier จากหน้า Pending**
เจ้าของสั่งตัดตรง ๆ 23 ก.ค. 2569 — Supplier ถ้าทำ จะเป็นแถบเดี่ยว ๆ ไม่ผูกกับ Pending Project

---

## หมายเหตุการต่อยอด
- prototype เดิม (v3) เป็น artifact ชื่อ `pending-project-dashboard` บน claude.ai — ยก UI/ฟอร์ม/กราฟ/palette CVD-safe มาใช้ได้ ประหยัดเวลา (ถ้าเข้าถึงไม่ได้ ให้เจ้าของแนบไฟล์ HTML prototype มา)
- นามบัตร 11 รายถูก import จาก Obsidian ในระบบเดิมแล้ว (sale ธีระศักดิ์) — ต้องคง migrate มาด้วยใน step 1.6/2.1

---
## สถานะโครงการ
**ล่าสุด: 3.5 เสร็จ (AI Intake — staging + preview + ไฮไลต์ confidence + merge กันซ้ำ) — ถัดไป 3.6 Export/Backup**
🧩 คอมโพเนนต์ร่วม: `js/ui/datepicker.js` (ปฏิทินไทย) · `js/ui/loglist.js` (รายการบันทึก+แก้ไข)
   · `js/ui/signoff.js` (แถบลายเซ็น + ตรรกะ "ลายเซ็นค้าง")
   **ห้ามก๊อปโค้ดสองส่วนนี้ไปไว้ที่อื่น ให้ import ใช้** (เคยมีบั๊ก 2 ตัวในนั้น)
_1.7 ตรวจอัตโนมัติผ่าน 25/25 · เหลือทดสอบบนเครื่องจริง (iPhone/S24/iPad)_
🔎 ตรวจ SQL ก่อนส่งด้วย `libpg-query` (parser ตัวจริงของ PostgreSQL) — เครื่องนี้ไม่มี Postgres
📅 ทุกช่องวันที่ใช้ `docs/js/ui/datepicker.js` — **แสดง พ.ศ. · เก็บ ค.ศ.** ห้ามกลับไปใช้ `<input type="date">`
🕓 **"วันนี้" ต้องใช้ `todayISO()` จาก datepicker.js เท่านั้น** — `new Date().toISOString().slice(0,10)`
   คืนวันตาม UTC · ไทยเร็วกว่า 7 ชม. → ก่อน 07:00 น. จะได้ "เมื่อวาน" แล้วงานวันนี้ขึ้นเป็นเลยกำหนด
🔴 **`team_id` ว่าง = ทุกคนที่ไม่ใช่ admin แตะแถวนั้นไม่ได้** (`can_access_team()` คืน false)
   แก้แล้วทั้ง 3 ตาราง — adapter เติมทีมของผู้ใช้ให้เองผ่าน `fillTeam()`
🗄️ **งาน/ลูกค้าที่เก็บเข้าคลัง ต้องไม่ส่งเสียงเตือนอีก** — `bucketize()` ข้ามกิจกรรมที่งานแม่ `is_active=false`
   แต่ **ห้ามซ่อนเงียบ ๆ** ต้องบอกจำนวนที่ซ่อนเสมอ · ถ้าดึงงานแม่มาได้ `null` (RLS ซ่อน) ต้อง **ยังนับ**
🔗 **URL ที่ชี้ไปข้อมูลลูกค้า (เช่นลิงก์ Google Sheet) = ข้อมูลลูกค้า ห้าม commit**
   repo เป็น public · ถ้าชีตเปิดแบบ "ใครมีลิงก์ก็เข้าได้" การใส่ URL = ปล่อยข้อมูลออกทั้งชุด
   ให้เจ้าของกรอกเองจากหน้าจอ เก็บไว้ใน DB เท่านั้น
🔒 **ช่องที่ผู้ใช้กรอก URL ได้ ต้องกรอง `javascript:` ทั้งตอนบันทึกและตอนแสดงผล**
   + ลิงก์ออกนอกเว็บใส่ `rel="noopener noreferrer"` เสมอ
🔇 **error ใน async handler ไม่ยิง `pageerror`** — เป็น unhandled rejection
   เทสต์ทุกชุดต้องดัก `unhandledrejection` ด้วย ไม่งั้นฟอร์มไม่เปิดเลยแต่เทสต์บอกว่า "ไม่มี error"
🧪 **ทดสอบ RLS ด้วย Postgres จริงได้แล้ว** — PGlite (PG16 เป็น WASM) รันไฟล์ใน `db/` ตามลำดับจริง
   แล้วสลับ role ยิง query ดูว่าใครเห็นแถวไหน · **แก้ policy ทุกครั้งต้องรันชุดนี้ก่อน push**
⚠️ **การถูก RLS ปฏิเสธมี 2 หน้าตา ต้องดักทั้งคู่**
   ละเมิด `using` → 0 แถว **เงียบ ๆ ไม่มี error** · ละเมิด `with check` → โยน error 42501
   (ข้อความดิบเป็นอังกฤษ — `restError()` ใน supabase-adapter แปลงเป็นไทยแล้ว)
📄 รูปแบบไฟล์สำรองล็อกไว้แล้วใน `docs/js/data/import-map.js` (`BACKUP_FORMAT`) — step 3.6 ต้อง export ตามนี้
⚠️ 1.5 ไม่ได้ทำ `views.sql` — คำนวณฝั่งเบราว์เซอร์แทน (เหตุผลใน PROGRESS.md)
   ถ้าข้อมูลโตจนช้าค่อยย้ายไป view ได้โดยไม่ต้องแตะ UI
🧭 **สิทธิ์ "ดูทีมไหนได้" ต้องถามผ่าน `can_access_team()` เสมอ ห้ามเขียน `team_id = my_team_id()` เอง**
   step 2.4 เผลอเขียนมือใน `profiles_select` → หัวหน้าเห็น "งาน" ครบ 3 ทีม แต่เห็น "คน" แค่ทีมตัวเอง
   (แก้แล้วใน `db/phase3-2.sql`) · เขียนมือทีไร ตารางนั้นจะหลุดจากกติกากลางทันที
👁️ **RLS กรองแถวออกแบบเงียบ ๆ → หน้าจอห้ามแสดงผลเป็นเลข 0**
   เลข 0 อ่านว่า "ไม่มีข้อมูล" แต่ความจริงคือ "ไม่มีสิทธิ์เห็น" — ต้องขึ้นป้าย 🔒 แยกให้ชัด
   (ใช้แล้วในหน้าทีมขาย 3.2 · หลักการเดียวกับที่ 2.5 บังคับว่าห้ามซ่อนเงียบ ๆ)
📊 **กติกา "อะไรนับว่าปิดแล้ว" มีที่เดียว: `monthOf()` ใน `docs/js/modules/dashboard.js`**
   หน้าไหนต้องนับยอดปิดให้ import ไปใช้ ห้ามเขียนซ้ำ — สองหน้านิยามต่างกันเมื่อไหร่ ตัวเลขขัดกันเองทันที
📵 **ของที่ลอยทับเนื้อหาได้ (position: fixed/sticky) จะบังปุ่มจนกดไม่โดน**
   แถบแจ้งเตือน PWA เคยลอยมุมล่างแล้วกินคลิกของปุ่ม "แก้ไข" — เผื่อ padding ท้ายหน้าก็ยังไม่พอ
   → แถบแจ้งเตือนต้องอยู่ **บนสุดและอยู่ใน flow ปกติ** (`.pwabar`) · **ห้ามเปลี่ยนกลับเป็น fixed**
   ⭐ บั๊กชนิดนี้ `dispatchEvent` ไม่มีวันเจอ ต้องทดสอบด้วย `p.click()` ที่ hit-test จริงเท่านั้น
📱 **ระยะรอยบาก iPhone แยกเป็น 2 ตัวแปร ห้ามยุบรวม**
   `--safe-t-env` = ค่าดิบจากเครื่อง (ห้ามทับ) · `--safe-t` = ช่องที่ `pwa.js` สั่งเป็น 0 ตอนแถบโผล่
   ถ้าใช้ตัวเดียว แถบจะไปปิดตัวแปรที่ตัวเองใช้กันรอยบาก แล้วหัวแถบโดนนาฬิกาทับ
🧊 **แก้ไอคอน/ไฟล์ใน `SHELL` ของ sw.js แล้วต้อง bump `VERSION` ใน `docs/sw.js` ด้วย**
   ไม่งั้นเครื่องที่ติดตั้งไว้แล้วยังใช้ของเก่าจาก cache · และ **ห้ามใช้ `cache.addAll()`**
   (ไฟล์เดียว 404 = service worker ติดตั้งไม่สำเร็จทั้งชุด) ใช้ `add()` ทีละไฟล์ + catch
🖨️ **พิมพ์ฟอร์มใช้ print stylesheet ห้ามเปลี่ยนไปใช้ library ทำ PDF** — `docs/css/print.css` + `docs/js/ui/formprint.js`
   print.css เป็น**ข้อยกเว้นเดียว**ที่ hardcode `#000`/`#fff` ได้ เพราะฟอร์มต้องดำบนขาวเสมอแม้ธีมจอเป็นสีเข้ม
   และต้อง**ระบุ font-family เองใน print.css** ไม่พึ่ง app.css ไม่งั้นตัวอังกฤษออกมาเป็นตัวมีเชิง
📏 **ตาราง PRODUCT เพดาน 9 แถว = จำนวนช่องในฟอร์มกระดาษ** บังคับที่ DB (`check line_no between 1 and 9`)
   ไม่ใช่แค่ที่หน้าจอ · เกิน 9 แล้วตารางทะลุหน้ากระดาษ ฟอร์มเพี้ยนทั้งหน้า
🌳 **สิทธิ์ไล่ขึ้นทีมแม่แล้ว (`can_access_team` recursive)** — ให้สิทธิ์ทีมแม่ = เห็นทีมลูกทั้งหมด
   "ดู" (can_access_team) แยกจาก "แก้" (can_edit_team) · policy เขียนใช้ can_edit_team · อ่านใช้ can_access_team
🎯 **เป้าตั้งที่ทีมใบเท่านั้น · ทีมแม่/องค์กร = ผลรวม** (dashboard `sumScope`/`expandTeams`) ห้ามตั้งเป้าซ้ำที่ทีมแม่
🤖 **AI Intake (3.5): ข้อมูลลง staging (`intake_items`) ก่อนเสมอ ห้ามเขียนตารางจริงตรง ๆ**
   เขียนจริงตอน "บันทึกเข้าระบบ" ผ่าน `savePending`/`saveCustomer` ตัวเดิม (RLS ปกติ) แล้ว `approveIntake` ปิด draft→merged
   · แถว `status='merged'` + `target_id` + `approved_by` = ล็อกการนำเข้าในตัว (หลักฐานว่าอะไรมาจากเอกสารไหน ใครอนุมัติ)
🧮 **AI Intake dedup เทียบ "เลขล้วน" กับรายชื่อทั้งชุด ไม่ใช่ `search`** (`matchDuplicate` ใน ai-intake.js)
   เบอร์ที่เก็บมีขีด (081-234-5678) · ที่ AI อ่านมาไม่มีขีด → `ilike` ไม่เจอกัน ต้องดึงมาเทียบ `normDigits` ใน JS
📅 **AI คืน close_month/birthday เป็นปี พ.ศ. บ่อย → `buildPayload` แปลง ค.ศ. ให้อัตโนมัติ** (ช่วง 2400–2600 = พ.ศ. ลบ 543)
   ⚠️ regex `\d{4}-\d{2}` + check constraint ของ DB **ปล่อยปี พ.ศ. (2569) ผ่านหมด** ต้องดักที่ชั้นแอปก่อนบันทึก
_เสร็จแล้ว: 0.1 · 0.2 · 1.1–1.6 · 2.1–2.6 · 3.1 · 3.2 · 3.3 · 3.5 · 3.9 · 3.10 — ยังเหลือ 3 step: 3.6 · 3.7 · 3.8 (+1.7 ทดสอบเครื่องจริง)_
⚠️ ต้องรัน `db/phase3-5.sql` ใน Supabase — ไม่งั้นปุ่ม 🤖 AI Import วางผลแล้วบันทึก staging ไม่ได้ (ตาราง `intake_items` ยังไม่มี)
⚠️ ต้องรัน `db/phase3-9.sql` + `db/phase3-10.sql` ใน Supabase — ไม่งั้นตารางสินค้า/ทีมย่อย/เป้ารายทีมยังไม่มี
⏸️ **3.4 แถบ Supplier ถอดออกจากแผนแล้ว** (23 ก.ค. 2569) — ถอดจากหน้าจอ + ลบไฟล์ module ทิ้งแล้ว
   สเปคเก็บไว้ที่หัวข้อ "📦 แผนอัปเดตอนาคต" · **ห้ามดึงกลับเข้า roadmap เองโดยไม่ถามเจ้าของ**
⚠️ ต้องรัน `db/phase3-2.sql` ใน Supabase — ไม่งั้นแถบกลยุทธ์ยังไม่มีเนื้อหา และหน้าทีมขายเห็นสมาชิกแค่ทีมตัวเอง
⚠️ 1.4 ทดสอบด้วยโหมด local เท่านั้น — **ให้เจ้าของลองเพิ่มงานจริงบน Supabase เป็นอย่างแรก**
⚠️ ต้องรัน `db/policies.sql` ใน Supabase ซ้ำ 1 รอบ เพื่อให้ `pending_delete` = admin เท่านั้นมีผลจริง
_(เมื่อทำ step เสร็จ ให้อัปเดตบรรทัดนี้ เช่น "ล่าสุด: 1.3 เสร็จ, ถัดไป 1.4" แล้ว commit ไฟล์นี้)_
