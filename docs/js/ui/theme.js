// F13 — ธีม/สี (step 3.7)
//
// เลือกจาก "ธีมสำเร็จรูป" ที่คัดมาแล้ว ไม่เปิดให้จิ้มสีอิสระ
//   → กัน palette เสีย CVD-safe และคอนทราสต์ตก (กติกาใน CLAUDE.md)
//
// สลับด้วย attribute บน <html>:  data-theme (พื้น/ตัวอักษร) · data-accent (สีเน้น)
//   ค่าสีจริงทั้งหมดอยู่ใน docs/css/app.css เท่านั้น — ไฟล์นี้แค่สลับ attribute + จำค่า
//   (ไม่มี hex ในไฟล์นี้เลย ตามกติกา "สีทุกสีมาจากตัวแปรใน :root")
//
// ป้องกันจอกระพริบ: index.html มีสคริปต์ inline ใน <head> อ่าน localStorage แล้วตั้ง
// attribute ตั้งแต่ก่อน CSS วาด · ไฟล์นี้จัดการตอน "เปลี่ยน" ธีมและหน้าต่างเลือก

const LS_THEME  = 'te-dashboard:theme';
const LS_ACCENT = 'te-dashboard:accent';
const LS_FONT   = 'te-dashboard:font';

export const THEMES = [
  { id: 'noir',     label: 'Noir · ม่วงเข้ม', note: 'ค่าเริ่มต้น · ดีไซน์จาก Claude' },
  { id: 'brown',    label: 'Brown · กระดาษ', note: 'ดีไซน์จาก Claude · โทนน้ำตาลอุ่น' },
  { id: 'dark',     label: 'Linear Dark', note: 'ธีมเดิม · เข้าตา ใช้ในร่ม' },
  { id: 'light',    label: 'สว่าง',        note: 'พื้นขาว · อ่านง่ายบนจอสว่าง' },
  { id: 'contrast', label: 'คอนทราสต์สูง', note: 'ดำสนิท ตัวอักษรชัด · กลางแดด/สายตาไม่ชัด' },
];

// สีเน้น — คัดมาแล้ว CVD-safe (ตรงกับ [data-accent] ใน app.css)
export const ACCENTS = [
  { id: 'indigo', label: 'ม่วงคราม' },
  { id: 'blue',   label: 'ฟ้า' },
  { id: 'teal',   label: 'เขียวมรกต' },
  { id: 'amber',  label: 'เหลืองอำพัน' },
  { id: 'rose',   label: 'ชมพูกุหลาบ' },
];

// ฟอนต์ — bundle offline (ไม่พึ่ง CDN) · Sarabun subset ไทยอยู่ใน docs/fonts/
//   ไทย = ฟอนต์ที่เลือก · ตัวเลข/อังกฤษ = Inter (per-glyph fallback ใน --font)
export const FONTS = [
  { id: 'inter',   label: 'Inter',   note: 'ค่าเริ่มต้น · โมเดิร์น สะอาดตา' },
  { id: 'sarabun', label: 'Sarabun', note: 'ฟอนต์เอกสารไทย · เข้ากับฟอร์มที่พิมพ์' },
  { id: 'system',  label: 'ระบบ',    note: 'ฟอนต์เนทีฟของเครื่อง · เบาสุด' },
];

const THEME_IDS  = new Set(THEMES.map(t => t.id));
const ACCENT_IDS = new Set(ACCENTS.map(a => a.id));
const FONT_IDS   = new Set(FONTS.map(f => f.id));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function currentTheme() {
  const t = localStorage.getItem(LS_THEME);
  // ค่าเริ่มต้น = noir (ดีไซน์จาก Claude) — คนเปิดใหม่/ยังไม่เคยเลือกธีม เห็นดีไซน์นี้ก่อน
  return THEME_IDS.has(t) ? t : 'noir';
}
export function currentAccent() {
  const a = localStorage.getItem(LS_ACCENT);
  return ACCENT_IDS.has(a) ? a : 'indigo';
}
export function currentFont() {
  const f = localStorage.getItem(LS_FONT);
  return FONT_IDS.has(f) ? f : 'inter';
}

