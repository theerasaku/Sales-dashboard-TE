# ไอคอนแอป (สร้างจริงแล้วใน step 3.3)

| ไฟล์ | ขนาด | ใครใช้ |
|---|---|---|
| `icon-192.png` | 192×192 | Android / manifest (`purpose: any`) |
| `icon-512.png` | 512×512 | Android / manifest (`purpose: any`) |
| `icon-maskable-512.png` | 512×512 | Android ที่ครอบไอคอนเป็นวงกลม (`purpose: maskable`) |
| `apple-touch-icon.png` | 180×180 | **iOS เท่านั้น** — Safari ไม่อ่านไอคอนใน `manifest.json` เลย |
| `favicon-32.png` | 32×32 | แท็บเบราว์เซอร์ |

## กติกาที่ห้ามพลาด

- **maskable ต้องเป็นคนละไฟล์กับ any** — Android ครอบ maskable เป็นวงกลมแล้วตัดขอบทิ้งราว 20%
  ถ้าใช้ไฟล์เดียวกัน ตัวอักษรจะโดนตัด · ไฟล์ maskable จึงย่อ "TE" ให้อยู่ในวงกลมกลาง
- **iOS ต้องมี `apple-touch-icon`** ไม่งั้นตอน "เพิ่มไปยังหน้าจอโฮม" Safari จะไปจับภาพหน้าจอมาทำไอคอนแทน
- แก้ไอคอนแล้วต้อง **bump `VERSION` ใน `docs/sw.js`** ด้วย ไม่งั้นเครื่องที่ติดตั้งไว้แล้วยังใช้ของเก่าจาก cache

## สร้างใหม่ยังไง

ทำจาก HTML แล้วให้ Chrome ถ่ายภาพออกมา ไม่ต้องใช้โปรแกรมกราฟิก —
เขียนหน้า HTML ที่มีกล่อง 512×512 พื้นไล่สีจาก `--accent` (#5e6ad2) กับตัวอักษร "TE"
แล้วใช้ puppeteer `screenshot()` ตั้ง `deviceScaleFactor = ขนาดที่ต้องการ / 512`
(สคริปต์ `icon.html` + `mkicon.mjs` อยู่ในโฟลเดอร์ทดสอบของ session ที่ทำ step 3.3)
