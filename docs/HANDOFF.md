# Handoff

สมุดส่งต่องานระหว่าง agent ที่ทำงานในรีโปนี้ (เขียนทับส่วน "สถานะล่าสุด" ทุกครั้งที่จบรอบ) กฎทั่วไปดูที่ [`AGENTS.md`](../AGENTS.md)

## สถานะล่าสุด (2026-10-25)

- branch: `claude/new-session-1jl58s` ยังไม่ได้ merge เข้า `main`
- commit ล่าสุดที่ผ่าน CI ทั้ง 3 job (web, core, windows): `13504d4` "remember the chosen audio output and SoundFont"
- เจ้าของทดสอบบนเครื่องจริงแล้ว: Windows เห็นเปียโนชื่อ "Digital Piano", note on/off, velocity และ polyphony ใช้ได้ ยังไม่ได้ทดสอบ sustain pedal
  เสียงออกทางหูฟัง Bluetooth (latency สูง แนะนำให้ใช้แบบมีสาย)
- **ปัญหาที่เจ้าของแจ้ง:** ไม่ชอบเสียงเปียโนพื้นฐานในตัว (`BasicPiano`) อยากได้เสียงเปียโนจริงที่ฟรี
- **เจ้าของเลือกแล้ว:** ใช้ Salamander Grand Piano V3 ฉบับ SFZ ต้นฉบับ ให้แอปเปิดไฟล์ `.sfz` ได้โดยตรง ← **งานที่ต้องทำต่อ** (ดูหัวข้อถัดไป)

## งานต่อไป: เปิดเปียโน SFZ (Salamander Grand Piano V3)

ยังไม่ได้เขียนโค้ดส่วนนี้เลย มีแค่ผลสำรวจไฟล์ด้านล่าง

### ข้อมูลของ Salamander ที่ตรวจแล้ว

- ที่มา: <https://github.com/sfzinstruments/SalamanderGrandPiano> (Alexander Holm, license **CC BY 3.0**) ต้องใส่เครดิตในแอปและเอกสาร
  **ห้าม commit sample ลงรีโป** ให้ผู้ใช้ดาวน์โหลดเองแล้วเลือกไฟล์ `Salamander Grand Piano V3.sfz`
- sample เป็น FLAC 24-bit stereo 48 kHz อยู่ในโฟลเดอร์ `Samples/` (`default_path=Samples/`)
  ตัวอย่างขนาด: `A0v16.flac` ยาว 1,241,406 frame (~26 วินาที), `C4v8.flac` 776,976 frame, `C8v1.flac` 148,834 frame, `rel40.flac` 21,900 frame
- ชื่อไฟล์: `{A0,C1,D#1,F#1,A1,…,C8}v{1..16}.flac` (30 โน้ต × 16 ระดับ velocity), `rel{1..88}.flac` (เสียงค้อนตอนปล่อย), `harm{L,S,V3}{note}.flac` (เสียงสายก้อง), `pedal{D,U}{1,2}.flac`
- โครงไฟล์ SFZ (v2 + ARIA extensions):
  - ไฟล์หลักใช้ `#define $NAME value` แล้วแทนค่า `$NAME` ในบรรทัดอื่น และใช้ `#include "Data/xxx.txt"` (path อิงจากโฟลเดอร์ของไฟล์ .sfz)
  - `#include` อาจอยู่กลางบรรทัด เช่น `<group> #include "Data/vel_01.txt" lovel=1 hivel=26 #include "Data/region.txt"`
  - header ที่ใช้: `<control>`, `<global>`, `<master>`, `<group>`, `<region>` ค่าที่ตั้งในระดับบนสืบทอดลงไปถึง region
  - มี `<master>` 2 ชุด แยกด้วย keyswitch (`sw_last=C0` = Natural, `sw_last=C#0` = Retuned) และ `sw_default=C0` **ให้ใช้เฉพาะชุด Natural** (`sw_last` ตรงกับ `sw_default`)
  - region ของโน้ต: `lokey/hikey/pitch_keycenter`, `tune=` (cent), `lovel/hivel` จาก group, `ampeg_release=` (บางโน้ต), `offset_oncc98=` (ข้ามได้)
  - `hammer.txt`, `str_res.txt` ใช้ `trigger=release` และ `rt_decay=` (dB ต่อวินาทีที่กดค้างไว้), `volume=` (dB), `amp_veltrack=`
  - `pedal.txt` ใช้ `lokey=-1` และเงื่อนไข CC (`on_locc64` ฯลฯ) ข้ามได้ในรุ่นแรก
  - region ที่มีเงื่อนไข `locc/hicc` ที่ไม่ตรงกับค่าเริ่มต้น หรือมี `lorand/hirand` ให้ข้ามหรือเลือกตัวแรกไปก่อน
  - ค่าใน `<global>`: `amp_veltrack_oncc99=-100`, `set_hdcc99=0.73` (คือ veltrack ประมาณ 27%), `ampeg_release_oncc72=2` กับ `set_hdcc72=0.5` (release ประมาณ 1 วินาที), `note_polyphony=1`
    ไม่ต้องรองรับ CC ทั้งหมด ใช้ค่าเริ่มต้นที่คำนวณไว้ก็พอ

