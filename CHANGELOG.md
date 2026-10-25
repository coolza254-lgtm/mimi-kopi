# Changelog

## Unreleased

### Phase 1: MIDI และเสียง

- เชื่อมต่อ MIDI input ผ่าน midir: แสดงรายการ, เชื่อมต่อ, ตัดการเชื่อมต่อ และเชื่อมต่อใหม่อัตโนมัติเมื่อเสียบกลับ โดยปล่อยทุกคีย์ตอนหลุดเพื่อไม่ให้โน้ตค้าง
- ตรวจความสามารถของเปียโนจากสิ่งที่ส่งมาจริง (note on/off, velocity, sustain, polyphony) โดยไม่นับคีย์บอร์ดบนจอ
- เสียงผ่าน cpal: เลือกอุปกรณ์เสียงออก, เสียงพื้นฐานในตัว, โหลด SoundFont (.sf2) ที่ผู้ใช้เลือกเอง, ปรับระดับเสียงรวมและเปียโน, ปุ่มทดสอบเสียง
- หน้า "เสียงและ MIDI": คีย์บอร์ด 88 คีย์ที่กดเพื่อจำลองได้, ตัวตรวจสอบเหตุการณ์ MIDI พร้อมข้อมูลดิบ
- บันทึกการตัดสินใจ `docs/decisions/0002-audio-and-midi-threading.md`

### Phase 0

- เพิ่มสเปกผลิตภัณฑ์ `docs/PRODUCT_SPEC.md`
- เพิ่มโรดแมป `docs/ROADMAP.md`
- เพิ่มบันทึกการตัดสินใจ `docs/decisions/0001-in-app-updates.md`
- เพิ่ม README และ CHANGELOG
- ตั้งโครงโปรเจกต์ Tauri 2 + React + TypeScript + Vite พร้อมหน้าจอแรกที่สลับภาษา (ไทย/อังกฤษ/ญี่ปุ่น) และธีมได้
- เพิ่ม crate `mimi-core`: แปลงข้อความ MIDI, สถานะคีย์, ความสามารถของอุปกรณ์ (เริ่มเป็นยังไม่ทดสอบ) และ MIDI simulator พร้อม unit test
- เพิ่ม CI: ตรวจ frontend, Rust core และสร้างตัวติดตั้ง Windows
- เพิ่ม `docs/ARCHITECTURE.md` และ `docs/MIDI_AUDIO_TEST_PLAN.md`
- เพิ่มโลโก้จริงใน `assets/brand/logo.png` ทำไอคอนแอปจากสัญลักษณ์หูและคีย์เปียโน และใช้ในแถบด้านข้างของแอป
