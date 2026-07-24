// แถบลายเซ็นหัวหน้า — ใช้ร่วมกันทั้ง Pending Project และ Book 3 สี (step 2.6)
//
// ⚠️ ห้ามก๊อปโค้ดไฟล์นี้ไปวางที่อื่น ให้ import ใช้
//    ตรรกะ "ลายเซ็นค้าง" อยู่ที่ signoffState() จุดเดียว
//    ถ้าเขียนซ้ำอีกที่แล้ววันหนึ่งแก้ไม่ครบ จะเกิดเคสที่หน้าหนึ่งบอก "ตรวจแล้ว"
//    อีกหน้าบอก "รอตรวจ" สำหรับงานชิ้นเดียวกัน

import { thaiDate } from './datepicker.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** ใครกดเซ็นได้ — ต้องตรงกับ policy signoff_insert ฝั่ง DB */
export const canSign = (me) => !!me && (me.role === 'admin' || me.role === 'manager');

/**
 * สถานะลายเซ็นของแถวหนึ่ง
 *
 * ⭐ หัวใจอยู่ที่การเทียบ signed_version กับ updated_at ปัจจุบัน
 *    ไม่ตรง = มีคนแก้ข้อมูลหลังหัวหน้าเซ็น → ต้องนับเป็น "ยังไม่ได้ตรวจ"
 *    (เคสจริง: เซ็นวันจันทร์ตอน 5 ล้าน → sale แก้เป็น 50 ล้านวันอังคาร)
 *
 * เทียบด้วย getTime() ไม่ใช่เทียบสตริง เพราะ timestamptz ที่เดินทางผ่าน JSON
 * อาจกลับมาคนละรูปแบบ ('+07' กับ 'Z') ทั้งที่เป็นเวลาเดียวกัน
 */
export function signoffState(row, so) {
  if (!so) return { kind: 'none' };

  const a = new Date(so.signed_version).getTime();
  const b = new Date(row?.updated_at || 0).getTime();
  const who = so.profiles?.full_name || so.profiles?.email || 'หัวหน้างาน';
  const when = String(so.signed_at || '').slice(0, 10);

  return {
    kind: (Number.isFinite(a) && Number.isFinite(b) && a === b) ? 'signed' : 'stale',
    who, when, note: so.reviewed_note || '',
  };
}

/** ต้องให้หัวหน้าตรวจไหม — ใช้ทั้งหน้า "รอตรวจ" และป้ายนับบนเมนู */
export const needsReview = (st) => st.kind !== 'signed';

const LABEL = {
  none:   { icon: '○', text: 'ยังไม่ได้ตรวจ',  cls: 'so-none' },
  signed: { icon: '✓', text: 'ตรวจแล้ว',      cls: 'so-ok' },
  stale:  { icon: '⚠', text: 'แก้ไขหลังเซ็น', cls: 'so-stale' },
};

/** ป้ายเล็กสำหรับแสดงในตาราง/รายการ */
export function signoffTag(st) {
  const l = LABEL[st.kind];
  return `<span class="so-tag ${l.cls}" title="${esc(l.text)}">${l.icon} ${esc(l.text)}</span>`;
}

/**
 * แถบเต็มสำหรับใส่ในฟอร์มรายละเอียด
 * @param st   ผลจาก signoffState()
 * @param sign true = แสดงปุ่มเซ็น (คนที่มีสิทธิ์เท่านั้น)
 */
