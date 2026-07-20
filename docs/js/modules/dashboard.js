// F3 — Dashboard ภาพรวม (เติมของจริงใน Phase 1.5)

import { adapter } from '../data/adapter.js';
import { CONFIG } from '../config.js';

const card = (label, value, note) => `
  <div class="card">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-note">${note}</div>
  </div>`;

export default {
  title: 'ภาพรวม',
  subtitle: 'สรุปสถานะงานขายทั้งหมด',

  async render(root) {
    const s = await adapter.getDashboardStats();

    root.innerHTML = `
      <div class="grid cols-4">
        ${card('เป้ายอดขาย', `${CONFIG.TARGET_MB} MB`, 'เป้ารวมทั้งปี')}
        ${card('Pending Project', s.pendingCount, 'โครงการที่ติดตามอยู่')}
        ${card('ลูกค้า Book 3 สี', s.customerCount, 'ทั้งเขียว/เหลือง/แดง')}
        ${card('กิจกรรมค้าง', s.activityCount, 'รอดำเนินการ')}
      </div>

      <div class="empty" style="margin-top:20px">
        <strong>Phase 1.5 จะมาเติมตรงนี้</strong>
        กราฟเทียบเป้า · pipeline coverage · funnel · top 3 · งานเลยกำหนด
      </div>`;
  },
};
