# Edge Function: ai-intake (step 3.8)

อ่านรูปนามบัตร/ฟอร์มกระดาษ/ลายมือด้วย Claude vision → คืน JSON ให้หน้าเว็บพักใน `intake_items`

**ทำไมต้องมี:** `ANTHROPIC_API_KEY` ใส่ใน frontend ไม่ได้ (repo เป็น public + เปิด DevTools ก็อ่าน key ได้)
→ key อยู่ใน Supabase secrets ฝั่งเซิร์ฟเวอร์เท่านั้น · ฟังก์ชันนี้เป็น "ตัวกลาง" ถือ key ให้

## ติดตั้งครั้งเดียว

ต้องมี [Supabase CLI](https://supabase.com/docs/guides/cli) ก่อน (`brew install supabase/tap/supabase`)

```bash
# 1) ล็อกอิน + ผูกกับโปรเจกต์ (project ref อยู่ใน URL ของ Supabase dashboard)
supabase login
supabase link --project-ref ejszfgsecuuysaamvtcn

# 2) ตั้ง API key ของ Anthropic (ขอที่ console.anthropic.com) — เก็บฝั่งเซิร์ฟเวอร์
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# 3) deploy ฟังก์ชัน
#    --no-verify-jwt = ให้ preflight CORS ผ่าน · ฟังก์ชันตรวจ JWT เองในโค้ด (verifyUser)
supabase functions deploy ai-intake --no-verify-jwt
```

เสร็จแล้วปุ่ม **📷 ให้ AI อ่านรูป** ในแอป (แถบ Pending / Book 3 สี → 🤖 AI Import) จะใช้งานได้

## หมายเหตุ

- **ไม่ deploy ก็ยังใช้งานได้** — ใช้วิธี "ก๊อปคำสั่งไปวางใน Claude เอง" (3.5) เป็นทางสำรอง ฟรี ไม่มีค่า API
- เปลี่ยนรุ่นโมเดลได้: `supabase secrets set AI_INTAKE_MODEL=claude-opus-4-8` (ค่าตั้งต้น `claude-sonnet-5`)
- 🔒 **ห้าม commit API key** ลง repo เด็ดขาด — ตั้งผ่าน `supabase secrets set` เท่านั้น
- ค่าที่ Supabase ใส่ให้อัตโนมัติในฟังก์ชัน: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (ใช้ตรวจ JWT)
