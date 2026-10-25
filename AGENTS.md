# AGENTS.md

คำแนะนำสำหรับ AI coding agent (Codex, Claude Code หรือตัวอื่น) ที่ทำงานในรีโปนี้ อ่านไฟล์นี้ก่อนเริ่มทุกครั้ง
แล้วอ่าน [`docs/HANDOFF.md`](docs/HANDOFF.md) เพื่อดูว่างานล่าสุดค้างอยู่ตรงไหน

## โปรเจกต์

耳コピー (Mimi Kopi) คือแอปฝึกเปียโนแบบ offline-first บน Windows 11 ใช้กับคีย์บอร์ด MIDI Badger C-918
สเปกฉบับเต็มอยู่ที่ [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) ถ้าสเปกกับโค้ดขัดกัน ให้ยึดสเปก แล้วแจ้งเจ้าของ

- เจ้าของสื่อสารเป็น**ภาษาไทย** ตอบเป็นภาษาไทย เอกสารใน `docs/` และ CHANGELOG ก็เขียนเป็นภาษาไทย
- ข้อความ commit, ชื่อตัวแปร และคอมเมนต์ในโค้ดเขียนเป็นภาษาอังกฤษ
- เจ้าของไม่สะดวกใช้คอมพิวเตอร์ตอนพัฒนา ทุกอย่างต้องตรวจผ่าน CI ได้ แล้วดาวน์โหลดตัวติดตั้งจาก artifact ของ CI ไปทดสอบเอง

## เทคโนโลยี

- Tauri 2 (Rust) + React 19 + TypeScript + Vite, ทดสอบด้วย Vitest
- Rust workspace มี 2 ส่วน
  - `crates/mimi-core`: ตรรกะล้วนที่ไม่พึ่ง OS (MIDI, ตรวจความสามารถ, synth, renderer) ทดสอบบน Linux ได้
  - `src-tauri`: แอปจริง มี midir (MIDI), cpal (เสียง), rtrb (ring buffer), tauri-plugin-dialog
- UI อยู่ใน `src/` ข้อความทุกภาษาอยู่ใน `src/i18n/messages.ts` (th, en, ja) ต้องเพิ่มครบทั้ง 3 ภาษา ไม่งั้น typecheck ไม่ผ่าน

## คำสั่งที่ต้องผ่านก่อน push

```bash
npm ci
npm run typecheck
npm test
npm run build
cargo fmt --all -- --check
cargo clippy -p mimi-core --all-targets -- -D warnings
cargo test -p mimi-core
```

`src-tauri` build บน Linux ไม่ได้ถ้าไม่มี webkit/alsa (CI build บน Windows ให้)
ถ้าแก้ `src-tauri` ให้ตรวจโค้ดอย่างระวังแล้วดูผล job `windows` ใน CI (`.github/workflows/ci.yml`)
ตัวติดตั้งอยู่ใน artifact ชื่อ `mimi-kopi-windows-installer` ของ CI run นั้น

## กฎที่ห้ามละเมิด

1. **ห้ามใส่เนื้อหาที่มีลิขสิทธิ์** ลงในรีโป ไม่ว่าจะเป็นเพลง, โน้ต, SoundFont, sample เสียง หรือฟอนต์ที่ license ไม่อนุญาต และห้ามลอก UI ของแอปอื่น
   ผู้ใช้ต้องเลือกไฟล์เสียงหรือเพลงจากเครื่องตัวเอง
2. **ห้ามแสดงตัวเลขปลอม** (spec §2.2) ห้ามบอกว่าฮาร์ดแวร์รองรับความสามารถใดถ้ายังไม่ได้ทดสอบกับเครื่องจริง ผลที่มาจากคีย์บอร์ดบนจอต้องติดป้ายว่า "จำลอง"
3. **โหมดรอ (wait mode) ไม่ให้คะแนนจังหวะ**
4. **ใน audio callback ห้ามจองหน่วยความจำ ห้าม lock ห้ามทำ file I/O** ส่งคำสั่งผ่าน ring buffer `rtrb` เท่านั้น ส่วนงานหนัก เช่น โหลดไฟล์ ให้ทำในเธรดอื่น (ดู `docs/decisions/0002-audio-and-midi-threading.md`)
5. ห้ามใส่ชื่อหรือรหัสรุ่นของโมเดล AI ใน commit, คอมเมนต์ หรือเอกสาร
6. ห้ามสร้าง pull request หรือ merge เข้า `main` ถ้าเจ้าของไม่ได้สั่ง
7. ถ้า CI ล้ม ต้องหาสาเหตุแล้วแก้ ห้ามปิด ข้าม หรือลบเทสต์เพื่อให้ผ่าน

## วิธีทำงาน

- branch ที่ใช้พัฒนาตอนนี้คือ `claude/new-session-1jl58s` ทำต่อบน branch นี้ เว้นแต่เจ้าของจะสั่งให้ใช้ branch อื่น
- ทำงานเป็นชิ้นเล็กที่จบในตัว เขียน unit test ใน `mimi-core` หรือ Vitest ให้กับตรรกะใหม่ทุกครั้ง
- เขียนโค้ดให้เหมือนโค้ดรอบข้าง ทั้งการตั้งชื่อ ความถี่ของคอมเมนต์ และสำนวน
- อัปเดต `CHANGELOG.md` (หัวข้อ Unreleased), `docs/ROADMAP.md` และ `docs/MIDI_AUDIO_TEST_PLAN.md` เมื่อสิ่งที่ทำมีผลต่อเอกสารเหล่านั้น
- **ก่อนหมดรอบการทำงานทุกครั้ง ให้อัปเดต `docs/HANDOFF.md`** ว่าทำอะไรไปแล้ว อะไรค้าง และขั้นต่อไปคืออะไร เพื่อให้ agent ตัวถัดไปทำต่อได้
