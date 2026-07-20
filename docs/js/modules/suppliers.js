// F9 — แถบ Supplier (sourcing) · ใหม่ v2 (Phase 3.4)

export default {
  title: 'Supplier',
  subtitle: 'ผู้ขาย · ผู้รับเหมา · วัสดุก่อสร้าง · วัตถุดิบ · บริการ',

  async render(root) {
    root.innerHTML = `
      <div class="empty">
        <strong>Phase 3.4</strong>
        ตาราง suppliers · กลุ่มย่อยกรองได้ (เพิ่ม/แก้กลุ่มจากหน้าจอ) · ผูก supplier ↔ Pending Project
      </div>`;
  },
};
