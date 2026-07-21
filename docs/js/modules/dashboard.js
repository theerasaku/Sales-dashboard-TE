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
    // ตัวเลขที่ยังไม่มีตารางรองรับจะเป็น null → แสดง "—" ไม่ใช่ 0
    // (0 แปลว่า "นับแล้วไม่มี" ซึ่งคนละความหมายกับ "ยังนับไม่ได้")
    const n = (v) => (v === null || v === undefined ? '—' : v);

    let s = { pendingCount: null, customerCount: null, activityCount: null };
    let warn = '';
    try {
      s = await adapter.getDashboardStats();
    } catch (e) {
      // ต่อฐานข้อมูลไม่ได้ก็ยังต้องเห็นหน้าจอ ไม่ใช่จอว่างเปล่า
      warn = `<div class="empty" style="margin-bottom:16px">โหลดตัวเลขไม่สำเร็จ — ${e.message}</div>`;
    }

    root.innerHTML = `
      ${warn}
      <div class="grid cols-4">
        ${card('เป้ายอดขาย', `${CONFIG.TARGET_MB} ล้านบาท`, CONFIG.TARGET_PERIOD)}
        ${card('Pending Project', n(s.pendingCount), 'โครงการที่ยังเดินอยู่')}
        ${card('ลูกค้า Book 3 สี', n(s.customerCount), 'ยังไม่มีตาราง — Phase 2.1')}
        ${card('กิจกรรมค้าง', n(s.activityCount), 'ยังไม่มีตาราง — Phase 2.1')}
      </div>

      <div class="empty" style="margin-top:20px">
        <strong>Phase 1.5 จะมาเติมตรงนี้</strong>
        กราฟเทียบเป้า · pipeline coverage · funnel · top 3 · งานเลยกำหนด
      </div>`;
  },
};
