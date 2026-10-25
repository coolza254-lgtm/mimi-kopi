# Architecture

ภาพรวมจาก `docs/PRODUCT_SPEC.md` §8 สำหรับสิ่งที่มีอยู่ในรีโปตอนนี้ (Phase 0)

## โครงสร้าง

```text
mimi-kopi/
├─ Cargo.toml                 # Rust workspace
├─ crates/mimi-core/          # ตรรกะที่ไม่ขึ้นกับ OS: MIDI, ตรวจความสามารถ, เสียงสังเคราะห์, renderer
├─ src-tauri/                 # เปลือกแอป Tauri 2: IPC, MIDI จริง (midir), เสียง (cpal), ตัวติดตั้ง
├─ src/                       # UI: React + TypeScript + Vite
│  ├─ i18n/                   # ข้อความไทย (ต้นฉบับ) อังกฤษ ญี่ปุ่น
│  ├─ lib/                    # IPC wrapper, การตั้งค่า
│  └─ styles/                 # design tokens (spec §12.2) และ CSS ของแอป
├─ assets/brand/              # โลโก้จริง (logo.png) และไอคอนแอปที่ตัดจากโลโก้ (app-icon.png)
├─ docs/                      # spec, roadmap, ADR, test plan
└─ .github/workflows/ci.yml   # CI: frontend, Rust core, Windows build
```

## หลักการแบ่งส่วน

- **`mimi-core` ไม่พึ่ง Tauri, OS MIDI API หรืออุปกรณ์เสียง** จึงทดสอบได้บนทุกแพลตฟอร์มและใน CI ที่ไม่มีเปียโน
- **`MidiInputAdapter`** เป็นอินเทอร์เฟซเดียวที่ทั้ง backend จริง (midir, Phase 1) และ `SimulatedInput` ต้อง implement ทำให้ practice engine ไม่ต้องรู้ว่ากำลังใช้ตัวไหน
- **ความสามารถของอุปกรณ์เริ่มเป็น `NotYetTested` เสมอ** และเปลี่ยนได้จากการทดสอบกับเครื่องจริงเท่านั้น (spec §2.2)
- **เวลาของเหตุการณ์ใช้นาฬิกา monotonic เป็นไมโครวินาที** ไม่ใช่เวลาที่ UI render (spec §7.3)
- **IPC** ใช้คำสั่ง Tauri ที่มี type ชัดเจน ฝั่ง TypeScript สะท้อน struct ของ Rust (`src/lib/appInfo.ts` ↔ `src-tauri/src/lib.rs`)

## เสียงและ MIDI

ดูรายละเอียดเธรดและเหตุผลใน [`decisions/0002-audio-and-midi-threading.md`](decisions/0002-audio-and-midi-threading.md)

## กฎสำหรับ Phase ถัดไป

- audio callback ห้ามทำ file I/O, query ฐานข้อมูล หรือ lock ที่ใช้เวลานาน สื่อสารผ่าน ring buffer เท่านั้น
- ที่เก็บข้อมูลคือ SQLite ตาม spec §9.1 การตั้งค่า UI ตอนนี้อยู่ใน localStorage ชั่วคราว
- ห้าม commit ไฟล์เพลง, SoundFont หรือฟอนต์ที่ license ไม่อนุญาต

## การตัดสินใจที่ยังเปิดอยู่

- **App identifier** ตอนนี้ใช้ `io.github.coolza254.mimikopi` ชั่วคราว (spec §19.2 ข้อ 8) ถ้าเปลี่ยนหลังปล่อยเวอร์ชันแรก ข้อมูลของผู้ใช้จะอยู่คนละโฟลเดอร์
- **ชื่อไฟล์ตัวติดตั้งใช้ "Mimi Kopi"** ส่วนชื่อ 耳コピー อยู่ในหัวหน้าต่างและ UI เพื่อเลี่ยงปัญหาอักษรนอก ASCII ในชื่อไฟล์ของ Windows installer
- **ไอคอน** ตัดส่วนหูและคีย์เปียโนจากโลโก้จริงวางบนพื้นชมพูอ่อน (spec §12.1) ไม่มีตัวอักษรเพราะอ่านไม่ออกที่ขนาด 32px ถ้าต้องการไอคอนที่คมกว่านี้ควรมีไฟล์โลโก้แยกเฉพาะสัญลักษณ์ (ไม่มีชื่อ)
