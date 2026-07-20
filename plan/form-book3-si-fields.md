# ฟอร์ม Book 3 สี (Potential) — รายการฟิลด์ต้นฉบับ

ถอดจากฟอร์มกระดาษ `ฟอร์ม BOOK 3 สี.pdf` (2 หน้า) เพื่อใช้ออกแบบตาราง `customers` + `customer_logs` (B3)

> ต้นฉบับ PDF เป็นฟอร์มเปล่า ไม่มีข้อมูลลูกค้า — ถ้าต้องการเก็บไฟล์ PDF ไว้ในโปรเจกต์ วางไว้ที่ `plan/` ได้เลย

## หน้า 1 — ข้อมูลลูกค้า

| ฟิลด์ในฟอร์ม | คอลัมน์ที่เสนอ | หมายเหตุ |
|---|---|---|
| No. | `no` | รหัสลูกค้าในสมุด |
| NAME / SURNAME | `name` | ฟอร์มแยกชื่อ-สกุล · prototype v3 รวมเป็นช่องเดียว |
| BIRTHDAY | `birthday` | date |
| AGE | — | คำนวณจาก `birthday` ไม่ต้องเก็บ |
| POSITION | `position` | |
| CONTACT (TELEPHONE) | `tel` | |
| CONTACT (EMAIL) | `email` | |
| ADDRESS (OFFICE) | `addr_office` | |
| ADDRESS (HOME) | `addr_home` | |
| ADDRESS (HOMETOWN) | `addr_hometown` | ภูมิลำเนา |
| EDUCATION 1–3 | `education` | ฟอร์มมี 3 บรรทัด · เก็บเป็น text หลายบรรทัด |
| FAMILY · WIFE/HUSBAND + POSITION | `family` | ฟอร์มแยก 3 กลุ่ม (คู่สมรส / บุตร / อื่น ๆ) แต่ละกลุ่มมีช่อง POSITION |
| FAMILY · SON/DAUGHTER + POSITION | `family` | |
| FAMILY · OTHER + POSITION | `family` | |
| HOBBY | `hobby` | |
| FAVORITE | `favorite` | |
| (รูปติดมุมขวาบน) | `photo_url` | ฟอร์มมีกรอบรูป — เก็บ URL ถ้าจะรองรับ |

## หน้า 1–2 — ตารางบันทึกการติดตาม

ตาราง 4 คอลัมน์ ต่อเนื่องข้ามหน้า → แยกเป็นตาราง `customer_logs`

| ฟิลด์ในฟอร์ม | คอลัมน์ที่เสนอ |
|---|---|
| DATE | `log_date` |
| BY | `by_user` / `by_name` |
| RESPONSE | `response` |
| NEXT DOING | `next_doing` |

โครงเดียวกับ `follow_logs` ของ B2 (Pending Project) — ใช้รูปแบบเดียวกันได้

## ฟิลด์ที่ไม่มีในฟอร์มกระดาษ แต่ระบบต้องมี

- `status` — สี 3 ระดับ: 🟢 สนิท/ซื้อประจำ · 🟡 มีโอกาส · 🔴 เพิ่งเริ่ม
- `org` — หน่วยงาน/บริษัท (prototype v3 มี แต่ฟอร์มกระดาษไม่มีช่องแยก)
- `sale_id` — sale ผู้ดูแล (สำหรับ RLS แยกทีม)
- `is_active` — archive แสดง/ซ่อนลูกค้าที่ไม่ active (step 2.5)
- `created_by` / `updated_at` — audit ตาม Security ข้อ 5
