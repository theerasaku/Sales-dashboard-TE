# autolog — บันทึกการเปลี่ยนแปลงอัตโนมัติ

> **ไฟล์นี้ Claude เขียนเอง** ทุกครั้งที่ทำงานเสร็จก่อนส่งคืนเจ้าของโปรเจกต์
> เป็นบันทึกว่า *"แตะอะไรไปบ้าง เมื่อไหร่ ทำไม"* — ไม่ใช่แผน ไม่ใช่คู่มือ

**แบ่งหน้าที่กับไฟล์อื่น (อย่าเขียนซ้ำกัน):**

| ไฟล์ | หน้าที่ | ใครเขียน |
|---|---|---|
| `CLAUDE.md` | แผน + กติกา + สเปค (ของถาวร) | แก้เมื่อสเปคเปลี่ยน |
| `PROGRESS.md` | รายละเอียดลึกรายไตล์ step — เหตุผลการตัดสินใจ ผลทดสอบเต็ม | ตอนปิด step |
| `autolog.md` | ไทม์ไลน์ทุกการเปลี่ยนแปลง เรียงใหม่→เก่า | **ทุกครั้งที่ทำงานเสร็จ** |
| `Workflow/index.html` | แผนผังภาพรวมว่าโมดูลไหนสร้างถึงไหน | ตอนสถานะรวมเปลี่ยน |

**รูปแบบ 1 รายการ** — สั้น อ่านแล้วรู้เรื่องทันที ไม่ต้องเปิดโค้ดดู:

```
## YYYY-MM-DD HH:MM · <commit hash หรือ "ยังไม่ commit"> · <หัวข้อ>
**step:** X.X | **ประเภท:** ฟีเจอร์ / แก้บั๊ก / เอกสาร / รีแฟกเตอร์
- ทำอะไร (บรรทัดละเรื่อง)
**ไฟล์:** path1 · path2
**ทดสอบ:** ผลจริง (เช่น "18/18 ผ่าน") หรือ "ยังไม่ทดสอบ — เหตุผล"
**ค้าง:** สิ่งที่ยังไม่จบ (ถ้าไม่มี ตัดบรรทัดนี้ทิ้ง)
```

---

<!-- ⬇️ เพิ่มรายการใหม่ใต้บรรทัดนี้ (ใหม่สุดอยู่บน) ⬇️ -->

