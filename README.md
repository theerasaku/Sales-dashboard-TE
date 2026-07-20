# TE Sales Dashboard

ระบบ dashboard งานขาย Thammasorn Engineering — Pending Project, Book 3 สี, กิจกรรมลูกค้า, แหล่งงาน

- **Frontend:** static HTML/CSS/JS (module) host บน GitHub Pages จากโฟลเดอร์ `docs/`
- **Data:** เรียกผ่าน `docs/js/data/adapter.js` เท่านั้น → สลับระหว่าง Supabase / local ได้
- **Backend:** Supabase (PostgreSQL + Auth + RLS) — เส้นทางหลัก

## โครงสร้าง

```
docs/            ← GitHub Pages (root ของเว็บ)
  index.html
  css/app.css
  js/app.js, js/config.js
  js/data/adapter.js | supabase-adapter.js | local-adapter.js
  js/modules/dashboard.js | pending.js | book3.js | activities.js | sources.js
  manifest.json, sw.js, icons/
db/              ← schema.sql, policies.sql, views.sql, seed.sql
tools/           ← import-json.html (migrate ข้อมูล JSON v1/v2/v3 เดิม)
```

## รันในเครื่อง

เปิด `docs/index.html` ผ่าน static server (ไฟล์เป็น ES module ต้องใช้ http ไม่ใช่ file://)

```
python3 -m http.server 8080 --directory docs
# เปิด http://localhost:8080
```

โหมดเริ่มต้นคือ `local` (เก็บใน localStorage) ยังไม่ต้องมี Supabase

## เปิด GitHub Pages

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / โฟลเดอร์ `/docs` → Save

## ⚠️ ความปลอดภัย

Repo นี้เป็น **public** — ห้าม commit:
- `service_role` key ของ Supabase (ใช้ได้เฉพาะ `anon` key)
- ข้อมูลลูกค้าจริง / ข้อมูลโครงการจริง

ความปลอดภัยจริงอยู่ที่ RLS ที่ฝั่ง database

## สถานะ

ดู `PROGRESS.md`