/** ตั้ง attribute บน <html> ให้ตรงกับค่าที่จำไว้ (idempotent · เรียกซ้ำได้) */
export function applyTheme() {
  document.documentElement.dataset.theme  = currentTheme();
  document.documentElement.dataset.accent = currentAccent();
  document.documentElement.dataset.font   = currentFont();
}

function setTheme(id) {
  if (!THEME_IDS.has(id)) return;
  try { localStorage.setItem(LS_THEME, id); } catch {}
  document.documentElement.dataset.theme = id;
}
function setAccent(id) {
  if (!ACCENT_IDS.has(id)) return;
  try { localStorage.setItem(LS_ACCENT, id); } catch {}
  document.documentElement.dataset.accent = id;
}
function setFont(id) {
  if (!FONT_IDS.has(id)) return;
  try { localStorage.setItem(LS_FONT, id); } catch {}
  document.documentElement.dataset.font = id;
}

// ══════════════════════════════════════════════════════════
// หน้าต่างเลือกธีม
// ══════════════════════════════════════════════════════════

export function openThemePicker() {
  document.getElementById('themeModal')?.remove();
  const host = document.createElement('div');
  host.className = 'modal';
  host.id = 'themeModal';
  document.body.appendChild(host);

  const paint = () => {
    const th = currentTheme(), ac = currentAccent(), fo = currentFont();
    host.innerHTML = `
      <div class="modal-box modal-sm">
        <div class="modal-head">
          <strong>🎨 ธีม & สี</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="thClose">ปิด</button>
        </div>
        <div class="modal-body">
          <p class="th-label">ธีม</p>
          <div class="th-themes">
            ${THEMES.map(t => `
              <button type="button" class="th-card ${t.id === th ? 'on' : ''}" data-theme-pick="${t.id}">
                <span class="th-swatch" data-theme="${t.id}" data-accent="${ac}"><i class="s-bg"></i><i class="s-ac"></i><i class="s-tx"></i></span>
                <span class="th-name">${esc(t.label)}</span>
                <span class="th-note">${esc(t.note)}</span>
              </button>`).join('')}
          </div>

          <p class="th-label">สีเน้น</p>
          <div class="th-accents">
            ${ACCENTS.map(a => `
              <button type="button" class="th-dot ${a.id === ac ? 'on' : ''}"
                      data-accent-pick="${a.id}" data-accent="${a.id}"
                      title="${esc(a.label)}" aria-label="${esc(a.label)}"><i></i></button>`).join('')}
          </div>

          <p class="th-label">ฟอนต์</p>
          <div class="th-fonts">
            ${FONTS.map(f => `
              <button type="button" class="th-card ${f.id === fo ? 'on' : ''}" data-font-pick="${f.id}">
                <span class="th-fontsample" data-font="${f.id}">ก ข ค · Aa · 123</span>
                <span class="th-name">${esc(f.label)}</span>
                <span class="th-note">${esc(f.note)}</span>
              </button>`).join('')}
          </div>

          <p class="th-hint">ระบบจำค่าไว้ในเครื่องนี้ · เปิดครั้งหน้าจะใช้ธีม/ฟอนต์เดิม</p>
        </div>
      </div>`;

    host.querySelectorAll('[data-theme-pick]').forEach(b =>
      b.addEventListener('click', () => { setTheme(b.dataset.themePick); paint(); }));
    host.querySelectorAll('[data-accent-pick]').forEach(b =>
      b.addEventListener('click', () => { setAccent(b.dataset.accentPick); paint(); }));
    host.querySelectorAll('[data-font-pick]').forEach(b =>
      b.addEventListener('click', () => { setFont(b.dataset.fontPick); paint(); }));
    host.querySelector('#thClose').addEventListener('click', () => host.remove());
  };

  paint();
  host.addEventListener('mousedown', (e) => { if (e.target === host) host.remove(); });
}

export default { THEMES, ACCENTS, FONTS, applyTheme, openThemePicker, currentTheme, currentAccent, currentFont };
