// รายการบันทึกติดตาม + แก้ไขในที่ — ใช้ร่วมกันทั้ง Pending Project และ Book 3 สี
//
// ทั้งสองที่ใช้ฟอร์มเดียวกัน (DATE / BY / RESPONSE / NEXT DOING) ต่างแค่ตารางปลายทาง
// จึงรับ `updateFn` เข้ามา แทนที่จะผูกกับ adapter ตัวใดตัวหนึ่ง
//
// ⚠️ ส่วนนี้เคยมีบั๊ก 2 ตัว อย่าก๊อปไปทำซ้ำที่อื่น ให้เรียกใช้ไฟล์นี้:
//   1. เปิด modal ซ้อน modal → บนมือถือกดปิดยาก backdrop ทับกันจนงง
//      → แก้ไข "ในที่" แทน (บรรทัดนั้นกลายเป็นฟอร์ม)
//   2. วาดใหม่ทั้งแผงหลังบันทึก → ทับสิ่งที่ผู้ใช้พิมพ์ค้างไว้ในฟอร์มใหญ่
//      → ผู้เรียกต้องวาดใหม่เฉพาะรายการบันทึก ไม่ใช่ทั้งแผง

import { dateField, thaiDate } from './datepicker.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/**
 * ปุ่มแก้ไขโผล่เฉพาะบันทึกที่ตัวเองเขียน (หรือ admin)
 * ให้ตรงกับ policy ฝั่ง DB — ถ้าโชว์ปุ่มให้คนที่กดไม่ผ่าน เขาจะกดแล้วเจอ error งง ๆ
 */
export const canEditLog = (l, me) =>
  !!me && (!l.created_by || l.created_by === me.id || me.role === 'admin');

export function logListHtml(logs, me) {
  if (!logs?.length) return '<li class="log-empty">ยังไม่มีบันทึก</li>';
  return logs.map(l => `
    <li data-log-item="${esc(l.id)}">
      <div class="log-view">
        <div class="log-h">
          <b>${esc(thaiDate(l.log_date) || l.log_date)}</b> ${esc(l.by_name || '')}
          ${canEditLog(l, me)
            ? `<button type="button" class="btn-log log-edit" data-edit="${esc(l.id)}">แก้ไข</button>`
            : ''}
        </div>
        ${l.response   ? `<div>${esc(l.response)}</div>` : ''}
        ${l.next_doing ? `<div class="log-next">→ ${esc(l.next_doing)}</div>` : ''}
      </div>
    </li>`).join('');
}

/**
 * ผูกปุ่ม "แก้ไข" ของทุกบันทึกใน host
 * @param host     element ที่มี [data-edit] อยู่ข้างใน
 * @param logs     รายการบันทึกชุดเดียวกับที่วาด
 * @param updateFn (id, patch) => Promise — เช่น adapter.updateFollowLog / updateCustomerLog
 * @param onSaved  เรียกหลังบันทึกสำเร็จ (ผู้เรียกวาดรายการใหม่เอง)
 */
export function bindLogEditing(host, logs, updateFn, onSaved) {
  host?.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.edit;
      const l  = logs.find(x => String(x.id) === String(id));
      const li = host.querySelector(`[data-log-item="${CSS.escape(String(id))}"]`);
      if (!l || !li || li.querySelector('.log-edit-box')) return;

      li.querySelector('.log-view').hidden = true;
      const box = document.createElement('div');
      box.className = 'log-edit-box';
      box.innerHTML = `
        <div class="fgrid">
          <label class="fld"><span>DATE</span>
            ${dateField('', l.log_date, { cls: 'dp-log-date', label: 'วันที่บันทึก' })}</label>
          <label class="fld"><span>BY</span>
            <input type="text" data-f="by_name" value="${esc(l.by_name || '')}"></label>
          <label class="fld fld-wide"><span>RESPONSE</span>
            <textarea data-f="response" rows="2">${esc(l.response || '')}</textarea></label>
          <label class="fld fld-wide"><span>NEXT DOING</span>
            <textarea data-f="next_doing" rows="2">${esc(l.next_doing || '')}</textarea></label>
        </div>
        <p class="login-err" data-err hidden></p>
        <div class="log-edit-foot">
          <button type="button" class="btn btn-ghost btn-sm" data-cancel>ยกเลิก</button>
          <button type="button" class="btn btn-primary btn-sm" data-save>บันทึกการแก้ไข</button>
        </div>`;
      li.appendChild(box);

      const err = box.querySelector('[data-err]');
      box.querySelector('[data-cancel]').addEventListener('click', () => {
        box.remove();
        li.querySelector('.log-view').hidden = false;
      });

      box.querySelector('[data-save]').addEventListener('click', async () => {
        err.hidden = true;
        const patch = {};
        box.querySelectorAll('[data-f]').forEach(f => { patch[f.dataset.f] = f.value; });
        // ช่องวันที่เป็นปฏิทินเอง (hidden input) ไม่มี data-f
        const dp = box.querySelector('input.dp-log-date');
        if (dp) patch.log_date = dp.value;

        if (!String(patch.response).trim() && !String(patch.next_doing).trim()) {
          err.textContent = 'ต้องมี RESPONSE หรือ NEXT DOING อย่างน้อยหนึ่งช่อง';
          err.hidden = false;
          return;
        }

        const sv = box.querySelector('[data-save]');
        sv.disabled = true; sv.textContent = 'กำลังบันทึก…';
        try {
          await updateFn(id, patch);
          await onSaved();
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
          sv.disabled = false; sv.textContent = 'บันทึกการแก้ไข';
        }
      });
    });
  });
}

/** ฟอร์มเพิ่มบันทึก 4 ช่องตามฟอร์มกระดาษ — ใช้ทั้งสองโมดูล */
export function logFormHtml(idPrefix = 'lg') {
  return `
    <div class="fgrid">
      <label class="fld"><span>DATE — วันที่</span>
        ${dateField('', new Date().toISOString().slice(0, 10), { id: idPrefix + 'Date', label: 'วันที่บันทึก' })}</label>
      <label class="fld"><span>BY — ใครติดตาม</span>
        <input type="text" id="${idPrefix}By"></label>
      <label class="fld fld-wide"><span>RESPONSE — ผลที่ได้</span>
        <textarea id="${idPrefix}Res" rows="2"></textarea></label>
      <label class="fld fld-wide"><span>NEXT DOING — ทำอะไรต่อ</span>
        <textarea id="${idPrefix}Next" rows="2"></textarea></label>
    </div>`;
}

/** อ่านค่าจากฟอร์มเพิ่มบันทึก — คืน null ถ้ายังไม่ได้พิมพ์อะไร */
export function readLogForm(root, idPrefix = 'lg') {
  const q = (s) => root.querySelector(s);
  const res  = q('#' + idPrefix + 'Res')?.value.trim()  || '';
  const next = q('#' + idPrefix + 'Next')?.value.trim() || '';
  if (!res && !next) return null;
  return {
    log_date:   q('#' + idPrefix + 'Date')?.value || undefined,
    by_name:    q('#' + idPrefix + 'By')?.value.trim() || undefined,
    response:   res  || undefined,
    next_doing: next || undefined,
  };
}

export function clearLogForm(root, idPrefix = 'lg') {
  ['Res', 'Next', 'By'].forEach(k => {
    const e = root.querySelector('#' + idPrefix + k);
    if (e) e.value = '';
  });
}
