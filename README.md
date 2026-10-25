<p align="center"><img src="assets/brand/logo.png" alt="Mimi Kopi 耳コピー" width="280"></p>

# 耳コピー (Mimi Kopi)

แอปฝึกเปียโนบน Windows 11 ที่เชื่อมต่อกับเปียโนผ่าน MIDI ฝึกแบบวัดผลได้ และเรียนจากเพลงที่ชอบ ทำงานแบบออฟไลน์เป็นหลัก

สถานะ: **Phase 0 (กำลังตั้งโครงโปรเจกต์)** ยังไม่มีการทดสอบกับเปียโนจริง

## เอกสาร

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) สเปกผลิตภัณฑ์ฉบับเต็มและแหล่งอ้างอิงหลัก
- [`docs/ROADMAP.md`](docs/ROADMAP.md) เฟสและเกณฑ์ผ่านของแต่ละเฟส
- [`docs/decisions/`](docs/decisions/) บันทึกการตัดสินใจเชิงสถาปัตยกรรม (ADR)
- [`CHANGELOG.md`](CHANGELOG.md) บันทึกการเปลี่ยนแปลง

## ข้อจำกัดสำคัญ

- ความสามารถของ Badger C-918 (velocity, sustain CC64, ชื่อ MIDI device) **ยังไม่ได้ยืนยัน** จนกว่าจะทดสอบกับเครื่องจริง
- เพลงเป้าหมายไม่ได้รวมมาในแอป ผู้ใช้ต้องนำเข้าไฟล์ที่มีสิทธิ์ใช้เอง
- ไม่มีบัญชีผู้ใช้ ไม่มี telemetry และไม่มีการส่งข้อมูลการฝึกออกไปภายนอก

## การพัฒนา

ต้องมี Node.js 22, Rust (stable) และสำหรับ Windows ต้องมี Microsoft C++ Build Tools กับ WebView2 Runtime โครงสร้างโค้ดอธิบายไว้ใน [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

```sh
npm install
npm run tauri dev        # เปิดแอปแบบพัฒนา
npm run typecheck        # ตรวจ TypeScript
npm test                 # unit test ฝั่ง UI
cargo test -p mimi-core  # unit test ตรรกะ MIDI
npm run tauri build      # สร้างตัวติดตั้ง Windows (NSIS)
```

ไม่มีคอมก็ได้: ทุกครั้งที่ push ไปที่ GitHub, CI จะรันการตรวจทั้งหมดและสร้างตัวติดตั้ง Windows ให้ดาวน์โหลดจากหน้า Actions (artifact ชื่อ `mimi-kopi-windows-installer`)

## ลิขสิทธิ์

ยังไม่กำหนดใบอนุญาต โค้ดนี้เป็นของผู้พัฒนาและยังไม่อนุญาตให้นำไปใช้ซ้ำ
