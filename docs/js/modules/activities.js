// F6 — แผนติดต่อลูกค้า / กิจกรรมรายสัปดาห์ (Phase 2.3)

import { adapter } from '../data/adapter.js';

export default {
  title: 'แผนติดต่อลูกค้า',
  subtitle: 'กิจกรรมรายสัปดาห์ · แจ้งเตือนงานเลยกำหนด',

  async render(root) {
    const rows = await adapter.listActivities();

    root.innerHTML = rows.length
      ? `<div class="card">พบ ${rows.length} กิจกรรม (UI เต็มมาใน Phase 2.3)</div>`
      : `<div class="empty">
           <strong>ยังไม่มีกิจกรรม</strong>
           Phase 2.3 จะทำปฏิทินติดตาม + แจ้งเตือนงานเลยกำหนด
         </div>`;
  },
};
