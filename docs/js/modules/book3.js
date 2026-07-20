// F5 — Book 3 สี (Phase 2.2)

import { adapter } from '../data/adapter.js';

export default {
  title: 'Book 3 สี',
  subtitle: '🟢 ลูกค้าประจำ · 🟡 ลูกค้ามีโอกาส · 🔴 ลูกค้าเป้าหมายใหม่',

  async render(root) {
    const rows = await adapter.listCustomers();

    root.innerHTML = rows.length
      ? `<div class="card">พบลูกค้า ${rows.length} ราย (UI เต็มมาใน Phase 2.2)</div>`
      : `<div class="empty">
           <strong>ยังไม่มีข้อมูลลูกค้า</strong>
           Phase 2.2 จะทำหน้านี้ พร้อมปุ่มยกลูกค้าขึ้นเป็น Pending Project
         </div>`;
  },
};
