// F4 — Pending Project UI (ยกจาก prototype v3 ใน Phase 1.4)

import { adapter } from '../data/adapter.js';

export default {
  title: 'Pending Project',
  subtitle: 'โครงการที่กำลังติดตาม · ตาราง sort/ซ่อนคอลัมน์ + CSV',

  async render(root) {
    const rows = await adapter.listPending();

    root.innerHTML = rows.length
      ? `<div class="card">พบ ${rows.length} โครงการ (ตารางเต็มมาใน Phase 1.4)</div>`
      : `<div class="empty">
           <strong>ยังไม่มีข้อมูล Pending Project</strong>
           Phase 1.4 จะยกตารางเต็มจาก prototype v3 มา · Phase 1.6 จะมี tool นำเข้า JSON เดิม
         </div>`;
  },
};
