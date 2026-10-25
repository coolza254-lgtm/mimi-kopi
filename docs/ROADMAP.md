# Roadmap

อ้างอิงจาก `docs/PRODUCT_SPEC.md` §13 ทุกเฟสต้องมี working demo และเกณฑ์ผ่านก่อนไปเฟสถัดไป

| เฟส | เนื้อหา | ด่าน (gate) |
|---|---|---|
| 0 | โครงโปรเจกต์ เอกสาร design tokens test plan Git baseline | build และเปิดแอปเปล่าได้บน Windows 11 |
| 1 | MIDI + เสียง vertical slice (P0) | กดคีย์ Badger C-918 แล้วเห็น pitch ถูกต้องและได้ยินเสียง ถ้าไม่รองรับให้ใช้ simulator ได้ แต่ไม่ผ่านด่านฮาร์ดแวร์ |
| 2 | แบบฝึกพื้นฐาน + scoring ที่ตรวจได้ (P0/P1) | ฝึก 30 นาทีได้จริง บันทึกและดูย้อนหลังได้ unit test ครอบคลุมกรณีสำคัญ |
| 3 | Song Studio: นำเข้า MIDI ที่มีสิทธิ์ใช้ และวนท่อน (P1) | นำเข้า 4 ห้อง วนฝึก และบันทึก section accuracy ได้ถูกต้อง |
| 4 | Ear Copy workspace (P1) | นำเข้าเสียง วนช่วง บันทึก MIDI attempt โดยไม่รายงาน accuracy ปลอม |
| 5 | Adaptive coaching, MusicXML, analytics (P2) | แผนวันถัดไปเปลี่ยนได้อธิบายจาก weakness จริง |
| 6 | Arrangement Lab, ความเสถียร, installer และระบบอัปเดต (P2) | installer ผ่านการทดสอบ upgrade และไม่สูญเสียข้อมูลการฝึก |

## สถานะปัจจุบัน

- Phase 0: กำลังดำเนินการ
- Phase 1 และหลังจากนั้น: ยังไม่เริ่ม
