// ช่องเพิ่มรูปถ่ายบุคคล — ใช้ในฟอร์ม Book 3 สี (step 3.9+)
//
// ทำไมย่อรูปก่อนเก็บ:
//   เก็บลงคอลัมน์ photo_url (text) เป็น data URL — ถ้าเก็บรูปจากมือถือดิบ ๆ (3–8 MB)
//   จะทำให้แถวใน DB บวม + PostgREST ตอบช้า/ตัด และ backup JSON บานตาม
//   → ย่อเหลือด้านยาว 512px + JPEG คุณภาพ 0.72 ก่อนเสมอ (เหลือ ~30–60KB) ก่อนเก็บ
//
// 🔒 ความปลอดภัย:
//   - รับเฉพาะไฟล์รูป (accept="image/*") + ตรวจ type ซ้ำตอนอ่าน
//   - ตอนแสดงผล รับเฉพาะ data:image/ หรือ http(s): เท่านั้น
//     (กัน javascript: หลุดเข้ามาทางข้อมูลนำเข้า — img src ไม่รัน js อยู่แล้ว แต่กันไว้อีกชั้น)
//   - รูปบุคคล = ข้อมูลส่วนบุคคล เก็บใน DB ที่มี RLS เท่านั้น ไม่ commit ลง repo

const MAX_SIDE = 512;
const QUALITY  = 0.72;

/** URL รูปที่ปลอดภัยจะเอาไปใส่ใน src เท่านั้น */
export function safePhoto(u) {
  const s = String(u || '');
  return (/^data:image\//i.test(s) || /^https?:\/\//i.test(s)) ? s : '';
}

/** อ่านไฟล์รูป → ย่อผ่าน canvas → คืน data URL (JPEG) */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('ไฟล์ต้องเป็นรูปภาพ'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปเสียหรือเปิดไม่ได้'));
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > MAX_SIDE || h > MAX_SIDE) {
          const r = Math.min(MAX_SIDE / w, MAX_SIDE / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/jpeg', QUALITY)); }
        catch (e) { reject(new Error('แปลงรูปไม่สำเร็จ: ' + e.message)); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/**
 * ต่อช่องรูปเข้ากับ DOM ที่มีโครง:
 *   <div class="photofield">
 *     <div class="pf-thumb" data-thumb></div>
 *     <input type="file" accept="image/*" data-file hidden>
 *     <button data-pick>...</button> <button data-clear>...</button>
 *     <input type="hidden" name="photo_url" data-photo>
 *   </div>
 * คืนฟังก์ชันอ่านค่า (data URL ปัจจุบัน) เผื่อ submit อยากอ่านตรง ๆ
 */
export function bindPhotoField(root, { onError } = {}) {
  const thumb = root.querySelector('[data-thumb]');
  const file  = root.querySelector('[data-file]');
  const hidden = root.querySelector('[data-photo]');
  const clear = root.querySelector('[data-clear]');

  const paint = () => {
    const u = safePhoto(hidden.value);
    thumb.innerHTML = u
      ? `<img src="${u}" alt="รูปลูกค้า">`
      : '<span class="pf-thumb-x">ยังไม่มีรูป</span>';
    if (clear) clear.hidden = !u;
  };
  paint();

  root.querySelector('[data-pick]')?.addEventListener('click', () => file.click());

  file?.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';                      // ให้เลือกไฟล์เดิมซ้ำได้
    if (!f) return;
    try {
      hidden.value = await fileToDataUrl(f);
      paint();
    } catch (e) {
      onError?.(e.message);
    }
  });

  clear?.addEventListener('click', () => { hidden.value = ''; paint(); });

  return () => hidden.value;
}

/** HTML ของช่องรูป (ใส่ค่าเดิมถ้ามี) */
export function photoFieldHtml(current) {
  const u = safePhoto(current);
  return `
    <div class="photofield">
      <div class="pf-thumb" data-thumb></div>
      <div class="pf-actions">
        <input type="file" accept="image/*" data-file hidden>
        <button type="button" class="btn btn-ghost btn-sm" data-pick>📷 เลือกรูป</button>
        <button type="button" class="btn btn-ghost btn-sm" data-clear ${u ? '' : 'hidden'}>ลบรูป</button>
        <p class="pf-hint">ย่อให้อัตโนมัติก่อนเก็บ · แสดงบน PDF ตอนสั่งพิมพ์</p>
      </div>
      <input type="hidden" name="photo_url" data-photo value="${u}">
    </div>`;
}
