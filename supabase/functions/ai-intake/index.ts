// Supabase Edge Function — ai-intake (step 3.8)
//
// หน้าที่: รับรูป/ข้อความจาก frontend → เรียก Claude vision อ่าน (ลายมือไทยได้) →
//          คืน "ข้อความ JSON" กลับไปให้ frontend แกะ (parsePasted) แล้วพักใน intake_items
//
// ⭐ ทำไมต้องมีชั้นนี้: ANTHROPIC_API_KEY ใส่ใน frontend ไม่ได้เด็ดขาด
//    repo เป็น public + ต่อให้ private ใครเปิด DevTools ก็อ่าน key ได้ → โดนยิงจนบิลบาน
//    key จึงอยู่ใน Supabase secrets ฝั่งเซิร์ฟเวอร์เท่านั้น (ไฟล์นี้อ่านผ่าน Deno.env)
//
// 🔒 ห้ามฝังค่า key ในไฟล์นี้เด็ดขาด — อ่านจาก Deno.env เท่านั้น
//
// deploy:  supabase functions deploy ai-intake --no-verify-jwt
//          supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (--no-verify-jwt ให้ preflight CORS ผ่าน → เราตรวจ JWT เองในโค้ดแทน · ดู verifyUser)
//
// 3.5 (ก๊อปคำสั่งไปวางใน Claude เอง) ยังใช้ได้ตลอดถ้าไม่ได้ deploy ตัวนี้ — เป็นทางสำรองฟรี

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("AI_INTAKE_MODEL") || "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * ตรวจว่าเป็นผู้ใช้ที่ล็อกอินจริง (กันคนนอกยิงใช้ API key เราฟรี)
 * เรียก Supabase auth ด้วย token ที่ frontend แนบมา — 200 = ผู้ใช้จริง
 */
async function verifyUser(authHeader: string | null): Promise<boolean> {
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authHeader || !supaUrl || !anon) return false;
  try {
    const r = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anon },
    });
    return r.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "ใช้ POST เท่านั้น" }, 405);

  // 1) ต้องเป็นผู้ใช้ที่ล็อกอิน
  if (!(await verifyUser(req.headers.get("authorization")))) {
    return json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);
  }

  // 2) ต้องมี key ฝั่งเซิร์ฟเวอร์
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return json({
      error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Supabase secrets — รัน `supabase secrets set ANTHROPIC_API_KEY=...`",
    }, 500);
  }

  // 3) อ่าน payload จาก frontend
  let payload: { prompt?: string; text?: string; image?: { media_type: string; data: string } };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "อ่าน body ไม่ได้ (ต้องเป็น JSON)" }, 400);
  }
  const { prompt, text, image } = payload;
  if (!prompt) return json({ error: "ไม่มีคำสั่ง (prompt)" }, 400);
  if (!image && !text) return json({ error: "ต้องแนบรูป (image) หรือข้อความ (text) อย่างน้อยหนึ่งอย่าง" }, 400);

  // 4) ประกอบ message ให้ Claude — รูปมาก่อน แล้วตามด้วยคำสั่ง (+ ข้อความถ้ามี)
  const content: unknown[] = [];
  if (image?.data && image?.media_type) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.media_type, data: image.data },
    });
  }
  content.push({
    type: "text",
    text: prompt + (text ? `\n\nข้อความจากผู้ใช้:\n${text}` : ""),
  });

  // 5) เรียก Claude
  let aiRes: Response;
  try {
    aiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        // system เน้นย้ำ: ตอบ JSON array อย่างเดียว (เผื่อ prompt ฝั่ง client หลุด)
        system:
          "คุณเป็นตัวช่วยแปลงข้อมูลจากเอกสาร/นามบัตร/ฟอร์มลายมือ (ภาษาไทยได้) เป็น JSON " +
          "สำหรับระบบ Sales Dashboard เท่านั้น ตอบกลับเป็น JSON array อย่างเดียว ห้ามมีข้อความอื่น",
        messages: [{ role: "user", content }],
      }),
    });
  } catch {
    return json({ error: "เรียก Claude ไม่สำเร็จ (เครือข่ายฝั่งเซิร์ฟเวอร์)" }, 502);
  }

  const data = await aiRes.json().catch(() => null);
  if (!aiRes.ok) {
    const msg = (data && (data.error?.message || data.error)) || `Claude ตอบ ${aiRes.status}`;
    return json({ error: String(msg) }, 502);
  }

  // 6) คืนเฉพาะข้อความ — frontend เอาไปแกะด้วย parsePasted (โค้ดเดิมของ 3.5)
  const out = Array.isArray(data?.content)
    ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text).join("\n")
    : "";
  return json({ text: out });
});
