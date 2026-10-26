<p align="center"><img src="assets/brand/logo.png" alt="Mimi Kopi 耳コピー" width="280"></p>

# 耳コピー (Mimi Kopi)

แอปฝึกเปียโนบน Windows 11 ที่เชื่อมต่อกับเปียโนผ่าน MIDI ฝึกแบบวัดผลได้ และเรียนจากเพลงที่ชอบ ทำงานแบบออฟไลน์เป็นหลัก

มีเมนูเรียนพื้นฐานแบบโต้ตอบ โปรแกรมฝึกหาโน้ต/อ่านบรรทัดโน้ต/คอร์ด ประวัติแยกจริงกับจำลอง เปียโนอิสระ และเครื่องมือแกะโน้ต รองรับไทย อังกฤษ ญี่ปุ่นแบบออฟไลน์ พร้อมอัปเดตผ่านในแอป

## เอกสาร

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) สเปกผลิตภัณฑ์ฉบับเต็มและแหล่งอ้างอิงหลัก
- [`docs/ROADMAP.md`](docs/ROADMAP.md) เฟสและเกณฑ์ผ่านของแต่ละเฟส
- [`docs/decisions/`](docs/decisions/) บันทึกการตัดสินใจเชิงสถาปัตยกรรม (ADR)
- [`CHANGELOG.md`](CHANGELOG.md) บันทึกการเปลี่ยนแปลง
- [`docs/LEARNING_TEST_PLAN.md`](docs/LEARNING_TEST_PLAN.md) บทเรียนและเกณฑ์จบบท
- [`docs/FREE_SONGS.md`](docs/FREE_SONGS.md) ที่มาทำนองสาธารณสมบัติในโหมดโน้ตตก
- [`AGENTS.md`](AGENTS.md) และ [`docs/HANDOFF.md`](docs/HANDOFF.md) กฎสำหรับ AI agent และสถานะงานล่าสุดที่ส่งต่อกัน

## ข้อจำกัดสำคัญ

- ความสามารถของ Badger C-918 (velocity, sustain CC64, ชื่อ MIDI device) **ยังไม่ได้ยืนยัน** จนกว่าจะทดสอบกับเครื่องจริง
- เพลงเป้าหมายของผู้ใช้ไม่ได้รวมมาในแอป ต้องเลือกไฟล์ที่มีสิทธิ์ใช้เอง มีทำนองสาธารณสมบัติฉบับฝึกง่าย 3 เพลงในโหมดโน้ตตก แยกซ้ายเขียว/ขวาน้ำเงินและเลือกทีละมือได้
- ไม่มีบัญชีผู้ใช้ ไม่มี telemetry และไม่มีการส่งข้อมูลการฝึกออกไปภายนอก

## เสียงเปียโน

แอปไม่แถมไฟล์เสียงเปียโน ถ้ายังไม่เลือกจะใช้เสียงพื้นฐานในตัว เปียโนฟรีที่แนะนำคือ
**Salamander Grand Piano V3** โดย Alexander Holm (ใบอนุญาต [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/))

1. ดาวน์โหลดจาก <https://github.com/sfzinstruments/SalamanderGrandPiano> (ปุ่ม Code → Download ZIP) แล้วแตกไฟล์
2. ในแอป ไปที่ **เสียงและ MIDI** → **เลือกเสียงเปียโน** แล้วเลือกไฟล์ `Salamander Grand Piano V3.sfz` (ต้องอยู่คู่กับโฟลเดอร์ `Samples` และ `Data`)
3. รอโหลดไม่กี่วินาที ใช้หน่วยความจำประมาณ 400–500 MB แอปจะจำไฟล์ไว้เปิดให้เองครั้งต่อไป

ใช้ไฟล์ SoundFont (.sf2) หรือ SFZ อื่นที่ใช้ sample แบบ FLAC/WAV ได้ด้วย

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
