// F10 — AI Intake · ใหม่ v2 (Phase 3.5)
// ไม่ใช่หน้าใน router — เป็น modal ที่ทุกแท็บเรียกใช้ผ่านปุ่ม 🤖 AI Import
//
// 4 แหล่งนำเข้า:
//   namecard  รูปนามบัตร            → Book 3 สี
//   form      รูปฟอร์มกระดาษ/ลายมือ → Pending Project
//   obsidian  raw/TE-Pending project, raw/TE-Book 3 สี
//   notion    หน้า/ฐานข้อมูลใน Notion
//
// ขั้นตอน: เลือกแหล่ง → AI แกะเป็น JSON ตาม schema → preview + merge กันซ้ำ
// (จับคู่เบอร์โทร / ชื่อบริษัท / PENDING NO.) → ยืนยันแล้วจึงบันทึกจริง + log ทุกการนำเข้า

export const SOURCES = ['namecard', 'form', 'obsidian', 'notion'];

/** เปิด modal AI Import — เนื้อหาจริงมาใน Phase 3.5 */
export function openAIImport(source = 'namecard') {
  console.info('[ai-intake] Phase 3.5 · source =', source);
}

export default { SOURCES, openAIImport };