## 2026-07-24 07:43 · ยังไม่ commit · Book 3 สี พิมพ์ = สามเหลี่ยมมุมสีตามระดับ (แทนแถว "สีในสมุด")
**step:** — (เจ้าของขอ) | **ประเภท:** ฟีเจอร์ (พิมพ์ฟอร์ม)
- ฟอร์ม Potential (Book 3 สี) เพิ่ม **สามเหลี่ยมมุมขวาบนสีตามระดับ** (green #1f9d55 · yellow #e3b000 · red #e23b3b) แทนแถว "สีในสมุด" ที่ตัดออก
  - SVG `<polygon points="0,0 100,0 100,100">` 42mm (20% ของ A4) · สีอยู่ใน print.css (ไฟล์ข้อยกเว้น) · `print-color-adjust:exact`
- **`@page{margin:0}`** (เดิม 12mm 10mm) → ย้ายระยะขอบไป padding บน `.pf-page` (12mm 10mm) · `.pf-page-potential` = 14mm 13mm ตามสเปก → มุมสีชิดขอบกระดาษจริงได้
  - รูป/หัว/เนื้อหาจัดใหม่แบบ absolute: `.pf-corner` (top:0,right:0) · `.pf-photo-abs` (top:34mm) · `.pf-frm{margin-top:46mm}` → ไม่ทับกัน
- ปุ่มพิมพ์ Book 3 เพิ่ม tooltip เตือน "ตั้ง Margins: None + Background graphics"
- bump v0.23.0
**ไฟล์:** docs/js/ui/formprint.js · docs/css/print.css · docs/js/modules/book3.js · docs/js/config.js · docs/sw.js
**ทดสอบ:** Book3 PDF **7/7** + **render PDF จริงดูแล้ว** ตรงกับรูปเป้าหมายเป๊ะ (สามเหลี่ยมเขียวชิดมุม · รูปไม่ทับ · ตัดแถวสีออก · ฟิลด์ครบ) · **Pending PDF render ดูแล้ว margin:0 ไม่พัง** (ทุกช่องตรง) · regression success-miss 14 · feat 14 (sign-off PDF) ผ่าน
**หมายเหตุ:** มุมสีชิดขอบต้องตั้ง Margins: None ตอนพิมพ์ (browser default margin จะทับ @page)

## 2026-07-24 07:11 · ยังไม่ commit · เพิ่มธีมจาก Claude design — noir + brown
**step:** — (เจ้าของส่ง design มา) | **ประเภท:** ฟีเจอร์ (ธีม)
- เจ้าของส่งไฟล์จาก Claude design 3 ไฟล์ · ตัวที่ใช้ได้จริง = `te-theme.css` (สกินสำหรับแอปนี้โดยตรง 2 ธีม noir/brown · ใช้ชื่อตัวแปร CSS ตรงกับระบบเดิมทุกตัว)
  - support.js/ds-base.js = runtime ของ Design Component ไม่เกี่ยวกับแอปเรา → ไม่ใช้
- ผนวก `[data-theme="noir"]` (ม่วงเข้ม accent #9184d9) + `[data-theme="brown"]` (น้ำตาลกระดาษ) เข้า app.css + เพิ่มในปุ่ม 🎨 (theme.js THEMES)
  - ⚠️ **ตัด `@import` Google Fonts ออก** (CLAUDE.md ห้าม CDN — PWA ออฟไลน์พัง) · `--font` ตั้งชื่อฟอนต์ไว้เป็นตัวเลือก มี system fallback
  - ตัด `.te-nav/.te-seg` (คลาสของ design เอง ใช้ data-on ที่แอปไม่มี) — nav active ของแอปใช้ --accent-soft/--accent-text ตามธีมอยู่แล้ว
  - สีเน้นที่ผู้ใช้เลือกเอง (data-accent) ทับ accent ของธีมได้ · ผู้ใช้ค่าตั้งต้น (indigo) จะได้สีของธีม (noir=ม่วง)
- bump v0.22.0
**ไฟล์:** docs/css/app.css · docs/js/ui/theme.js · docs/js/config.js · docs/sw.js
**ทดสอบ:** ธีม **18/18** (puppeteer local: 5 ธีม · สลับ noir/brown ได้ · noir accent ม่วง · reload จำได้) · ดูภาพ noir จริงแล้ว สวยตามดีไซน์ layout ไม่แตก
**หมายเหตุ:** ถ้าอยากได้ฟอนต์ Inter จริง (ไม่ใช่ fallback) ต้อง bundle .woff2 ลง repo ทีหลัง (กัน CDN)

## 2026-07-24 07:01 · ยังไม่ commit · ลบถาวร + เป้ารวมทีม + ประวัติการเซ็น (timeline+PDF) + 🔴กู้ sw.js
**step:** 3.11 (เจ้าของขอ 4 เรื่อง) | **ประเภท:** ฟีเจอร์ + แก้บั๊ก
- **🔴 กู้ `docs/sw.js` ที่ถูก commit เป็นไฟล์ว่างมาตั้งแต่ 3.8** — ต้นเหตุ python one-liner `open(x,'w').write(open(x).read()...)` (truncate ก่อน read) · SW ว่าง 4 commit → PWA offline/แถบเวอร์ชันพัง (แอปยังเปิดได้ เพราะ register SW ล้มแบบ catch) · กู้จาก ffb8e83 (116 บรรทัด) + bump v0.21.0 · **ต่อไปใช้ sed เท่านั้น ห้าม python inline write**
- **#1 ลบถาวร**: `db/phase3-11.sql` เปลี่ยน policy pending_delete/cust_delete = `is_admin() or (not is_active and can_edit_team(team_id))` → ลบถาวรได้เฉพาะที่ archive แล้ว (2 ขั้น: เก็บคลัง→ลบ) · งาน active ลบไม่ได้ยกเว้น admin
  - adapter +deleteCustomer · ปุ่ม "🗑 ลบถาวร" ในโมดัล Pending+Book3 (โผล่เฉพาะ archived · กด 2 ครั้งยืนยัน)
- **#3+#4 เป้ารายทีม**: ทีมแม่ (TE-IMP) แสดงผลรวมทีมย่อยอัตโนมัติ + กล่อง "รวมทั้งองค์กร" · คิดสด ๆ ตอนพิมพ์ (recomputeTT)
- **#5 ประวัติการเซ็น timeline**: adapter +listSignoffHistory · signoff.js +signoffHistoryHtml/bindSignoffHistory (🔖 วันที่+ผู้ตรวจ ขยายดูคอมเมนต์ได้) แสดงในโมดัล Pending+Book3 ใกล้บันทึกกิจกรรม · **PDF แทรก sign-off ในไทม์ไลน์** (formprint mergeLogsWithSignoffs — เห็นคอมเมนต์ต่อท้ายวันที่)
- **#2 (คำถาม design)** ตอบในแชต ไม่แตะโค้ด
**ไฟล์:** db/phase3-11.sql · docs/js/data/{adapter,supabase-adapter,local-adapter}.js · docs/js/ui/{signoff,formprint}.js · docs/js/modules/{pending,book3,admin}.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** ฟีเจอร์ใหม่ **14/14** (puppeteer local: ลบถาวร 2 ขั้น/เฉพาะ archived · TE-IMP=60 org=100 · ประวัติเซ็น+ขยายคอมเมนต์ · PDF มี sign-off) · delete RLS **7/7** (Postgres จริง: sale ลบ archived ทีมตัวเองได้/active+ทีมอื่นไม่ได้/admin ได้หมด) · regression: success-miss 14 · fix2 13 · intake-ui 27 · bk 12 ผ่านหมด · parity 58 · SQL parse 14/14
**ค้าง:** **เจ้าของต้องรัน `db/phase3-11.sql`** ก่อน ปุ่มลบถาวรถึงจะทำงานบน Supabase

## 2026-07-24 04:53 · ยังไม่ commit · แก้ 2 เรื่องที่เจ้าของแจ้ง — เมนูตั้งค่า(manager) + Archive กรองเดือน
**step:** — (แก้ตามที่เจ้าของแจ้ง) | **ประเภท:** แก้บั๊ก/ปรับ UX
- เจ้าของแจ้ง: รัน `db/phase3-5.sql` แล้ว (ผ่าน 5/5) → AI Intake staging พร้อม
- **เมนู "ตั้งค่าระบบ" ให้ admin + หัวหน้างานเห็น** (เดิม admin เท่านั้น):
  - app.js paintUser: `[data-view="admin"]` โชว์เมื่อ admin หรือ manager
  - admin.js: manager เห็นเฉพาะ "เป้ารายทีม" (แก้ทีมตัวเองได้ตาม can_edit_team) · ซ่อน เป้ายอดขายรวม/ผู้ใช้/ทีม/สำรอง (admin เท่านั้น) · handler admin-only ใส่ `?.` กันพังตอน element ไม่มี
- **Archive: badge=1 แต่ลิสต์ว่าง** — ต้นเหตุ: งาน archived จริง 1 งาน (ไม่มี close_month) ถูก "ตัวกรองเดือน" ที่ค้างจาก view active ซ่อน
  - แก้: `status='archived'` → ไม่ส่ง from/to (งานจบแล้ว เดือนคาดปิดไม่มีความหมาย) · ปิด(disabled)ดรอปดาวน์เดือน+ปุ่ม preset ตอนดู Archive
  - `refreshArcBadge()` เรียกทุก reload (เดิมนับครั้งเดียวตอน render → กดเก็บ/ปลุกกลับเลขไม่ตาม)
- bump v0.20.0
**ไฟล์:** docs/js/app.js · docs/js/modules/admin.js · docs/js/modules/pending.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** เมนู+Archive **13/13** (puppeteer local: admin/manager/sale เห็นเมนูถูก · manager เห็นแค่เป้ารายทีม · sale โดนบล็อก · Archive แสดงงานแม้ตั้งกรองเดือน · badge ตรงลิสต์ · ดรอปดาวน์เดือนปิดตอน Archive) · success-miss ซ้ำ 14/14 ไม่ regression · parity 56

## 2026-07-23 22:27 · ยังไม่ commit · 3.8 AI Intake อัตโนมัติ — Edge Function + อ่านรูปด้วย Claude vision
**step:** 3.8 (จบ roadmap!) | **ประเภท:** ฟีเจอร์ (Edge Function + frontend)
- `supabase/functions/ai-intake/index.ts` (ใหม่ · Deno): ถือ `ANTHROPIC_API_KEY` ฝั่งเซิร์ฟเวอร์ →
  รับรูป/ข้อความ → เรียก Claude vision (อ่านลายมือไทยได้) → คืนข้อความ JSON · ตรวจ JWT ก่อน (กันคนนอกใช้ key ฟรี) · CORS ครบ
  - 🔒 ไม่มีค่า key ในไฟล์เลย — อ่านจาก Deno.env · deploy: `supabase functions deploy ai-intake --no-verify-jwt` + `supabase secrets set ANTHROPIC_API_KEY=...`
  - README คู่มือ deploy ครบ · โมเดลตั้งต้น claude-sonnet-5 (เปลี่ยนได้ด้วย secret AI_INTAKE_MODEL)
- adapter +1 เมธอด `aiExtract(payload)`: supabase = POST ไป Edge Function (token อยู่ใน adapter UI ไม่แตะ) · local = คืน demo stub ให้ทดสอบ flow
- `ai-intake.js`: ปุ่ม "📷 ให้ AI อ่านรูป" ในโมดัล → ย่อรูป(≤1600px)→base64→aiExtract→แกะด้วย parsePasted เดิม→พัก staging
  - ⭐ 3.8 เปลี่ยนแค่ "JSON มาจากไหน" · staging/preview/merge/confidence ใช้ของ 3.5 ทั้งหมด (refactor เป็น stageRecords ใช้ร่วม)
  - ไม่ deploy ก็ยังใช้ได้ — ตกไปทางก๊อปคำสั่งวางเอง (3.5) ฟรี · ถ้า Edge Function ไม่มีขึ้น 404 บอกให้ใช้ทางสำรอง
- CSS auto-read (var ล้วน) · bump v0.19.0
**ไฟล์:** supabase/functions/ai-intake/{index.ts,README.md} · docs/js/data/{adapter,supabase-adapter,local-adapter}.js · docs/js/modules/ai-intake.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** auto-read **9/9** (puppeteer local: อัปโหลดรูป→demo→staging→บันทึกเข้า pending จริง · ไฮไลต์ confidence · ไม่มี JS error) · parity 56 ครบ · intake-ui ซ้ำ 27/27 ไม่ regression · ไม่มี key/hex รั่ว · Edge Function ตรวจสายตา (ไม่มี deno ในเครื่อง)
**ค้าง:** **เจ้าของต้อง deploy Edge Function + ตั้ง `ANTHROPIC_API_KEY`** (ดู README) ปุ่มอ่านรูปถึงจะใช้ของจริงได้ · ยังไม่ทดสอบเรียก Claude จริง

## 2026-07-23 22:18 · ยังไม่ commit · 3.7 ธีม/สี — Dark / สว่าง / คอนทราสต์สูง + สีเน้น 5 สี
**step:** 3.7 | **ประเภท:** ฟีเจอร์ (ธีม)
- `docs/js/ui/theme.js` (ใหม่): เลือกธีม 3 แบบ + สีเน้น 5 สี · จำใน localStorage · สลับด้วย `data-theme`/`data-accent` บน `<html>`
  - ⭐ ไม่มี hex ในไฟล์นี้เลย — แค่สลับ attribute · ค่าสีจริงอยู่ใน app.css ที่เดียว (ตามกติกา)
- app.css: `[data-theme="light"]` · `[data-theme="contrast"]` (ดำสนิท) + `[data-accent="blue/teal/amber/rose"]`
  - `--accent-soft`/`--accent-text` เปลี่ยนมา derive จาก `--accent` + `--text` (color-mix) → เปลี่ยนสีเน้น/ธีมทีเดียว ตามหมด
  - swatch ในหน้าเลือกธีม preview ด้วย data-theme/data-accent + var() (ไม่ hardcode สีตัวอย่าง)
- index.html: สคริปต์ inline ใน `<head>` อ่าน localStorage ตั้ง data-theme ก่อน CSS วาด → กันจอกระพริบ dark→light + ปุ่ม 🎨 ในแถบบน
- app.js: import theme.js · applyTheme() ตอน boot · ผูกปุ่ม 🎨
- เพิ่ม theme.js ใน sw SHELL · bump v0.18.0
**ไฟล์:** docs/js/ui/theme.js · docs/css/app.css · docs/index.html · docs/js/app.js · docs/sw.js · docs/js/config.js
**ทดสอบ:** ธีม **15/15** (puppeteer โหมด local: สลับ 3 ธีม + 5 สีเน้น · พื้นเปลี่ยนจริง (light=rgb(245..) · contrast=ดำสนิท) · reload แล้วจำได้ (ไม่กระพริบ) · ไม่มี JS error) · ดูภาพธีมสว่างแล้ว คอนทราสต์ดี ไม่มีอะไรแตก · parity 55 · ไม่มี hex ใน JS

## 2026-07-23 22:09 · ยังไม่ commit · 3.6 Export / Backup รวมทุกตาราง + กู้คืน
**step:** 3.6 | **ประเภท:** ฟีเจอร์ (backup ครบระบบ + วงจรกู้คืน)
- adapter (3 ไฟล์) +2 เมธอด: `exportAll()` (ดึงทุกตาราง) · `restoreBackup(tables)` (เขียนกลับ upsert ตาม id)
  - supabase: export = select=* ทุกตาราง (RLS ทำงาน · admin ได้ทั้งระบบ) · restore = upsert ตามลำดับ FK · ข้าม profiles/team_access/signoffs (auth/append-only)
  - local: dump/replace db arrays ครบ
- หน้า Admin: ส่วน "สำรอง & กู้คืน" — ปุ่มดาวน์โหลด `te-backup-YYYY-MM-DD.json` (ผ่าน `buildBackup` = BACKUP_FORMAT ที่ 1.6 อ่านได้) + อัปโหลดกู้คืน (ยืนยัน 2 ขั้น) + รูทีนรายสัปดาห์
- รูปแบบไฟล์ล็อกไว้ที่ `import-map.js` (`_format:'te-sales-dashboard-backup', _version:1, tables:{}`)
**ไฟล์:** docs/js/data/{adapter,supabase-adapter,local-adapter}.js · docs/js/modules/admin.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** วงจร backup **12/12** (puppeteer โหมด local: export ทุกตาราง → ล้าง → restore → pending/customer/ผู้ติดต่อ/บันทึกกลับครบ · summary ถูก · UI admin มีปุ่ม) · parity 55 ครบ · ไม่มี secret/hex · bump v0.17.0
**ค้าง:** supabase restore ออกแบบสำหรับกู้ "โปรเจกต์เดิม" (teams/profiles ยังอยู่) — ยังไม่ทดสอบบน Supabase จริง

## 2026-07-23 21:56 · ยังไม่ commit · ปุ่ม Success/Miss + ติ๊ก PDF + เสริม error ลิงก์ลืมรหัสผ่าน
**step:** — (เจ้าของขอเพิ่ม จาก WishtoHave) | **ประเภท:** ฟีเจอร์ + แก้บั๊ก (UX)
- เจ้าของแจ้ง: **รัน `db/phase3-5.sql` แล้ว** (ผ่าน 5/5 · intake_items + RLS + anon ปิด) → AI Intake staging พร้อมใช้
- **ปุ่ม Success / Miss** ในฟอร์ม Pending (ด้านล่าง เหนือปุ่มบันทึก):
  - กด Success = ตั้ง stage=won + **เติม purchased_day=วันนี้** (todayISO) ถ้ายังว่าง → นับเข้าเป้า 80 ล้านได้จริง
  - กด Miss = ตั้ง stage=lost · ทั้งคู่บันทึกทั้งฟอร์ม (คงค่าที่แก้อื่น + ช่อง "เพราะ" result_because) แล้วปิด+reload
  - ปุ่มไฮไลต์ตาม stage ปัจจุบันตอนเปิดฟอร์ม · ช่อง result_because เพิ่มในฟอร์ม (เดิม PDF มีช่องนี้แต่กรอกไม่ได้)
- **ติ๊กบน PDF**: RESULT row เดิม (S ✓ / M ✓ ตาม stage) → ทำเป็น checkbox ชัด `[✓] Success (ได้งาน)` · `[ ] Miss` + BECAUSE · `.pf-box` ใน print.css (#000 ตามกติกา)
- **ลืมรหัสผ่านเด้ง 404**: จากภาพ ลิงก์ในเมลเด้งไป `theerasaku.github.io/` (root) แทน `/Sales-dashboard-TE/`
  → **ต้นเหตุคือ config Supabase** (Redirect URL/Site URL) ไม่ใช่บั๊กโค้ด · redirect_to ในโค้ดถูกแล้ว (`origin+pathname`)
  → เสริมโค้ด: `readHashError()` ใน app.js อ่าน `#error=...` ที่ Supabase แนบมาตอนลิงก์หมดอายุ → ขึ้นข้อความไทยชัด ๆ แทนหน้า login เงียบ ๆ
- bump v0.16.0 (config + sw)
**ไฟล์:** docs/js/modules/pending.js · docs/js/ui/formprint.js · docs/css/print.css · docs/css/app.css · docs/js/app.js · docs/js/config.js · docs/sw.js
**ทดสอบ:** Success/Miss + PDF **14/14** (puppeteer คลิกจริง: won เติม purchased_day/lost ไม่เติม · PDF ติ๊กถูก · result_because บันทึก · ไม่มี JS error) · intake-ui ซ้ำ 27/27 ไม่ regression
**ค้าง:** **เจ้าของต้องแก้ Supabase → Authentication → URL Configuration:** Site URL = `https://theerasaku.github.io/Sales-dashboard-TE/` + Redirect URLs เพิ่ม `https://theerasaku.github.io/Sales-dashboard-TE/**` (มี `/**`) ไม่งั้นลิงก์ลืมรหัสผ่านยังเด้ง 404

## 2026-07-23 21:38 · ยังไม่ commit · 3.5 AI Intake — staging + preview + merge (งานใหญ่ L)
**step:** 3.5 | **ประเภท:** ฟีเจอร์ (โมดูลใหม่ + ตารางใหม่ + ปุ่ม 2 แถบ)
- **DB `db/phase3-5.sql`** — ตาราง `intake_items` (staging): source · target_type · parsed/edited/confidence (jsonb) · status(draft/approved/merged/rejected) · target_table/target_id/merge_mode · approved_by
  - RLS: อ่าน `can_access_team` · เขียน/ลบ `can_edit_team` (sale เห็น/แก้เฉพาะทีมตัวเอง · หัวหน้าตามสิทธิ์ · anon ปิด)
  - ⭐ ตารางนี้เป็น "ล็อกการนำเข้า" ในตัว — แถว merged + target_id + approved_by = หลักฐานว่าอะไรมาจากเอกสารไหน ใครอนุมัติ
- **adapter (3 ไฟล์)** +6 เมธอด: listIntake/getIntake/saveIntake/deleteIntake/approveIntake/rejectIntake (parity 53 ครบทั้งคู่)
- **`docs/js/modules/ai-intake.js`** (จากสตับ → เต็ม) — modal 2 แท็บ:
  - นำเข้าใหม่: เลือกแหล่ง (นามบัตร/ฟอร์ม/Obsidian/Notion) → คำสั่งสำเร็จรูป(ก๊อป) → วาง JSON → พักเข้า staging
  - รอตรวจ: การ์ดต่อรายการ · ไฮไลต์เหลืองเฉพาะช่องที่ AI มั่นใจ <80% · dedup กันซ้ำ (เลือกอัปเดตทับ/สร้างใหม่) · บันทึกเข้าระบบจริง
  - แกะ JSON ทน code fence / ข้อความห่อ / object แบน · แปลงปี พ.ศ.→ค.ศ. อัตโนมัติ · value_baht ตัดคอมมา
- **ปุ่ม 🤖 AI Import** เพิ่มในแถบ Pending + Book 3 สี · **CSS** บล็อกใหม่ (var() ล้วน) · **bump v0.15.0** (config + sw)
**ไฟล์:** db/phase3-5.sql · docs/js/data/{adapter,supabase-adapter,local-adapter}.js · docs/js/modules/{ai-intake,pending,book3}.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** SQL parse 13/13 (libpg-query) · intake RLS 24/24 (PGlite = Postgres จริง) · UI 27/27 (puppeteer คลิกจริง โหมด local · dedup/ปี พ.ศ./staging ข้ามครั้ง/แยกผู้ติดต่อ · ไม่มี JS error + unhandled rejection) · parity 53 ครบ · grep secret/hex/PII ผ่าน
**เจอบั๊กระหว่างทำ (แก้แล้ว):** ① dedup เดิมใช้ `search` ilike → เบอร์มีขีดไม่ match เบอร์ไม่มีขีด · เปลี่ยนเป็นดึงทั้งชุดเทียบเลขล้วน  ② regex/DB constraint ปล่อยปี พ.ศ. 2569 ผ่าน → เพิ่มแปลง พ.ศ.→ค.ศ. ใน buildPayload
**ค้าง:** ยังไม่ทดสอบบน Supabase จริง — **เจ้าของต้องรัน `db/phase3-5.sql` ก่อน** แล้วลองปุ่ม 🤖 AI Import (วาง JSON จาก Claude) · 3.8 จะเปลี่ยนที่มา JSON เป็น Edge Function (staging/preview/merge ใช้ของนี้ต่อ)

## 2026-07-23 · ยังไม่ commit · 🔴 แก้บั๊ก login พังทั้งระบบ — "more than one relationship" profiles↔teams
**step:** — (hotfix) | **ประเภท:** แก้บั๊ก 🔴 login ใช้ไม่ได้ทั้งระบบ
- **อาการ:** login แล้วเด้ง error `Could not embed because more than one relationship was found for 'profiles' and 'teams'`
- **ต้นเหตุ:** `fetchProfile()` ดึง profile ด้วย embed `teams(code,name)` แบบไม่ระบุ FK
  ตั้งแต่มีตาราง **`team_access`** (2.4, profile_id×team_id) และ **`team_targets`** (3.10, team_id→teams + updated_by→profiles)
  PostgREST เห็นความสัมพันธ์ profiles↔teams **มากกว่า 1 เส้น** (เส้นตรง `profiles.team_id` + เส้นผ่าน junction) → embed ไม่ถูก
- **แก้:** ระบุ FK ให้ชัด `teams!team_id(code,name)` ทั้ง 2 จุด (`fetchProfile` + `listProfiles`)
  — junction ไม่คั่น `pending_projects`/`customers` → teams เลย 2 จุดนั้นไม่ต้องแก้

**ไฟล์:** `docs/js/data/supabase-adapter.js` (บรรทัด ~167 + ~948)
**ทดสอบ:** `node --check` ผ่าน · grep ยืนยันไม่เหลือ `profiles…teams(` แบบไม่ระบุ FK ที่อื่น ·
⚠️ **ยังไม่ได้ทดสอบ login จริงบน Supabase** (ผู้ช่วยไม่มีรหัสผ่าน) — เจ้าของต้องลอง login ยืนยัน
**ค้าง:** 🔴 **ยังไม่ commit โดยตั้งใจ** — ไฟล์นี้มีงาน B9 AI Intake (step 3.5) ของอีก session ค้างอยู่ +90 บรรทัด
ในไฟล์เดียวกัน + มี `db/phase3-5.sql` ยัง untracked · commit ตอนนี้จะกวาดงาน 3.5 ที่ยังไม่เสร็จติดไปด้วย
→ ปล่อยให้ไหลไปกับ commit ปกติของ session ที่ทำ 3.5 · **การแก้อยู่บนดิสก์แล้ว มีผลทันทีเมื่อ reload**

## 2026-07-23 07:40 · 60aee7b · ลืมรหัสผ่าน (รีเซ็ตทางอีเมล) + วินิจฉัย login เครื่องอื่น
**step:** 3.11 (ใหม่ · เจ้าของขอ) | **ประเภท:** ฟีเจอร์ + ความปลอดภัย
- เจ้าของแจ้ง: รัน phase3-9 + phase3-10 แล้ว (ผ่านครบ) · admin login จากแล็ปท็อปอื่นไม่ได้แม้รหัสถูก
- **เพิ่มฟังก์ชันลืมรหัสผ่าน** ในหน้า login:
  - ลิงก์ "ลืมรหัสผ่าน?" → ฟอร์มกรอกอีเมล → `POST /auth/v1/recover` (Supabase ส่งเมล)
  - กดลิงก์ในเมลกลับมา (มี `#type=recovery&access_token=…` ใน URL) → ฟอร์มตั้งรหัสใหม่ →
    `PUT /auth/v1/user` ด้วย recovery token → ลบ token ออกจาก URL หลังตั้งเสร็จ
  - 🔒 ไม่บอกว่า "อีเมลนี้ไม่มีในระบบ" — กันไล่เดาบัญชี (Supabase คืน 200 เสมอ เราแสดงข้อความเดียวกันหมด)
- adapter: +requestPasswordReset · readRecoveryToken · updatePassword (ทั้ง supabase + local stub)
- bump v0.14.0
**เรื่อง login เครื่องอื่น (วินิจฉัย):** โค้ดแปล error ของ Supabase เป็นไทยอยู่แล้ว
  ("อีเมลหรือรหัสผ่านไม่ถูกต้อง" / "ยังไม่ได้ยืนยันอีเมล") → เดาว่ารหัสที่ตั้งไว้ไม่ตรง
  (แล็ปท็อปเครื่องแรกอาจล็อกอินผ่านลิงก์เชิญ ไม่เคยพิมพ์รหัสจริง) — ปุ่มลืมรหัสรีเซ็ตให้รู้แน่นอน
  ⚠️ ต้องตั้ง Redirect URL ใน Supabase → Authentication → URL Configuration (ใส่ URL GitHub Pages)
**ไฟล์:** docs/index.html · docs/js/app.js · docs/js/data/{supabase,local,}adapter.js · docs/css/app.css · docs/sw.js · docs/js/config.js
**ทดสอบ:** flow ลืมรหัส **15/15** (ลิงก์→ฟอร์ม · ส่งแล้วไม่บอกว่าอีเมลมีจริง · พาร์ส hash recovery ·
validation รหัสสั้น/ไม่ตรงกัน · ตั้งเสร็จเด้งกลับ · มือถือไม่ล้น) · supabase readRecoveryToken พาร์ส token จริงถูก ·
login เดิมยังทำงาน (ทุกชุดที่ต้องล็อกอินก่อนผ่านหมด) — regression รวม **626 ข้อ**
**ค้าง:** เจ้าของต้องตั้ง Redirect URL ใน Supabase ก่อน ลิงก์ในเมลถึงจะเด้งกลับแอปได้

## 2026-07-23 06:40 · 2ddd002 · step 3.10 ช่วง B — เป้ารายทีม + ตัวเลือกใน dashboard
**step:** 3.10 (ช่วง B) | **ประเภท:** ฟีเจอร์
- ตั้งเป้ารายทีมที่หน้า "ตั้งค่าระบบ" (กรอกล้านบาท เก็บเป็นบาท) — ช่องเป้าทีมแม่ล็อกไว้ = ผลรวมทีมย่อย
- หน้าภาพรวมเพิ่มส่วน **"เป้าหมายตามทีม"**:
  - ตารางรายทีมแบบลำดับชั้น (ทีมย่อยเยื้อง · ทีมแม่โชว์ยอดรวมลูก)
  - ชิปเลือกขอบเขต (ทั้งองค์กร / รายทีม / เลือกหลายทีมเป็นกลุ่ม)
  - กล่องสรุปรวม: เป้า · ปิดได้ · % · ยังขาด ของกลุ่มที่เลือก — อัปเดตทันทีที่คลิก
- ⭐ `expandTeams()` ขยายทีมที่เลือก → รวมทีมลูก · งาน 1 ชิ้นมี team_id เดียว **นับครั้งเดียว** แม้เลือกทั้งแม่และลูก
- ⭐ `sumScope()` เป้า = ผลรวมเป้าทุกทีมในขอบเขต · ปิดได้รวมงานที่ผูกทีมแม่ตรง ๆ ด้วย (ไม่ตกหล่น)
- adapter: +listTeamTargets/saveTeamTarget (ทำไว้แล้วตอนช่วง A)
- bump v0.13.1
**ไฟล์:** docs/js/modules/dashboard.js · docs/js/modules/admin.js · docs/css/app.css · docs/js/config.js · docs/sw.js
**ทดสอบ:** ตรรกะเป้ารายทีม **15/15** (รวม "เลือกกลุ่มหลายทีม" · "งานผูกทีมแม่ไม่ตกหล่น" ·
"นอกช่วงเป้าไม่นับ") · UI จริง **20/20** (ชิปเปลี่ยนกล่องสรุปทันที · บันทึกเป้าทีม · มือถือไม่ล้น) ·
regression เดิมครบทุกชุด — **รวม 596 ข้อ**
**หมายเหตุ:** ปิด step 3.10 ครบทั้ง 2 ช่วงแล้ว · หน้าทีมขาย (แถบแหล่งงาน) การ์ดทีมแม่ยังไม่รวมยอดลูก
— เป็นของแถม ทำทีหลังได้ (dashboard เป็นที่หลักที่รวมให้แล้ว)

## 2026-07-23 05:30 · 5d07588 · step 3.10 ช่วง A — โครงสร้างทีมตาม org chart + สิทธิ์
**step:** 3.10 (ใหม่ · เจ้าของขอเอง พร้อม org chart) | **ประเภท:** ฟีเจอร์ + ความปลอดภัย
- เจ้าของเคาะ 23 ก.ค. 2569: IMP1/IMP2 เป็นทีมจริง · TE-IMP เป็นกลุ่มแม่ · เป้าตั้งระดับทีม
- `db/phase3-10.sql` — `teams.parent_team_id` (self-ref) · seed IMP1/IMP2 ใต้ TE-IMP ·
  `profiles.title` (ตำแหน่งตาม org chart) · ตาราง `team_targets` (ใช้ช่วง B)
- ⭐ **can_access_team() เพิ่มการไล่ขึ้นทีมแม่ (recursive) — จุดเดียวที่แก้ ทั้งระบบตามหมด**
  ให้สิทธิ์ TE-IMP = เห็น IMP1+IMP2 อัตโนมัติ · หัวหน้าแผนกอื่น/นันทวันเห็น IMP ได้
- 🔴 **ปิดช่องโหว่ can_edit ที่ค้างมาตั้งแต่ 2.4** — team_access มีคอลัมน์ can_edit แต่ไม่เคยมี policy ใช้
  → เพิ่ม `can_edit_team()` + เปลี่ยน policy ฝั่งเขียนทั้งหมดให้ใช้ (pending/customers/activities/
  logs/contacts/products) · แยก for-all ของ contacts/products เป็น select(view) + write(edit)
  ผล: หัวหน้าที่ได้สิทธิ์ "ดูอย่างเดียว" IMP เห็นงานได้ แต่แก้ไม่ได้
- adapter: setTeamAccess รับ can_edit รายทีม · listTeams คืน parent_team_id · +team_targets methods
- หน้า Admin: ทีมแสดงลำดับชั้น (ทีมย่อยเยื้อง) · เพิ่มทีมเลือกทีมแม่ได้ ·
  แผงสิทธิ์แยกคอลัมน์ "ดู"/"แก้" + ปุ่ม "เห็นทั้งองค์กร" · ช่องกรอกตำแหน่งรายคน
- bump v0.13.0
**ไฟล์:** db/phase3-10.sql · docs/js/modules/admin.js · docs/js/data/{supabase,local,}adapter.js ·
docs/css/app.css · docs/sw.js · docs/js/config.js
**ทดสอบ:** RLS จริงบน PGlite **96/96** (เดิม 80 — เพิ่ม 16 เคส: ไล่ทีมแม่ · can_edit gate ·
sale ทีมตัวเองไม่กระทบ · view แยกจาก edit · team_targets) · หน้า Admin จริง **17/17** ·
regression เดิมครบ (adm 40 · pdf 43 · pwa 38 · src 38 · tm 32 · b3 31 · act 42 · sign 35 ·
arc 25 · unit 26 · imp 23 · team 22 · nosup 17 · fix 17 · ui3 17 · reg 12 · parity) — **รวม ~560**
**ค้าง:** ช่วง B — เป้ารายทีม + ตัวเลือกดูเป้าในหน้า dashboard (รวมขึ้นเป็นทีม/องค์กร) ·
หน้าทีมขายควรให้การ์ดทีมแม่รวมยอดทีมย่อย (ทำในช่วง B) ·
เจ้าของต้องรัน `db/phase3-10.sql` + ตั้งค่าใน Admin: นันทวัน→เห็นทั้งองค์กร · IMP1/IMP2 managers→ทีมย่อยตัวเอง

## 2026-07-23 04:30 · b6a1a24 · ปรับ UI 3 จุด + ช่องรูปลูกค้า (ตามที่เจ้าของสั่ง)
**step:** 3.9 (ตามเก็บ) | **ประเภท:** ฟีเจอร์ + ปรับ UI
- **ย้ายตาราง PRODUCT ขึ้นเหนือหมวด "เงิน & เวลา"** — รายการสินค้าคือที่มาของยอดเงิน ควรกรอกก่อน
  (แทรกผ่าน FORM.map ตรงตำแหน่ง 'เงิน & เวลา' ไม่ได้ย้ายบล็อกมือ)
- **sidebar iPad โชว์ชื่อเมนูใต้ไอคอน** — เดิม ≤1024px ซ่อนชื่อเหลือแต่ไอคอน 68px
  ขยายเป็น 92px + วางไอคอน/ชื่อแนวตั้ง + ชื่อยาวตัด 2 บรรทัด
- **เพิ่มช่องรูปลูกค้าในฟอร์ม Book 3** (`docs/js/ui/photofield.js` ใหม่) แสดงบน PDF ตอนพิมพ์
  ⭐ **ย่อรูปผ่าน canvas ก่อนเก็บเสมอ** (ด้านยาว 512px · JPEG 0.72 → ~30–60KB)
  ไม่งั้นรูปมือถือดิบ 3–8MB จะทำแถว DB บวม + backup JSON บานตาม
  🔒 รับเฉพาะ image/* · แสดงเฉพาะ data:image/ หรือ http(s): (safePhoto ปัด javascript: ทิ้ง)
  รูปบุคคล = ข้อมูลส่วนบุคคล เก็บใน DB ที่มี RLS เท่านั้น (photo_url มีอยู่ในตารางตั้งแต่ 2.1 แล้ว)
- bump v0.12.2
**ไฟล์:** docs/js/ui/photofield.js (ใหม่) · docs/js/modules/pending.js · docs/js/modules/book3.js ·
docs/css/app.css · docs/sw.js · docs/js/config.js
**ทดสอบ:** ชุดใหม่ **17/17** — ตำแหน่ง PRODUCT วัดจากลำดับ section จริง · sidebar วัด flex-direction จริง ·
ย่อรูปผ่าน canvas จริงแล้วเช็กว่า < 60KB · รูปโผล่บน PDF · safePhoto กัน javascript: ·
regression เดิมครบ (pdf 43 · fix 17 · b3 31 · reg 12 · parity) — รวมทั้งหมดผ่าน
**หมายเหตุ:** อัปเดตเลขคาดหวังใน b3.mjs (กลุ่มฟอร์ม 5→6 เพราะเพิ่มรูป) พร้อมเหตุผลกำกับ

## 2026-07-23 03:20 · ยังไม่ commit · ปรับ 3 จุดในฟอร์มตามที่เจ้าของสั่ง
**step:** 3.9 (ตามเก็บ) | **ประเภท:** ปรับ UI
- เจ้าของรัน `db/phase3-9.sql` แล้ว ผ่านครบ 6/6 ✓
- **ย้ายปุ่ม "พิมพ์ / PDF" ไปอยู่ฝั่งขวา ติดกับ ยกเลิก/บันทึก** (เดิมอยู่ซ้ายปนกับปุ่มเก็บเข้าคลัง)
  ทำทั้ง Pending และ Book 3 สี ให้เหมือนกัน
- **ซ่อนช่อง "ผลิตภัณฑ์/ระบบ"** — ให้ไปกรอกที่ตาราง PRODUCT แทน
  ⚠️ **ไม่ได้ลบคอลัมน์ `product` ใน DB** งานเก่าที่กรอกไว้ยังอยู่ครบ
  ช่องที่ถูกซ่อนจะไม่อยู่ใน FormData → ไม่ถูกส่งไป PATCH → ค่าเดิมไม่ถูกเขียนทับ
  (มีเทสต์ยืนยันตรง ๆ: บันทึกฟอร์มแล้วค่า product เดิมยังอยู่)
- **ตารางสินค้าขึ้นแถวแรกให้เลย** ไม่ต้องกด "+ เพิ่มแถว" ก่อนถึงจะกรอกได้
  แถวว่างไม่ถูกบันทึกอยู่แล้ว (savePendingProducts ทิ้งแถวที่ทุกช่องว่าง) จึงไม่เกิดขยะใน DB
- bump v0.12.1
**ไฟล์:** docs/js/modules/pending.js · docs/js/modules/book3.js · docs/js/config.js · docs/sw.js
**ทดสอบ:** ชุดใหม่ **17/17** — รวมเคส "ค่า product เดิมไม่ถูกล้างทั้งที่ซ่อนช่องไป" ·
ตำแหน่งปุ่มวัดจากพิกัดจริงบนจอ · เปิดฟอร์มใหม่ไม่มีแถวว่างซ้อนเกินมา ·
regression เดิมครบ (pdf 43 · rls 80 · act 42 · adm 40 · pwa 38 · src 38 · sign 35 · tm 32 · b3 31 ·
unit 26 · arc 25 · imp 23 · team 22 · nosup 17 · reg 12 · parity) — **รวม 521 ข้อ**
**หมายเหตุ:** เทสต์ `reg.mjs` เดิมนับช่องในฟอร์มไว้ 42 → แก้เป็น 41 พร้อมเขียนเหตุผลกำกับ
ไม่งั้น session หน้าจะนึกว่าฟอร์มพังเอง

## 2026-07-23 02:10 · 5fc0050 · step 3.9 พิมพ์ฟอร์ม PDF ตามต้นฉบับ
**step:** 3.9 (ใหม่ · เจ้าของขอเอง พร้อมแนบ PDF ฟอร์มกระดาษ 2 ชุด) | **ประเภท:** ฟีเจอร์
- พิมพ์ **Pending Project 2 หน้า** + **Book 3 สี "Potential" 2 หน้า** ตำแหน่งข้อมูลตรงกับกระดาษต้นฉบับ
- **ใช้ print stylesheet ของเบราว์เซอร์ ไม่ใช้ library ทำ PDF** — ภาษาไทยไม่เพี้ยน ไม่ต้องฝังฟอนต์
  ไม่พึ่ง CDN (PWA ออฟไลน์ใช้ไม่ได้อยู่แล้ว) · iPhone/iPad กดแชร์ → พิมพ์ → บันทึกเป็น PDF
- 🔴 **เจอช่องว่างในฐานข้อมูลตอนไล่เทียบทีละช่อง** — ฟอร์ม Pending มีตาราง PRODUCT 9 แถว × 7 คอลัมน์
  แต่ระบบเก็บแค่ `product` (ข้อความช่องเดียว) + `value_baht` (ยอดรวมก้อนเดียว)
  ถ้า export ตอนนั้นตารางจะว่างทั้งบล็อก (~⅓ ของหน้า) → รายงานเจ้าของก่อนลงมือ
- `db/phase3-9.sql` — `pending_products` + `pending_projects.result_because` + `customers.nickname`
  ⭐ **เพดาน 9 แถวบังคับที่ DB** ด้วย `check (line_no between 1 and 9)` + `unique(pending_id, line_no)`
  ไม่ต้องเขียน trigger · ยิง API ตรงก็เกินไม่ได้ · เกิน 9 แล้วตารางทะลุหน้า ฟอร์มเพี้ยนทั้งหน้า
- ฟอร์ม Pending: ตัวกรอกรายการสินค้า (เพิ่ม/ลบแถว · คิด TOTAL/NET อัตโนมัติแต่พิมพ์ทับได้)
- ฟอร์ม Book 3: เพิ่มช่อง **ชื่อเล่น** + แสดง **หน่วยงาน/บริษัท** ในฟอร์มพิมพ์ (เจ้าของสั่ง — กระดาษเดิมไม่มี)
- **ฟอร์ม Book 3 สี ครบ 100% อยู่แล้ว** ทุกช่องบนกระดาษมีที่เก็บตั้งแต่ step 2.1 รวมถึงกรอบรูป (`photo_url`)
- ยอดรวมท้ายตารางใช้ `value_baht` ไม่ได้บวกจากรายการเอง — เลขในกระดาษจะได้ไม่ขัดกับ dashboard
**ไฟล์:** db/phase3-9.sql · docs/js/ui/formprint.js (ใหม่) · docs/css/print.css (ใหม่) ·
docs/js/modules/pending.js · docs/js/modules/book3.js · docs/js/data/{supabase,local}-adapter.js ·
docs/js/data/adapter.js · docs/css/app.css · docs/index.html · docs/sw.js · docs/js/config.js (v0.12.0)
**ทดสอบ:** ชุดใหม่ **43/43** — รวม **สร้างไฟล์ PDF ออกมาจริงแล้วเปิดดูเทียบกับต้นฉบับ** ·
ตารางสินค้าพิมพ์ครบ 9 แถวเสมอแม้กรอกแค่ 3 · ครบ 9 แถวแล้วปุ่มเพิ่มถูกปิด · คิด TOTAL/NET ถูก ·
RLS จริงบน PGlite **80/80** (เดิม 69 — เพิ่ม 11 เคสของตารางสินค้า รวม "ใส่แถวที่ 10 ไม่ได้") ·
regression เดิมครบ (pwa 38 · src 38 · tm 32 · act 42 · adm 40 · sign 35 · b3 31 · arc 25 ·
unit 26 · imp 23 · team 22 · nosup 17 · reg 12 · parity ผ่าน) — **รวม 504 ข้อ**
**ค้าง:** เจ้าของต้องรัน `db/phase3-9.sql` ก่อน ไม่งั้นตารางสินค้ากับชื่อเล่นยังบันทึกไม่ได้
(หน้าจอไม่พัง — ดักไว้แล้วว่าถ้ายังไม่มีตารางให้ข้ามไป)

## 2026-07-23 00:40 · 34f5928 · ถอดแถบ Supplier ออกจากแผน (เจ้าของสั่ง)
**step:** 3.4 (ยกเลิก) | **ประเภท:** ปรับแผน
- เจ้าของสั่ง 23 ก.ค. 2569: **"ยังไม่ต้องใช้ฟังก์ชันนี้ ซ่อนออกไปก่อน ข้าม 3.4 ไปทำในอนาคต"**
  และ **ตัดปุ่มหา supplier จากหน้า Pending ออกถาวร**
- ถอดออกจากหน้าจอครบ: ปุ่มในแถบข้าง + แถบล่างมือถือ · router (`VIEWS`) · precache ใน `sw.js`
- **ลบ `docs/js/modules/suppliers.js` ทิ้ง ไม่เก็บไฟล์ placeholder ไว้**
  (บทเรียนจาก `tools/import-json.html` ที่เคยค้างจนเจ้าของเปิดผิดไฟล์แล้วเข้าใจว่างานยังไม่เสร็จ)
- roadmap 23 → **22 step** · สเปคย้ายไปหัวข้อใหม่ "📦 แผนอัปเดตอนาคต" ใน CLAUDE.md
  พร้อมเขียนกำกับว่า **ห้ามดึงกลับเข้า roadmap เองโดยไม่ถามเจ้าของ**
- ยังไม่เคยแตะฐานข้อมูลเรื่อง supplier เลย → ไม่มีตารางค้าง ไม่มีหนี้ migration
- bump เป็น v0.11.0 (ต้อง bump ทุกครั้งที่แก้ `SHELL` ของ service worker ไม่งั้นเครื่องที่ติดตั้งแล้วยังใช้ของเก่า)
**ไฟล์:** ลบ docs/js/modules/suppliers.js · docs/index.html · docs/js/app.js · docs/sw.js ·
docs/js/config.js · db/schema.sql (หมายเหตุ) · CLAUDE.md · PROGRESS.md
**ทดสอบ:** ชุดใหม่ 17/17 — **เปิดด้วยลิงก์เก่า `#suppliers` แล้วเด้งกลับหน้าภาพรวม ไม่ค้างหน้าเปล่า** ·
เดินครบ 7 หน้าที่เหลือไม่มีหน้าไหนพัง · ไม่มีไฟล์ไหน 404 · แถบล่างมือถือเหลือ 7 ปุ่มยังไม่ล้นจอ ·
regression เดิมครบ (pwa 38 · src 38 · tm 32 · act 42 · adm 40 · sign 35 · b3 31 · arc 25 · unit 26 ·
imp 23 · team 22 · reg 12 · parity ผ่าน)
**หมายเหตุ:** แก้เทสต์ PWA ให้อ่านเลขเวอร์ชันจาก `config.js` แทนการฝังเลขไว้ — bump ทีไรเทสต์แดงทุกที

## 2026-07-22 23:30 · 141daf1 · step 3.3 PWA — ติดตั้งเป็นแอปได้จริงทั้ง iPhone/iPad/S24
**step:** 3.3 | **ประเภท:** ฟีเจอร์ + แก้บั๊ก
- **ไอคอนครบชุดแล้ว** (404 ที่ค้างมาตั้งแต่ 1.2 จบ) — 192 · 512 · maskable 512 · apple-touch 180 · favicon 32
  สร้างจาก HTML แล้วให้ Chrome ถ่ายภาพ ไม่ต้องใช้โปรแกรมกราฟิก
  **maskable แยกไฟล์** เพราะ Android ครอบเป็นวงกลมแล้วตัดขอบ ~20% ใช้ไฟล์เดียวกันตัวอักษรจะโดนตัด
- **iOS ต้องมี meta ของตัวเอง** — Safari ไม่อ่านไอคอนใน manifest.json เลย ถ้าไม่มี `apple-touch-icon`
  จะไปจับภาพหน้าจอมาทำไอคอนแทน · เพิ่ม `apple-mobile-web-app-*` ครบ
- **sw.js เขียนใหม่** — precache จาก 6 → 25 ไฟล์ (ของเดิมต้องเคยเปิดหน้านั้นก่อนถึงใช้ออฟไลน์ได้)
  ⚠️ เลิกใช้ `addAll()` เปลี่ยนเป็น `add()` ทีละไฟล์ + catch — ถ้ามีไฟล์เดียว 404 `addAll` จะพังทั้งชุด
  แล้ว service worker ติดตั้งไม่สำเร็จเลย (ไอคอน 404 ที่ค้างอยู่ก่อนหน้านี้จะทำให้ PWA พังทั้งระบบ)
  ยังเป็น network-first เหมือนเดิม · ยังห้ามแตะ `/rest/v1/` `/auth/v1/` (ข้อมูลลูกค้าห้ามลง cache)
- **`js/ui/pwa.js` ใหม่** — แถบ ออฟไลน์ / มีเวอร์ชันใหม่ / ติดตั้งเป็นแอป
  ออฟไลน์สำคัญที่สุด: SW ทำให้ "เปิดแอปได้" แต่ "บันทึกไม่ได้" ถ้าไม่เตือน ทีมขายจะกรอกฟอร์มยาว ๆ เสียเปล่า
- **safe area บนสุด** — ใช้ `black-translucent` คู่กับ `--safe-t` ไม่งั้นหัวข้อหน้าโดนรอยบาก iPhone ทับ

**🔴 บั๊ก 3 ตัวที่เทสต์จับได้ (ทั้งหมดเกิดจากของที่เขียนรอบนี้เอง):**
1. **คำชวนติดตั้งไปทับคำเตือนออฟไลน์** — Chrome ยิง `beforeinstallprompt` ตอนไหนก็ได้
   คนอยู่หน้างานเลยเห็นแต่ "ติดตั้งเป็นแอปได้" ไม่รู้ว่าบันทึกไม่ได้
   → ใส่ลำดับความสำคัญ: คำเตือนที่ทำให้เสียงาน > คำชวนเสมอ
2. **แถบลอยทับปุ่มจนกดไม่โดน** — แถบเป็น `position:fixed` มุมล่าง ไปบังปุ่ม "แก้ไข" ในหน้าแหล่งงาน
   `p.click()` ไปโดนแถบแทน · **เทสต์ที่ใช้ `dispatchEvent` จะไม่มีวันเจอ** เพราะไม่ได้ hit-test
   ลองเผื่อ padding ท้ายหน้าก่อน → ยังบังปุ่มกลางหน้าได้อยู่ดี
   → **ย้ายแถบขึ้นบนสุดใน flow ปกติ** มันดันเนื้อหาลงเอง ไม่มีทางบังอะไรได้อีก
3. **แถบไปปิดตัวแปรที่ตัวเองใช้** — JS ตั้ง `--safe-t: 0` กันเว้นรอยบากซ้ำสองชั้น
   แต่แถบก็อ่านตัวแปรเดียวกัน → หัวแถบโดนนาฬิกาทับ
   → แยกเป็น `--safe-t-env` (ค่าดิบ ห้ามทับ) กับ `--safe-t` (ช่องสั่งงานของ JS)
**ไฟล์:** docs/js/ui/pwa.js (ใหม่) · docs/sw.js · docs/manifest.json · docs/index.html ·
docs/css/app.css · docs/js/app.js · docs/icons/*.png (5 ไฟล์ใหม่) · docs/icons/README.md · docs/js/config.js
**ทดสอบ:** PWA จริงบนเบราว์เซอร์ **38/38** — service worker ติดตั้งถึงสถานะ activated ·
precache ครบทั้ง 25 ไฟล์ (จับ path พิมพ์ผิด) · ตัดเน็ตแล้วเปิดแอปขึ้นจริง CSS+JS มาจาก cache ·
ไอคอนทุกตัวโหลดได้และขนาดตรงกับที่ประกาศ · **ไม่มี request ของ API ค้างใน cache** ·
รอยบาก 47px กันระยะถูก · แถบไม่บังปุ่มใด ๆ · regression เดิมครบ 395 ข้อ (รวมทั้งหมด **433**)
**ค้าง:** ยังไม่ได้ลองติดตั้งบนเครื่องจริง (iPhone/S24/iPad) — ต้องรอเจ้าของทดสอบ
เป็นงานเดียวกับที่ 1.7 ค้างอยู่

## 2026-07-22 21:40 · 06157bf · step 3.2 ทีมขาย + playbook + เช็กลิสต์ชนะงาน 7 ข้อ
**step:** 3.2 | **ประเภท:** ฟีเจอร์
- แถบ "แหล่งงาน" เพิ่มจาก 2 เป็น **4 แถบย่อย** (ตรงกับที่ CLAUDE.md วางไว้ว่า F7 = แหล่งงาน+ทีม+กลยุทธ์)
  ไม่เพิ่มปุ่มในแถบนำทาง — bottom bar มือถือมี 8 ปุ่มอยู่แล้ว ใส่เพิ่มจะแน่นเกิน
- **แถบทีมขาย** — 5 ทีม ตัวเลขจริงรายทีม (ปิดได้แล้ว / ยังเดินอยู่ / จำนวนงาน / สมาชิก)
  ใช้ `monthOf()` ที่ export จาก dashboard.js ตัวเดียวกัน ไม่ได้ก๊อปกติกา "อะไรนับว่าปิดแล้ว" มาเขียนซ้ำ
- **แถบกลยุทธ์** — เช็กลิสต์ชนะงาน 7 ข้อ + playbook 8 เส้นทาง (หัวหน้าแก้ได้จากหน้าจอ)
  เช็กลิสต์ทุกข้อผูกกับช่องจริงในฟอร์ม Pending → ระบบนับให้เองว่าแต่ละข้อยังขาดกี่งาน คิดเป็นเงินเท่าไหร่
- `db/phase3-2.sql` — คอลัมน์ `playbook` + เนื้อหาตั้งต้น 8 เส้นทาง (update เฉพาะแถวที่ยังว่าง รันซ้ำไม่ทับของหัวหน้า)
- 🔴 **แก้ช่องโหว่ที่ 2.4 ทิ้งไว้:** `profiles_select` เขียน `team_id = my_team_id()` ตรง ๆ ไม่ผ่าน `can_access_team()`
  → หัวหน้าที่ได้สิทธิ์ดู GOV.1/3/4 เห็น "งาน" ครบ 3 ทีม แต่เห็น "คน" แค่ทีมตัวเอง
  หน้าทีมขายเลยจะขึ้นว่าทีมอื่นมีสมาชิก 0 คน ทั้งที่จริงมี — แก้ให้ผ่าน `can_access_team()` เหมือนตารางอื่น
  ทดสอบยืนยันแล้วว่า **sale ไม่ได้เห็นกว้างขึ้นแม้แต่คนเดียว**
- ทีมที่ผู้ใช้ไม่มีสิทธิ์ดู ขึ้น "🔒 ดูข้อมูลทีมนี้ไม่ได้" **ไม่ใช่เลข 0** — เลข 0 ทำให้เข้าใจผิดว่าทีมนั้นไม่มีงาน
- งานที่ยังไม่ระบุทีมขึ้นการ์ดเตือน ไม่ปล่อยหายเงียบ ๆ (ยอดรวมรายทีมจะได้ตรงกับหน้าภาพรวม)
**ไฟล์:** db/phase3-2.sql · docs/js/modules/sources.js · docs/js/modules/dashboard.js (export monthOf) ·
docs/js/data/local-adapter.js · docs/css/app.css · docs/js/config.js · docs/sw.js (v0.9.0)
**ทดสอบ:** RLS จริงบน PGlite **69/69** (เดิม 59 — เพิ่มชุด profiles/playbook 10 ข้อ) ·
ตรรกะบริสุทธิ์ **22/22** · เบราว์เซอร์จริง (คลิกผ่าน CDP) **32/32** · ไม่มี JS error / unhandled rejection ·
มือถือ 390px ทั้ง 4 แถบไม่ล้นขอบจอ · regression เดิมครบ: src 38 · act 42 · adm 40 · sign 35 · b3 31 ·
arc 25 · unit 26 · imp 23 · reg 12 · adapter parity ผ่าน
**ค้าง:** เจ้าของต้องรัน `db/phase3-2.sql` ใน Supabase ก่อน ไม่งั้นแถบกลยุทธ์จะขึ้นว่ายังไม่มีเนื้อหา
และหน้าทีมขายจะยังเห็นสมาชิกแค่ทีมตัวเอง

## 2026-07-23 00:15 · b8f38a1 · แก้ 2 เรื่องที่เจ้าของเจอหลัง 3.1
**step:** 3.1 (ตามเก็บ) | **ประเภท:** แก้บั๊ก + ฟีเจอร์
- 🔴 **ซากไฟล์ placeholder ค้างที่ `tools/import-json.html`** (992 bytes จาก commit แรก)
  ของจริงอยู่ที่ `docs/tools/import-json.html` (13 KB) — เจ้าของเปิดอันเก่าแล้วเห็นว่า "Phase 1.6 ยังไม่ทำ"
  ทั้งที่ทำเสร็จตั้งแต่ 1.6 แล้ว · **ลบซากทิ้งแล้ว** + จดกติกาใน CLAUDE.md ว่าย้ายไฟล์ต้องลบของเก่า
  (URL บนเว็บ `/tools/import-json.html` เสิร์ฟของจริงมาตลอด — ปัญหาอยู่ที่ไฟล์ในเครื่อง)
- 🔴 **ผมบอกผิดว่านำเข้ารายชื่อ 90 ราย ผ่านเครื่องมือนี้ได้** — ของเดิมรองรับแค่งานขาย
  → เพิ่มการรองรับจริง: `detectFormat` รู้จักรูปแบบรายชื่องานแสดงสินค้า ·
  `mapExpoCustomer()` แปลง `{sales,name,org,interest,contact,result,p}` → `expo_customers` ·
  หน้า import มีเส้นทาง preview/run แยก กันซ้ำด้วยชื่อบริษัท
- แก้บั๊กที่มีมาตั้งแต่ 1.6: ถ้าซ้ำหมดทุกแถว ลูปไม่ทำงาน → ช่องสรุปว่างเปล่า กดแล้วเหมือนไม่มีอะไรเกิดขึ้น
  ตอนนี้ขึ้น "สำเร็จ 0 · ข้าม 3" + บอกว่าให้ติ๊ก "อัปเดตทับ" ถ้าต้องการเขียนทับ
- bump เป็น v0.8.1
**ไฟล์:** ลบ tools/import-json.html · docs/tools/import-json.html · docs/js/data/import-map.js ·
docs/js/config.js · docs/sw.js · CLAUDE.md
**ทดสอบ:** 23/23 นำเข้า (รวมนำเข้าซ้ำ + ไฟล์งานขายเดิมต้องไม่พัง) · regression src 38 · reg 12 · unit 26
**ค้าง:**
- 🔴 เจ้าของยังต้องนำเข้ารายชื่อ Thai Water 90 ราย + เพิ่มลิงก์ Google Sheet เองในแถบแหล่งงาน
- ยังไม่ได้ทดสอบด้วยบัญชี sale/manager จริงบน Supabase
- ไอคอน PWA ยัง 404 — รอ step 3.3


## 2026-07-22 22:30 · c7b20ff · 3.1 เสร็จ — แหล่งงาน 8 เส้นทาง + Thai Water Expo
**step:** 3.1 | **ประเภท:** ฟีเจอร์ + ความปลอดภัย
- `db/phase3-1.sql` ใหม่ — `lead_sources` (8 เส้นทาง + ลิงก์ jsonb) · `expo_customers` (กองลีดกลาง)
- `modules/sources.js` เขียนใหม่ทั้งไฟล์ — 2 แถบ: เส้นทางหางาน · Thai Water Expo
  ★ prospect ขึ้นก่อนเสมอ · กรอง/ค้นหา · ยกขึ้นเป็น Pending แล้วโยง `pending_id` กันยกซ้ำ
- 🔴 **จงใจไม่ commit ลิงก์ Google Sheet รายชื่อลูกค้า 90 ราย** — URL ของ Sheet คือกุญแจเข้าถึง
  ข้อมูลลูกค้าจริง ถ้าชีตเปิดแบบ "ใครมีลิงก์ก็เข้าได้" การใส่ลง public repo = ปล่อยข้อมูลออกทั้งชุด
  → เจ้าของเพิ่มเองจากหน้าจอ (ลิงก์แก้ได้อยู่แล้ว) · มีเทสต์คุมว่า seed ต้องไม่มีลิงก์แบบนี้
- 🔒 กัน `javascript:` URL 2 ชั้น (ตอนบันทึก + ตอนแสดงผล) + `rel="noopener noreferrer"` ทุกลิงก์
- **สิทธิ์ `expo_customers` ตั้งใจไม่ผูกทีม** — เป็นกองลีดกลางที่ยังไม่มีเจ้าของ
  ถ้าผูกทีมแบบตารางอื่น แถวที่ยังไม่ระบุทีมจะเห็นได้แต่ admin แล้วฟีเจอร์จะไร้ประโยชน์
**บั๊กที่เทสต์จับได้:**
- `.ex-right` กว้าง 100% อยู่ในแถวที่ไม่มี `flex-wrap` → ล้นจอมือถือ 5px
  (ก๊อป pattern จาก `.rvrow` แต่ลืมเอา flex-wrap มาด้วย)
- ผมตั้งเลขคาดหวังผิดเอง 2 จุด: ลิงก์ 17 (จริง 16 เพราะตัดออก 1) · ลำดับตัวอักษรไทย
  (ซ มาก่อน บ · "เอ" เรียงตาม อ ไปท้ายสุด — ตรวจกับ localeCompare แล้ว)
- bump เป็น v0.8.0
**ไฟล์:** db/phase3-1.sql · docs/js/modules/sources.js · docs/js/data/supabase-adapter.js ·
docs/js/data/local-adapter.js · docs/js/data/adapter.js · docs/css/app.css ·
docs/js/config.js · docs/sw.js · PROGRESS.md · CLAUDE.md
**ทดสอบ:** 274/274 ผ่าน (59 RLS จริง + 38 แหล่งงาน + 42+40+35+31+25+26+12 regression)
**ค้าง:**
- 🔴 ต้องเอา `db/phase3-1.sql` ไปรันใน Supabase
- 🔴 **รายชื่อลูกค้า Thai Water 90 ราย ยังไม่ได้นำเข้า** — ใช้ `docs/tools/import-json.html`
  หรือกรอกจากหน้าจอ · และเจ้าของต้องเพิ่มลิงก์ Google Sheet เองในแถบแหล่งงาน
- ยังไม่ได้ทดสอบด้วยบัญชี sale/manager จริงบน Supabase
- ไอคอน PWA ยัง 404 — รอ step 3.3
- 1.7 ยังเหลือทดสอบบนเครื่องจริง iPhone/S24/iPad


## 2026-07-22 19:40 · 7062daf · 2.6 เสร็จ — หัวหน้าเซ็นรับทราบ (จบ Phase 2)
**step:** 2.6 | **ประเภท:** ฟีเจอร์ + ความปลอดภัย + แก้บั๊ก
- `db/signoffs.sql` ใหม่ — ตาราง append-only + `is_reviewer()` + trigger `set_signoff_meta()`
  กัน 3 ชั้น: GRANT ให้แค่ select/insert · ไม่มี policy update/delete · trigger เขียนทับค่าจาก client
- `ui/signoff.js` ใหม่ (คอมโพเนนต์ร่วม) — `signoffState()` ตัดสิน "ลายเซ็นค้าง" จุดเดียวทั้งระบบ
- `modules/review.js` ใหม่ — หน้า "รอตรวจ" รวมงาน+ลูกค้าที่ยังไม่เซ็น/ถูกแก้หลังเซ็น
  เรียง "แก้ไขหลังเซ็น" ขึ้นก่อน · กดแล้วพาไปเปิดฟอร์มจริงในแถบต้นทาง (ไม่ทำฟอร์มซ้ำ)
- แถบลายเซ็นในฟอร์ม Pending + Book 3 สี · sale เห็นผลตรวจแต่ไม่มีปุ่มเซ็น
**บั๊กที่เทสต์จับได้ 3 ตัว:**
- โค้ดไปแทรกผิดฟังก์ชัน (`openQuickLog` แทน `openDetail`) — รวมของ 2.5 ที่หลุดไปด้วย
- import หาย → `signoffBarHtml` undefined → ฟอร์มไม่เปิด **แต่เงียบสนิท**
  เพราะเป็น unhandled rejection ที่ `pageerror` ไม่จับ → **เพิ่มตัวดักในเทสต์ทุกชุดแล้ว**
- `local-adapter` ไม่ใส่ `updated_at` ตอนสร้าง (ต่างจาก `default now()` ของ Postgres)
  → เซ็นเสร็จปุ๊บกลายเป็น "แก้ไขหลังเซ็น" ทันที · แก้แล้วลำดับการเรียงตรงกับ Supabase ด้วย
- แก้ layout: ย่อจอ desktop → มือถือ แถบบนล้น 3px (`.topbar-left` ไม่มี `min-width:0`)
- bump เป็น v0.7.0
**ไฟล์:** db/signoffs.sql · docs/js/ui/signoff.js · docs/js/modules/review.js ·
docs/js/modules/pending.js · docs/js/modules/book3.js · docs/js/data/supabase-adapter.js ·
docs/js/data/local-adapter.js · docs/js/data/adapter.js · docs/js/app.js · docs/index.html ·
docs/css/app.css · docs/js/config.js · docs/sw.js · PROGRESS.md · CLAUDE.md
**ทดสอบ:** 218/218 ผ่าน (49 RLS จริง + 35 ลายเซ็น + 42 + 40 + 31 + 25 + 26 + 12 regression)
**ค้าง:**
- 🔴 **ต้องเอา `db/signoffs.sql` ไปรันใน Supabase** ไม่งั้นแถบลายเซ็นกับหน้ารอตรวจยังใช้ไม่ได้
- ยังไม่ได้ทดสอบด้วยบัญชี sale/manager จริงบน Supabase (ตรรกะพิสูจน์บน Postgres จริงแล้ว)
- ไอคอน PWA ยัง 404 — รอ step 3.3
- 1.7 ยังเหลือทดสอบบนเครื่องจริง iPhone/S24/iPad


## 2026-07-22 16:05 · b0622bc · 2.5 เสร็จ — Archive: อุดรูงานปิดแล้วยังตามหลอน
**step:** 2.5 | **ประเภท:** แก้บั๊ก + ฟีเจอร์เล็ก
- ตรวจของเดิมก่อน → โครงสร้าง archive ครบตั้งแต่ 1.4/2.2 แล้ว **แต่มีรูรั่ว 1 จุด**
- 🔴 **รูรั่ว:** เก็บงานเข้าคลังแล้ว กิจกรรมที่ผูกไว้ยังเตือน "เลยกำหนด" ทุกวัน
  ทั้งหน้าแผนติดต่อและ dashboard → ยิ่งปิดงานเยอะ เสียงเตือนยิ่งมั่วจนไม่มีใครเชื่อตัวเลข
- แก้: `listActivities` ดึง `is_active` ของงานแม่มาด้วย · `bucketize()` ข้ามรายการที่งานแม่ถูกเก็บแล้ว
  เลือกวิธี "ไม่แสดง" แทนแก้ข้อมูล → ปลุกงานกลับมา กิจกรรมกลับมาเองครบ
- **ไม่ซ่อนเงียบ ๆ** — หน้าจอบอกเสมอว่าซ่อนไว้กี่รายการ เพราะอะไร
- กรณีที่ระวังไว้: RLS ซ่อนงานแม่จนได้ `null` → ต้องยังนับกิจกรรมนั้น ไม่ใช่เหมาว่า archive
- เก็บเพิ่ม: แสดงวันที่เก็บเข้าคลัง (พ.ศ.) · เตือนให้เก็บเข้าคลังเมื่อเลือกขั้นตอน "ปิดได้"/"แพ้"
  (ไม่เก็บอัตโนมัติ เพราะปิดการขายแล้วมักยังต้องตามส่งของ/วางบิลอีกหลายเดือน)
- แก้ข้อความที่ขัดกันเอง: "ยังไม่มีกิจกรรม" + "ซ่อนไว้ 1 รายการ" พร้อมกัน
- bump เป็น v0.6.0
**ไฟล์:** docs/js/modules/activities.js · docs/js/modules/pending.js · docs/js/modules/book3.js ·
docs/js/data/supabase-adapter.js · docs/js/data/local-adapter.js · docs/css/app.css ·
docs/js/config.js · docs/sw.js · PROGRESS.md · CLAUDE.md
**ทดสอบ:** 176/176 ผ่าน (24 archive + 26 unit + 34 RLS + 39 Admin + 41 + 30 + 12 regression)
**ค้าง:**
- 🔴 `db/phase2-4.sql` ยังต้องเอาไปรันใน Supabase (ค้างมาจาก 2.4)
- ยังไม่ได้ทดสอบด้วยบัญชี sale/manager จริงบน Supabase
- ไอคอน PWA ยัง 404 — รอ step 3.3
- 1.7 ยังเหลือทดสอบบนเครื่องจริง iPhone/S24/iPad


## 2026-07-22 14:20 · c9a9676 · 2.4 เสร็จ — role manager + team_access + หน้า Admin
**step:** 2.4 | **ประเภท:** ฟีเจอร์ + ความปลอดภัย + เครื่องมือทดสอบ
- `db/phase2-4.sql` ใหม่: role `manager` · ตาราง `team_access` · `app_settings` (เป้ายอดขาย)
  + แก้ `can_access_team()` เป็น security definer และให้อ่าน `team_access`
- `modules/admin.js` ใหม่: จัดการผู้ใช้ (role/ทีม/เปิด-ปิดบัญชี) · ติ๊กทีมที่หัวหน้าดูข้ามได้ ·
  เพิ่มทีม · ตั้งเป้ายอดขาย (dashboard ดึงไปใช้ทันที ไม่ต้องแก้ config.js อีก)
- ⭐ **ทดสอบ RLS ด้วย PostgreSQL จริงได้แล้ว** — ติดตั้ง PGlite (PG16 เป็น WASM)
  จำลอง auth ของ Supabase แล้วรันไฟล์ SQL ทั้ง 4 ตามลำดับจริง + สลับ role ยิง query
  พิสูจน์ได้ว่าหัวหน้าเห็น 3 ทีมที่ติ๊กให้ และไม่เห็นทีมที่ไม่ได้ติ๊ก (34/34)
- **สิ่งที่การทดสอบจริงเจอ:** การถูกปฏิเสธมี 2 หน้าตา — ละเมิด `using` = 0 แถวเงียบ ๆ ·
  ละเมิด `with check` = error 42501 → ต้องดักทั้งสองแบบ
- เพิ่ม `restError()` แปลง error ของ Postgres (42501/P0001/42P01/23505/23514) เป็นภาษาไทย
- **เก็บของค้างจาก 2.3:** `savePending`/`saveCustomer` เติม team_id ให้อัตโนมัติแล้ว (`fillTeam()`)
- app.js: ป้ายสิทธิ์รองรับ "หัวหน้างาน" + ซ่อนแถบตั้งค่าจากคนที่ไม่ใช่ admin
- bump เป็น v0.5.0
**ไฟล์:** db/phase2-4.sql · docs/js/modules/admin.js · docs/js/modules/dashboard.js ·
docs/js/data/supabase-adapter.js · docs/js/data/local-adapter.js · docs/js/data/adapter.js ·
docs/js/app.js · docs/index.html · docs/css/app.css · docs/js/config.js · docs/sw.js ·
PROGRESS.md · CLAUDE.md
**ทดสอบ:** 174/174 ผ่าน (34 RLS บน Postgres จริง + 39 หน้า Admin + 41 + 30 + 18 + 12 regression)
**ค้าง:**
- 🔴 **ต้องเอา `db/phase2-4.sql` ไปรันใน Supabase ก่อน** ไม่งั้นหน้าตั้งค่าจะขึ้นว่ายังไม่มีตาราง
- ยังไม่ได้ทดสอบด้วยบัญชี sale/manager จริงบน Supabase (ยังไม่มีบัญชีพวกนั้น)
  แต่ตรรกะ RLS พิสูจน์บน Postgres จริงแล้ว — เหลือแค่ยืนยันว่า Supabase ให้ผลเดียวกัน
- ไอคอน PWA (`icons/icon-192.png`) ยัง 404 — รอ step 3.3
- 1.7 ยังเหลือทดสอบบนเครื่องจริง iPhone/S24/iPad


## 2026-07-22 10:40 · 8716a05 · 2.3 เสร็จ — F6 แผนติดต่อลูกค้า + เตือนงานค้างบน dashboard
**step:** 2.3 | **ประเภท:** ฟีเจอร์ + แก้บั๊ก
- เขียน `modules/activities.js` ใหม่ทั้งไฟล์ (จากเดิมเป็น placeholder) — จัดกลุ่มตามกำหนดเวลา ไม่ใช่ตารางเรียง
- ช่องเพิ่มเร็วบรรทัดเดียว + ปุ่มติ๊กเสร็จกดครั้งเดียวจบ (ไม่เปิด modal)
- ฟอร์มเต็มผูกกิจกรรมกับงาน Pending / ลูกค้า Book 3 สี ได้
- dashboard เพิ่มแถบ "สิ่งที่ต้องทำวันนี้" — เรียก `bucketize()` ตัวเดียวกับหน้าแผน เลขจะไม่มีทางขัดกัน
- **แก้บั๊กวันที่:** `toISOString()` คืน "เมื่อวาน" ก่อน 07:00 น. เวลาไทย →
  เพิ่ม `todayISO()` / `shiftDay()` ใน `ui/datepicker.js` แล้วเปลี่ยนทุกที่ที่ใช้แบบเดิม
  (พิสูจน์ด้วยการล็อกนาฬิกาไว้ 22 ก.ค. 03:00 น. → ของเดิมได้ 2026-07-21)
- **แก้กับดัก RLS:** adapter เติม `team_id` ของผู้ใช้ให้อัตโนมัติตอนสร้างกิจกรรม
  (ปล่อยว่างแล้ว sale จะบันทึกไม่ผ่านโดยไม่มี error บอก) + ดัก PATCH ที่ RLS ปฏิเสธเงียบ ๆ
- bump เวอร์ชันเป็น v0.4.0 ทั้ง config.js และ sw.js
**ไฟล์:** docs/js/modules/activities.js · docs/js/modules/dashboard.js · docs/js/ui/datepicker.js ·
docs/js/ui/loglist.js · docs/js/data/supabase-adapter.js · docs/js/data/local-adapter.js ·
docs/css/app.css · docs/js/config.js · docs/sw.js · PROGRESS.md · CLAUDE.md
**ทดสอบ:** 83/83 ผ่าน (41 หน้าแผน + 18 unit + 12 regression Pending + 30 regression Book 3) · ไม่มี JS error
**ค้าง:**
- 🔴 `customers` / `pending_projects` **ยังไม่ได้เติม team_id อัตโนมัติ** — ฟอร์มมีตัวเลือก "— ยังไม่ระบุ —"
  ซึ่ง sale เลือกแล้วจะบันทึกไม่ผ่าน ตอนนี้ยังไม่เจอเพราะมีแต่บัญชี admin → **ต้องแก้ตอน 2.4**
- ยังไม่ได้ทดสอบด้วยบัญชี `sale` จริง (ยังไม่มีบัญชีนั้น รอ 2.4)
- ไอคอน PWA (`icons/icon-192.png`) ยัง 404 อยู่ — รอ step 3.3
- 1.7 ยังเหลือทดสอบบนเครื่องจริง iPhone/S24/iPad


## 2026-07-22 08:05 · (commit ตัวมันเอง) · จด wish ข้อแรก — layer การแสดงผลตามตำแหน่ง
**step:** — | **ประเภท:** เอกสาร
- จดลง `WishtoHave.md` กล่องรับ: MD/admin/director เห็นทุกส่วน+แก้ในหน้าได้ ·
  Manager กลุ่ม IMP / TA Sales เห็นแค่กลุ่มตัวเอง · เปลี่ยนสิทธิ์ได้ภายหลัง
- แนบหมายเหตุก่อนประเมิน: ข้อนี้**ส่วนใหญ่มีในแผน 2.4 อยู่แล้ว** (`role` + `team_access`)
  ส่วนที่ยังไม่มีคือชั้น `director`/MD ที่สูงกว่า manager และ "สลับมุมมอง" ถ้าหมายถึงกดดูแบบที่คนอื่นเห็น

**ไฟล์:** `WishtoHave.md`
**ทดสอบ:** ไม่ต้องทดสอบ (เอกสารล้วน)
**ค้าง:** ❓ ยังไม่รู้ว่า "TA Sales" คือทีมไหน — ระบบมี GOV.1 / GOV.3 / GOV.4 / TE-IMP / System Project
เท่านั้น ถ้าเป็นทีมใหม่ต้องเพิ่มใน `seed.sql` · **ต้องถามเจ้าของก่อนประเมินเต็ม**

## 2026-07-22 07:40 · `1908e3e` · สร้าง WishtoHave.md
**step:** — | **ประเภท:** เอกสาร
- สร้าง `WishtoHave.md` — ที่จดฟังก์ชันที่เจ้าของอยากได้ระหว่างพัฒนา แต่ยังไม่อยู่ใน roadmap
- แบ่ง 3 โซน: 📥 กล่องรับ (เจ้าของจดดิบ ๆ) → ✅ ประเมินแล้ว (Claude เติมผล) → ❌ ตัดสินใจไม่ทำ (กันเสนอซ้ำ)
- ล็อกรูปแบบผลประเมิน 5 ข้อ: step ไหน · กระทบโครงสร้างไหม · ต้อง migration ไหม · **ราคาถ้าเลื่อน** · ติดอะไรก่อน
- เติมตัวอย่างจริง 2 ข้อ ไม่ใช่ตัวอย่างสมมุติ: "ปุ่มลบบันทึกติดตาม" (ของค้างจาก 1.4c) และ
  "rollback รายแถว" ที่ตัดออกไปแล้วในสเปค v3 — ให้เห็นทั้งโซนที่ประเมินแล้วและโซนที่ตัดทิ้ง
- เพิ่มรายการไฟล์เอกสารระดับ repo ใน `CLAUDE.md` (CLAUDE / PROGRESS / autolog / WishtoHave / Workflow)
  พร้อมกำกับหน้าที่แต่ละไฟล์ — session ใหม่จะได้ไม่เขียนซ้ำกันเอง

**ไฟล์:** `WishtoHave.md` (ใหม่) · `CLAUDE.md`
**ทดสอบ:** ไม่ต้องทดสอบ (เอกสารล้วน)
**ค้าง:** กล่องรับยังว่าง — รอเจ้าของเริ่มจด
> ⚠️ ไฟล์ 3 ตัวนี้ไปติดอยู่ใน commit `1908e3e` ("แก้บั๊กปฏิทิน") เพราะอีก session ทำงานคู่ขนานแล้ว
> `git add` แบบเหมาทั้งโฟลเดอร์ — เนื้อไฟล์ครบถูกต้อง แต่ข้อความ commit ไม่ตรงกับของที่อยู่ข้างใน
> **ไม่แก้ประวัติ** (push ไปแล้ว + อีก session ยังทำงานอยู่ rewrite แล้วเสี่ยงงานเขาหาย)
> บทเรียน: ตอนมีหลาย session ให้ `git add <ไฟล์ที่ตัวเองแตะ>` ระบุชื่อเสมอ อย่าใช้ `-A` / `-a`

## 2026-07-22 07:24 · `86ed52e` · 1.6 เสร็จ — นำเข้า / กู้คืนข้อมูล
**step:** 1.6 | **ประเภท:** ฟีเจอร์ (ปิด step)
> 📌 รายการนี้เก็บย้อนหลังให้ — session ที่ทำงานนี้เริ่มก่อนกติกาข้อ 7 มีผล จึงยังไม่ได้เขียนเอง

- ย้าย `tools/import-json.html` → **`docs/tools/`** เพราะ GitHub Pages เสิร์ฟแค่ `docs/` ไม่งั้นเปิดจากเว็บไม่ได้
- รับ 3 รูปแบบ: ไฟล์สำรองของระบบ / prototype v3 / array งานล้วน — **ไฟล์ที่ไม่รู้จักโยน error ไม่เดาแล้วนำเข้ามั่ว**
- ล็อกรูปแบบไฟล์สำรองไว้ที่ `BACKUP_FORMAT` ใน `import-map.js` → **step 3.6 ต้อง export ตามนี้** (ไม่งั้นได้ไฟล์ backup ที่เอากลับเข้าไม่ได้)
- การแปลงสำคัญ: `ownerId` (m1–m4) ของ prototype คือ**ทีมไม่ใช่คน** → map เข้า `team_id` ·
  `closeMonth` พ.ศ. `2569-10` → ค.ศ. `2026-10` (ไม่งั้นเรียงพังทั้งระบบ) ·
  มูลค่ามีคอมมา → ตัวเลข · วันที่ว่าง → `null` · stage ไม่รู้จัก → `lead` ·
  `c1n/c1s/c1a..c3*` → `project_contacts` slot 1–3 · `sample: true` = ข้อมูลตัวอย่าง ไม่นำเข้า
- กันซ้ำด้วย PENDING NO. ก่อน ไม่มีค่อยดูชื่องาน+ลูกค้า · ค่าเริ่มต้นข้ามงานซ้ำ · **ไม่ลบอะไรเลย**
- 🐛 บั๊กที่เทสต์จับได้: `local-adapter` ใช้ `{ ...EMPTY }` ซึ่ง spread คัดลอกแค่ชั้นนอก
  อาร์เรย์ข้างในเป็นตัวเดียวกัน → `push` ไปเปื้อนค่าตั้งต้น ล้างข้อมูลแล้วของเก่าไม่หาย · แก้เป็นฟังก์ชัน `emptyDb()`
- เปลี่ยนข้อความปุ่ม → "Project จบแล้ว — เก็บเข้าคลัง Archives"

**ไฟล์:** `docs/tools/import-json.html` (+309 · ย้ายที่) · `docs/js/data/import-map.js` (ใหม่ +240) · `local-adapter.js` · `pending.js` · `CLAUDE.md` · `PROGRESS.md`
**ทดสอบ:** 78/78 ผ่าน — รวมวงจรจริง export → ล้าง DB → import กลับ → ข้อมูลครบ

## 2026-07-22 07:20 · (commit ตัวมันเอง) · สร้างระบบ autolog
**step:** — | **ประเภท:** เอกสาร
- สร้าง `autolog.md` + ย้อนบันทึก 25 commit ตั้งแต่ต้นโปรเจกต์
- เพิ่มกติกาข้อ 7 ใน `CLAUDE.md` — จบงานทุกครั้งต้องเขียน autolog ก่อนส่งคืน

**ไฟล์:** `autolog.md` (ใหม่) · `CLAUDE.md`
**ทดสอบ:** ไม่ต้องทดสอบ (เอกสารล้วน ไม่มีโค้ดรัน)
**ค้าง:** รายการย้อนหลังสรุปจาก commit message + `PROGRESS.md` — รายละเอียดลึกของแต่ละ step ยังอยู่ที่ `PROGRESS.md` เหมือนเดิม

---

## 2026-07-22 07:09 · `487ba81` · 1.4e แถบ Archive + ปุ่มกันกดพลาด
**step:** 1.4e | **ประเภท:** ฟีเจอร์ + UX
- แถบสถานะ 3 ปุ่ม (กำลังทำ / Archive / ทั้งหมด) แทน checkbox เดิม
- เปลี่ยน adapter param `activeOnly` (bool) → `status` — bool รองรับได้แค่ 2 สถานะ แต่ต้องการ 3
- เพิ่ม `countPending(status)` ทั้ง 2 adapter (supabase ใช้ `Prefer: count=exact` ไม่ต้องโหลดข้อมูลลงมือถือ)
- ปุ่มเก็บเข้า Archive ต้องกด 2 ครั้ง · ไม่ยืนยันใน 4 วิ คืนสภาพเอง · ทางปลุกกลับไม่อันตราย กดครั้งเดียว

**ไฟล์:** `pending.js` · `adapter.js` · `local-adapter.js` · `supabase-adapter.js` · `dashboard.js` · `app.css` · `PROGRESS.md` · `Workflow/index.html`
**ทดสอบ:** 35/35 ผ่าน — รวมเช็กที่ DB ว่ากดครั้งแรกข้อมูลยังไม่ถูกแตะจริง + เลย์เอาต์ 390/820/1440 ปุ่มมือถือสูง 44px

---

## 2026-07-22 07:00 · (ไม่มี commit แยก) · แผนผังภาพรวม Workflow
**step:** — | **ประเภท:** เอกสาร
- สร้าง `Workflow/index.html` — แผนผังว่าโมดูลไหนสร้างถึงไหน (สถาปัตยกรรม 4 ชั้น · B1–B9 · F1–F10 · roadmap 23 step · ของค้าง)
- อ่านสถานะจาก repo จริง ไม่ได้ลอกจากเอกสาร

**ไฟล์:** `Workflow/index.html` (ใหม่ · เข้า repo พร้อม `487ba81`)
**ทดสอบ:** ตรวจ tag ครบคู่ · self-contained ไม่มี external dependency

---

## 2026-07-22 06:55 · `4f5d3e5` · 1.4d แก้ข้อมูลหายตอนบันทึก (ปัญหาเดียวกัน 2 ทิศทาง)
**step:** 1.4d | **ประเภท:** แก้บั๊ก 🔴 ข้อมูลหาย
- **ทิศ 1 (เจ้าของรายงาน):** พิมพ์บันทึกติดตามแล้วกดปุ่มบันทึกใหญ่โดยไม่กด "+ เพิ่มบันทึก" → ข้อความหายเงียบ ๆ
  แก้: ปุ่มบันทึกอ่าน `draftLog()` ให้ด้วย กดปุ่มไหนก็ได้ผลเหมือนกัน
- **ทิศ 2 (เจอระหว่างแก้ ร้ายกว่า):** แก้ 42 ช่องค้างไว้แล้วกด "+ เพิ่มบันทึก" → ที่แก้ทั้งหมดหาย
  เพราะ `lgAdd` เรียก `openDetail()` ใหม่ทั้งแผง ดึง DB มาทับ
  แก้: วาดใหม่เฉพาะรายการบันทึก (`reloadLogs` / `reloadQLogs`) ไม่แตะฟอร์ม

**ไฟล์:** `pending.js` · `app.css` · `PROGRESS.md`
**ทดสอบ:** 18/18 ผ่าน ครอบคลุมทั้งสองทิศ + เคสกดบันทึกใหญ่ตอนช่องว่างต้องไม่เพิ่มบันทึกซ้ำ

---

## 2026-07-22 06:37 · `2bbd802` · 1.5 เสร็จ — F3 Dashboard ภาพรวม + กราฟ
**step:** 1.5 | **ประเภท:** ฟีเจอร์ (ปิด step)
- KPI 4 การ์ด: เป้า · ปิดได้แล้ว · pipeline ถ่วงน้ำหนัก · coverage
- กราฟแท่งรายเดือน แผน vs ปิดจริง vs คาดปิด · funnel 6 ขั้น · top 3 · งานเลยกำหนด — SVG ล้วน ไม่มี library
- ⚠️ **เบี่ยงจากแผนโดยตั้งใจ:** ไม่ได้ทำ `views.sql` — คำนวณฝั่งเบราว์เซอร์แทน
  (ข้อมูลหลักร้อยแถวเร็วกว่า + ใช้ได้ทันทีไม่ต้องรอเจ้าของรัน SQL + ผู้ช่วยทดสอบเองได้) เหตุผลเต็มใน `PROGRESS.md`
- 🐛 บั๊กที่เทสต์จับได้ 2 ตัว: ตัวเลขขัดกันเองในหน้าเดียว (การ์ดกรองช่วงเป้า แต่ funnel นับทั้งหมด) ·
  ตัวหนังสือในกราฟเหลือ 4.4px บนมือถือ เพราะ `viewBox` คงที่ย่อตัวหนังสือไปด้วย → สร้าง SVG ตามความกว้างจริง

**ไฟล์:** `dashboard.js` (+287) · `app.css` · `config.js` · `CLAUDE.md` · `PROGRESS.md`
**ทดสอบ:** 47/47 ผ่าน (คณิตศาสตร์ 30 · การแสดงผล 17 · เลย์เอาต์ 390/820/1440)
**ค้าง:** ทดสอบโหมด local เท่านั้น — ตัวเลขบน Supabase จริงยังไม่มีใครตรวจ

---

## 2026-07-22 04:37 · `d2117ba` · 1.4c ปุ่มแก้ไขบันทึกที่เขียนไปแล้ว
**step:** 1.4c | **ประเภท:** ฟีเจอร์
- แก้ไขในที่ ไม่เปิด modal ซ้อน modal (บนมือถือ backdrop ทับกันจนกดปิดยาก)
- ปุ่มแก้ไขโผล่เฉพาะบันทึกที่ตัวเองเขียน (หรือ admin) — ให้ตรงกับ policy `follow_update` ฝั่ง DB
- adapter ตัด `pending_id` / `created_by` ออกก่อน PATCH — กันย้ายบันทึกข้ามงาน / สวมชื่อคนเขียน
- **RLS ปฏิเสธเงียบ ๆ = ได้ 200 แต่ไม่มีแถวกลับมา** → ดักเองแล้วโยน error ไม่งั้นผู้ใช้นึกว่าบันทึกสำเร็จ
- 🐛 แก้เอง: เดิมแคช `ME` ระดับ module → ออกจากระบบแล้วคนอื่นล็อกอินเครื่องเดียวกัน ค่าเก่าค้าง โชว์ปุ่มผิดคน

**ไฟล์:** `pending.js` · `adapter.js` · `supabase-adapter.js` · `local-adapter.js` · `app.css` · `PROGRESS.md`
**ทดสอบ:** 32/32 ผ่าน (แก้ไข 18 + regression 14)
**ค้าง:** ปุ่มลบบันทึก — ตั้งใจไม่ทำ รอ step 2.6 ที่ล็อกไม่ให้ลบหลังหัวหน้าเซ็นแล้ว

---

## 2026-07-22 04:23 · `9f27826` · 1.4b บันทึกความคืบหน้ารายวันให้เห็นและใช้ง่าย
**step:** 1.4b | **ประเภท:** UX
- บันทึกติดตามเดิมซ่อนอยู่ในฟอร์มเต็ม ต้องเปิด 42 ช่องเพื่อจดบรรทัดเดียว → เพิ่มแผงบันทึกด่วน

**ไฟล์:** `pending.js` · `app.css` · `PROGRESS.md` และอื่น ๆ รวม 6 ไฟล์
**ทดสอบ:** ผ่าน (รายละเอียดใน `PROGRESS.md`)

---

## 2026-07-21 22:06 · `7820b78` · 1.4 เสร็จ — F4 Pending Project UI เต็มระบบ
**step:** 1.4 (L) | **ประเภท:** ฟีเจอร์ (ปิด step)
- ฟอร์ม 42 ช่อง ครบฟอร์มกระดาษ 2 หน้า · ตาราง sort/ซ่อนคอลัมน์ · การ์ดบนมือถือ
- กรอง/เรียงตามเดือนคาดปิด — **dropdown ไม่ให้พิมพ์เอง** (ถ้าพิมพ์เองทีมจะกรอก `2569-07` ผ่าน constraint แต่เรียงผิดทั้งระบบ)
- preset: เดือนนี้ · ไตรมาสนี้ · ครึ่งปีหลัง 69 · กำหนดเอง · export CSV

**ไฟล์:** `pending.js` (+600) · `app.css` (+164) · `supabase-adapter.js` · `local-adapter.js` · `adapter.js` · `CLAUDE.md` · `PROGRESS.md`
**ทดสอบ:** 29/29 ผ่าน
**ค้าง:** ทดสอบโหมด local เท่านั้น — ยังไม่เคยมีใครเพิ่มงานจริงบน Supabase

---

## 2026-07-21 21:51 · `bd87108` · แก้ป้ายเป้ายอดขาย "80 MB" → "80 ล้านบาท"
**step:** — | **ประเภท:** แก้บั๊ก (สื่อสารผิด)
- `CONFIG.TARGET_MB` ย่อจาก Million Baht แต่ทีมขายอ่านเป็นเมกะไบต์
- แก้ช่วงเป้าเป็น ก.ค.–ธ.ค. 2569 (ครึ่งปีหลัง ไม่ใช่ทั้งปี) + เพิ่ม `CONFIG.TARGET_PERIOD`
- บันทึกกติกาลง `CLAUDE.md`: หน้าจอเขียน "ล้านบาท" เสมอ ห้ามเขียน "MB"

**ไฟล์:** `config.js` · `dashboard.js` · `CLAUDE.md`

---

## 2026-07-21 21:47 · `2dcce7e` · แก้ 2 บั๊กที่เจอหลังล็อกอินจริง
**step:** — | **ประเภท:** แก้บั๊ก
- **เมนูตกบรรทัดบน iPad:** CSS ซ่อนป้ายด้วย `.nav-item span:not(.ico)` แต่ป้ายไม่ได้อยู่ใน span → ซ่อนไม่ได้ ตัวหนังสือตกบรรทัดในแถบกว้าง 68px
  แก้: ครอบป้ายด้วย `<span class="lbl">` ทุกปุ่ม
- **หน้าภาพรวมพัง:** `getDashboardStats()` โยน `notReady()` → ทั้งหน้าขาว
  แก้: ครอบ try/catch + คืน `null` สำหรับตัวที่ยังนับไม่ได้ → แสดง "—" (0 แปลว่า "นับแล้วไม่มี" คนละความหมายกับ "ยังนับไม่ได้")
- เพิ่ม `countRows()` ใช้ `Prefer: count=exact` นับโดยไม่โหลดข้อมูลจริงลงมือถือ

**ไฟล์:** `index.html` · `app.css` · `supabase-adapter.js` · `local-adapter.js` · `dashboard.js`

---

## 2026-07-21 21:32 · `81e28b1` · 1.3 เสร็จ — F2 Data Adapter เติม query จริง
**step:** 1.3 | **ประเภท:** ฟีเจอร์ (ปิด step)
- `listTeams` · `listPending(opt)` · `getPending` · `savePending` · `archivePending` · `deletePending` · `listFollowLogs` · `addFollowLog`
- **`archivePending` = ทางลบปกติของ sale** (set `is_active=false`) · `deletePending` ลบถาวร RLS ปล่อยเฉพาะ admin
- กันไว้ในโค้ด: `SORTABLE` whitelist (ไม่เอาชื่อคอลัมน์จาก UI ต่อ URL ตรง ๆ) · `READONLY` ตัดก่อน PATCH ·
  `safeSearch()` ล้างอักขระพิเศษ PostgREST · ช่องว่าง → `null` · `nullslast` ทุก order

**ไฟล์:** `supabase-adapter.js` (+165) · `local-adapter.js` (+75) · `adapter.js` · `CLAUDE.md` · `PROGRESS.md`
**ทดสอบ:** `node --check` ผ่าน 4 ไฟล์ · parity 17 เมธอดครบทั้ง 2 adapter ·
ยิง query จริง → `401/42501 permission denied for anon` พิสูจน์ว่า anon อ่านไม่ได้จริง **และ** PostgREST แปล query ผ่าน
**ค้าง:** ยังไม่ได้ทดสอบด้วยบัญชีที่ล็อกอินจริง (ผู้ช่วยไม่มีรหัสผ่าน) + ตารางยังว่าง

---

## 2026-07-21 21:28 · `1074eb0` · สเปค v3
**step:** — | **ประเภท:** เอกสาร (สเปคเปลี่ยน)
- **Backup: ทำแค่ backup ไม่ทำ rollback รายแถว** — ตัด `record_history` + trigger ออกจากแผนถาวร
- เพิ่ม role `manager` + ตาราง `team_access` (แยก "ทำอะไรได้" ออกจาก "ที่ไหน")
- เพิ่ม step **2.6** หัวหน้าเซ็นรับทราบ (`signoffs` append-only) + step **3.8** AI Edge Function
- roadmap ขยาย 21 → **23 step**

**ไฟล์:** `CLAUDE.md` · `PROGRESS.md`
**ค้าง:** ⚠️ ตารางใน `PROGRESS.md` ยังไม่ได้เพิ่มแถว 2.6 กับ 3.8 → ตัวเลขความคืบหน้า 2 ไฟล์ไม่ตรงกัน

---

## 2026-07-21 20:41 · `de84378` · แก้บั๊ก service worker ทำให้ติดโค้ดเก่าถาวร
**step:** — | **ประเภท:** แก้บั๊ก 🔴 ร้ายแรง
- sw.js แคชแบบ cache-first → ผู้ใช้ที่เคยเปิดเว็บจะติดโค้ดเวอร์ชันเก่าตลอดไป แม้ deploy ใหม่แล้ว

**ไฟล์:** `sw.js`

---

## 2026-07-21 20:06 · `ace6ce8` · 1.2 เสร็จ — F1 App Shell + Login
**step:** 1.2 | **ประเภท:** ฟีเจอร์ (ปิด step)
- auth ครบวงจร: login / logout / จำ session ใน localStorage / ต่ออายุ token อัตโนมัติก่อนหมด 60 วิ / ดึง profile ผ่าน RLS จริง
- `app.js` เป็นประตูตรวจสิทธิ์: ไม่มี session = เห็นแค่หน้า login เปลี่ยน hash ก็เข้าไม่ได้
- รหัสผิด/อีเมลไม่มีในระบบ → ข้อความเดียวกัน (ไม่บอกใบ้ว่าอีเมลมีจริงไหม)
- 🐛 `.sidebar-foot` ซ่อนตั้งแต่ ≤1024px แต่ปุ่มออกจากระบบสำรองตั้งที่ ≤430px → **บน iPad ไม่มีปุ่มออกจากระบบเลย**

**ไฟล์:** `app.js` (+121) · `supabase-adapter.js` (+213) · `index.html` · `app.css` · `config.js` · `local-adapter.js` · `CLAUDE.md` · `PROGRESS.md`
**ทดสอบ:** ผ่านทุกข้อ · 390/820/1440 ไม่ล้นแนวนอน · ไม่มี JS error
> บทเรียน: `--window-size=390` ของ Chrome headless ไม่ได้ให้ viewport 390px (ขั้นต่ำ ~500px) — ต้องวัดผ่าน iframe

---

## 2026-07-21 08:07 · `f5320c3` · เตรียมโครงธีม/สี (step 3.7 ใหม่)
**step:** — | **ประเภท:** รีแฟกเตอร์เตรียมทาง
- ย้ายสีทั้งหมดไปเป็นตัวแปรใน `:root` · สวิตช์ที่ `<html data-theme="dark">` · เพิ่ม step 3.7 เข้า roadmap
- เหตุผล: ถ้าปล่อยให้ hardcode hex ไว้ ตอนทำธีมจะต้องไล่แก้ทั้งระบบ

**ไฟล์:** `app.css` · `index.html` · `CLAUDE.md` · `PROGRESS.md`

---

## 2026-07-21 07:51 · `367faa9` · ปิด step 1.1 + เติมขอบเขตงานทีม GOV.3
**step:** 1.1 | **ประเภท:** เอกสาร (ปิด step)
**ไฟล์:** `CLAUDE.md` · `PROGRESS.md` · `seed.sql`

---

## 2026-07-21 07:44 · `87d57ce` · 🐛 ข้อมูลไทยใน DB พัง + กันไม่ให้เกิดซ้ำ
**step:** 1.1 | **ประเภท:** แก้บั๊ก 🔴 ข้อมูลเสีย
- `LANG`/`LC_CTYPE` ในเครื่องว่าง → `pbcopy` แปลง UTF-8 เป็น MacRoman → ไทยเพี้ยนตั้งแต่ clipboard
- **ตรวจไม่เจอตอนแรกเพราะใช้ `pbcopy | pbpaste` ซึ่งแปลงกลับด้วยวิธีเดียวกัน**
- เคยวินิจฉัยผิดว่าเป็นปัญหาฟอนต์ แล้วปล่อยข้อมูลพังค้างใน DB หลายรอบ
- กติกาใหม่: ใช้ `LC_CTYPE=UTF-8 pbcopy` เสมอ · ตรวจด้วย `osascript -e 'the clipboard as text'`

**ไฟล์:** `CLAUDE.md` · `db/check.sql`
> บทเรียนที่บันทึกถาวร: **เครื่องมือที่ใช้ตรวจ ต้องไม่ใช่ตัวเดียวกับที่อาจเป็นต้นเหตุ**

---

## 2026-07-21 07:36 · `d82b8d7` · 🐛 ตั้ง admin คนแรกไม่ได้เพราะ trigger บล็อก
**step:** 1.1 | **ประเภท:** แก้บั๊ก (ไก่กับไข่)
- `guard_profile_privilege` เช็ก `is_admin()` แต่ใน SQL Editor `auth.uid()` เป็น null → false → บล็อกตัวเอง
- แก้เป็น `if auth.uid() is null or is_admin()` — null = มาจาก SQL Editor/service key ซึ่งเชื่อถือได้
  ส่วนคนยิงผ่าน REST API มี `auth.uid()` เสมอ จึงยังบล็อกอยู่

**ไฟล์:** `db/policies.sql`

---

## 2026-07-21 07:10–07:47 · `731226e` `710d297` `df90cbb` `5b6cb99` `22362dd` · ซ่อมหลังรัน SQL จริง
**step:** 1.1 | **ประเภท:** แก้บั๊ก + เครื่องมือ
- 🐛 **`731226e` GRANT ที่ขาด:** หลังรัน `schema.sql` ทั้ง 5 ตารางตอบ `42501 permission denied` ไม่ใช่ `[]`
  → Supabase รุ่นใหม่ไม่ GRANT ให้ `authenticated` อัตโนมัติแบบรุ่นเก่า
  **RLS คุม "เห็นแถวไหน" · GRANT คุม "แตะตารางได้ไหม"** ขาดตัวใดตัวหนึ่งก็ใช้ไม่ได้
  ถ้าไม่เจอตรงนี้ อาการที่จะเกิดคือ step 1.2 ล็อกอินผ่านแต่หน้าจอว่างเปล่า
- `710d297` เพิ่มทีม GOV.3 รวมเป็น 5 ทีม
- `df90cbb` + `5b6cb99` + `22362dd` สร้าง `db/check.sql` สคริปต์ตรวจสุขภาพระบบ (เปลี่ยนเป็น ASCII ล้วนกันปัญหา encoding)

**ไฟล์:** `db/policies.sql` · `db/check.sql` · `db/seed.sql` · `CLAUDE.md` · `PROGRESS.md`

---

## 2026-07-21 07:00 · `bb8b896` · 0.2 เสร็จ — ใส่ค่า Supabase ใน config.js
**step:** 0.2 | **ประเภท:** ตั้งค่า (ปิด step)
- project `Sales TE` (Singapore) · ใส่ URL + anon key (key สาธารณะ ใส่ใน public repo ได้)
- `DATA_MODE: 'supabase'`

**ไฟล์:** `config.js` · `README.md` · `PROGRESS.md`

---

## 2026-07-20 21:46 · `1d60892` · 1.1 — schema + RLS + seed (B1, B2)
**step:** 1.1 | **ประเภท:** ฟีเจอร์ (backend)
- `schema.sql` — `teams` `profiles` `pending_projects` `follow_logs` `project_contacts`
  ครบ 37 ช่องที่ prototype v3 บันทึก · ใส่ `is_active`/`archived_at` ไว้ตั้งแต่แรก → **step 2.5 ไม่ต้อง migration**
- `policies.sql` — RLS ครบ 5 ตาราง · `is_admin()`/`my_team_id()` เป็น SECURITY DEFINER
  (ถ้าไม่ใส่ policy ของ `profiles` จะวนไม่รู้จบ) · trigger กัน sale ตั้ง `role='admin'` ให้ตัวเอง
- `seed.sql` — 5 ทีม + คำสั่งตั้ง admin คนแรก

**ไฟล์:** `db/schema.sql` (+222) · `db/policies.sql` (+214) · `db/seed.sql` · `CLAUDE.md` · `PROGRESS.md` · `README.md`
**ทดสอบ:** ยังไม่รัน — รันจริงบน Supabase วันถัดมา (ผลตรวจ: RLS 5 ตาราง · 15 policy · anon แตะได้ 0)

---

## 2026-07-20 21:06 · `f91ce78` · Sync requirement v2
**step:** — | **ประเภท:** เอกสาร (สเปคเปลี่ยน)
- เพิ่ม AI Intake (F10) · Archive แสดง/ซ่อนงานจบแล้ว (2.5) · แถบ Supplier (F9/B7) → roadmap 18 → 20 step
- `CLAUDE.md` เข้า repo (เดิมไฟล์หายไป README ลิงก์ไปหาไม่เจอ)
- `_local/` เก็บ prototype v3 ไว้อ้างอิง — **gitignore แล้ว ห้าม commit** (มีข้อมูลลูกค้าจริง 90 ราย + อีเมล 102 + เบอร์มือถือ/ที่อยู่บ้าน)

**ไฟล์:** `CLAUDE.md` (ใหม่ +118) · `plan/te-sales-dashboard-build-plan.html` (+771) · `plan/form-book3-si-fields.md` · `ai-intake.js` · `suppliers.js` · `app.js` · `.gitignore`

---

## 2026-07-20 07:45 · `f9a8825` · Initial commit — โครงโปรเจกต์
**step:** 0.1 | **ประเภท:** ตั้งต้น
- โครง `docs/` ครบตามแผน (shell + css + adapter 3 ไฟล์ + module + PWA) · `db/` 4 ไฟล์ SQL เปล่า · `tools/import-json.html`
- `docs/.nojekyll` เพื่อให้ GitHub Pages ไม่กรองไฟล์ที่ขึ้นต้นด้วย `_`
- `.gitignore` กัน key/ข้อมูลลูกค้าหลุดขึ้น public repo

**ไฟล์:** 25 ไฟล์ · 894 บรรทัด
**ทดสอบ:** เปิดเว็บด้วย headless Chrome — โหลดผ่าน ไม่มี JS error
**ค้าง:** `manifest.json` ชี้ไป `icons/icon-192.png` / `icon-512.png` ที่ยังไม่มีไฟล์ → PWA warning (แก้ใน step 3.3)