export function signoffBarHtml(st, sign) {
  const l = LABEL[st.kind];

  const detail =
    st.kind === 'signed'
      ? `ตรวจโดย <b>${esc(st.who)}</b> เมื่อ ${esc(thaiDate(st.when) || st.when)}`
      : st.kind === 'stale'
        ? `${esc(st.who)} ตรวจไว้เมื่อ ${esc(thaiDate(st.when) || st.when)}
           — <b>แต่ข้อมูลถูกแก้หลังจากนั้น จึงนับเป็นยังไม่ได้ตรวจ</b>`
        : 'ยังไม่มีหัวหน้าเซ็นรับทราบข้อมูลชุดนี้';

  return `
    <div class="so-bar ${l.cls}">
      <span class="so-ico">${l.icon}</span>
      <div class="so-body">
        <div class="so-h">${esc(l.text)}</div>
        <div class="so-d">${detail}</div>
        ${st.note ? `<div class="so-note">“${esc(st.note)}”</div>` : ''}
      </div>
      ${sign ? `<button type="button" class="btn btn-sm btn-primary" id="soSign">
                  ${st.kind === 'none' ? 'เซ็นรับทราบ' : 'เซ็นรับทราบใหม่'}
                </button>` : ''}
    </div>
    ${sign ? `<div class="so-form" id="soForm" hidden>
        <label class="fld fld-wide"><span>บันทึกการตรวจ (ไม่บังคับ)</span>
          <textarea id="soNote" rows="2" placeholder="เช่น ตัวเลขถูกต้อง · ให้ตามลูกค้าอีกรอบภายในสิ้นเดือน"></textarea></label>
        <p class="so-warn">
          ⚠️ ลายเซ็นลบไม่ได้และแก้ไม่ได้ แม้แต่ผู้ดูแลระบบ — ตรวจให้แน่ใจก่อนกดยืนยัน
        </p>
        <div class="so-foot">
          <button type="button" class="btn btn-ghost btn-sm" id="soCancel">ยกเลิก</button>
          <button type="button" class="btn btn-primary btn-sm" id="soConfirm">ยืนยันการเซ็น</button>
        </div>
      </div>
      <p class="login-err" id="soErr" role="alert" hidden></p>` : ''}`;
}

/**
 * ประวัติการเซ็นรับทราบทั้งหมด (timeline เล็ก ๆ) — ใช้แสดงใกล้บันทึกกิจกรรม (step 3.11)
 * แต่ละครั้ง: 🔖 วันที่ + ผู้ตรวจ + ปุ่มขยายดูคอมเมนต์ (reviewed_note)
 * list = จาก adapter.listSignoffHistory() (เก่า→ใหม่)
 */
export function signoffHistoryHtml(list) {
  if (!list?.length) return '';
  return `<ul class="so-hist">
    ${list.map((s, i) => {
      const who  = s.profiles?.full_name || s.profiles?.email || 'หัวหน้างาน';
      const when = String(s.signed_at || '').slice(0, 10);
      const note = s.reviewed_note || '';
      return `<li class="so-hist-item">
        <button type="button" class="so-hist-head"${note ? ` data-so-toggle="${i}"` : ' disabled'}>
          <span class="so-hist-ico">🔖</span>
          <span class="so-hist-txt">เซ็นรับทราบ · ${esc(thaiDate(when) || when)} · <b>${esc(who)}</b></span>
          ${note ? '<span class="so-hist-caret">▾ ดูคอมเมนต์</span>' : '<span class="so-hist-nonote">— ไม่มีคอมเมนต์ —</span>'}
        </button>
        ${note ? `<div class="so-hist-note" id="soHistNote${i}" hidden>“${esc(note)}”</div>` : ''}
      </li>`;
    }).join('')}
  </ul>`;
}

/** ผูกปุ่มขยาย/ยุบคอมเมนต์ในประวัติการเซ็น */
export function bindSignoffHistory(host) {
  host.querySelectorAll('[data-so-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = host.querySelector('#soHistNote' + btn.dataset.soToggle);
      if (!el) return;
      el.hidden = !el.hidden;
      btn.classList.toggle('open', !el.hidden);
    });
  });
}

/**
 * ผูกปุ่มเซ็นในแถบข้างบน
 * @param host        element ที่มีแถบอยู่ข้างใน
 * @param targetTable 'pending_projects' | 'customers'
 * @param targetId    id ของแถว
 * @param addSignoff  adapter.addSignoff
 * @param onSigned    เรียกหลังเซ็นสำเร็จ (ผู้เรียกไปโหลดข้อมูลใหม่เอง)
 */
export function bindSignoff(host, targetTable, targetId, addSignoff, onSigned) {
  const q = (s) => host.querySelector(s);
  const btn = q('#soSign');
  if (!btn) return;

  const form = q('#soForm');
  const err  = q('#soErr');

  btn.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) q('#soNote')?.focus();
  });
  q('#soCancel')?.addEventListener('click', () => { form.hidden = true; });

  q('#soConfirm')?.addEventListener('click', async () => {
    const c = q('#soConfirm');
    err.hidden = true;
    c.disabled = true; c.textContent = 'กำลังเซ็น…';
    try {
      await addSignoff(targetTable, targetId, q('#soNote')?.value.trim() || null);
      await onSigned();
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      c.disabled = false; c.textContent = 'ยืนยันการเซ็น';
    }
  });
}