### ปัญหาหน่วยความจำ (ต้องตัดสินใจในโค้ด)

ถ้าถอด sample ทั้งหมดเป็น f32 stereo จะใช้หลาย GB ข้อเสนอ:

- เก็บเป็น `i16` interleaved stereo (ลดจาก 24 bit ได้ ฟังไม่ต่าง)
- ตัดความยาวแต่ละ sample ไม่เกินประมาณ 10–12 วินาที แล้ว fade out ช่วงท้าย
- เลือกใช้ velocity layer บางส่วน (เช่น 8 จาก 16) แล้วขยายช่วง `lovel/hivel` ของ layer ที่เก็บไว้ให้ครอบช่วงที่ตัดทิ้ง
- ถอดไฟล์ FLAC ซ้ำกันแค่ครั้งเดียว (cache ตาม path) ทำในเธรดโหลด ไม่ใช่ใน audio callback
- แสดงความคืบหน้าหรือสถานะ "กำลังโหลด" ใน UI เพราะอาจใช้เวลาหลายวินาที

### แผนการเขียนโค้ด

1. `crates/mimi-core/src/sfz.rs`: parser ที่รับข้อความและฟังก์ชันอ่านไฟล์ include (ส่งเป็น closure เพื่อให้เทสต์ได้โดยไม่ต้องมีไฟล์จริง)
   คืนค่าเป็นรายการ region ที่รวมค่าที่สืบทอดมาแล้ว (sample path, key range, keycenter, vel range, tune, volume, amp_veltrack, trigger, rt_decay, ampeg_release)
   เขียนเทสต์ด้วยข้อความ SFZ สังเคราะห์: define, include กลางบรรทัด, การสืบทอด, keyswitch, ชื่อโน้ตแบบ `C#0` และตัวเลข
2. `crates/mimi-core/src/sampler.rs`: `SamplerPiano` ที่ implement trait `Instrument` ใน `synth.rs`
   voice เล่น sample แบบเลื่อน pitch (linear interpolation, อัตรา `2^((key-keycenter)*100+tune)/1200 * sample_rate/output_rate`), velocity curve, release envelope, sustain (CC64),
   region `trigger=release` เล่นตอนปล่อยคีย์ (ความดังลดตาม `rt_decay` × เวลาที่กดค้าง), จำกัดจำนวน voice และ steal ตัวที่เบาที่สุด
   ห้าม allocate ใน `render` (จองบัฟเฟอร์ voice ไว้ล่วงหน้า, sample เก็บใน `Arc`)
3. ถอด FLAC: แนะนำ crate `claxon` (pure Rust) ใส่ไว้ใน `mimi-core` หรือ `src-tauri` ตามความเหมาะสม
4. `src-tauri/src/audio.rs` + `lib.rs`: คำสั่งใหม่ `audio_load_sfz(path)` (async) ที่โหลดในเธรดแยกแล้วส่ง instrument ไปที่เธรด `audio-control` แบบเดียวกับ `set_sound_font`
   เพิ่ม `instrument: "sfz"` ใน `AudioStatus` และ filter `.sfz` ใน dialog ของหน้า **เสียงและ MIDI** (`src/pages/SoundMidi.tsx`)
5. `src/lib/audioPrefs.ts`: จำ path ของ `.sfz` และโหลดคืนตอนเปิดแอปใน `restoreAudio()` (`src/App.tsx`) เหมือน SoundFont
6. ข้อความ UI 3 ภาษา, เครดิต "Salamander Grand Piano V3 โดย Alexander Holm (CC BY 3.0)" และวิธีดาวน์โหลดใน README
7. อัปเดต CHANGELOG, test plan (เพิ่มข้อทดสอบมือ: โหลด Salamander แล้วเสียงไม่แตก, ใช้ RAM เท่าไร) แล้ว push และดู CI ให้เขียวทั้ง 3 job

## ลำดับความสำคัญจากเจ้าของ

เจ้าของพอใจกับแอปตอนนี้แล้ว ขอให้**ทำให้ใช้ฝึกช่วงแรกได้ดีจริงก่อน** แล้วค่อยอัปเดตเพิ่มทีละน้อย
งานที่ทำให้การฝึกพื้นฐานดีขึ้น (เสียงเปียโน, บทเรียน, บันทึกผล) จึงมาก่อนฟีเจอร์ใหญ่อย่าง Song Studio หรือ Ear Copy

## งานที่ยังไม่เริ่ม (เรียงตามสเปก)

- เก็บผลการฝึกใน SQLite (spec §9.1) ตอนนี้การตั้งค่าอยู่ใน localStorage
- โหมดต่อเนื่องพร้อมคะแนนจังหวะ, metronome, หน้า "วันนี้" แบบภารกิจ 30 นาที (Phase 2)
- วัด latency จริง
- สร้าง signing key ของระบบอัปเดตก่อนปล่อยเวอร์ชันสาธารณะแรก (`docs/decisions/0001-in-app-updates.md`) และตัดสินใจเรื่อง code signing
