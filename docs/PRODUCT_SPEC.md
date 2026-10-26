# 耳コピー — Mimi Kopi
## Product Requirements Document (PRD), Technical Architecture, Learning Curriculum & AI Development Plan

> **เอกสารฉบับตั้งต้นสำหรับส่งให้ Codex หรือ Claude Code**  
> เวอร์ชัน: **1.1 — 25 ตุลาคม 2026**  
> สถานะ: **Product specification / ยังไม่ใช่โปรแกรมที่พัฒนาเสร็จ**  
> แพลตฟอร์ม: **Windows 11 desktop application**  
> ชื่อที่แสดงในแอป: **耳コピー**  
> ชื่อภาษาอังกฤษสำหรับโฟลเดอร์/เอกสาร: **Mimi Kopi**

**การส่งต่องาน:** เอกสาร Markdown นี้เป็นแหล่งอ้างอิงหลักเพียงไฟล์เดียว (self-contained) สำหรับการออกแบบด้วย **Claude Design** แล้วจึงนำผลลัพธ์ไปพัฒนาด้วย **Claude Code**

- **ขั้นออกแบบ:** ส่งไฟล์นี้ให้ Claude Design พร้อมโลโก้ที่เลือกไว้ (หากต้องการให้คงรูปลักษณ์ตรงต้นฉบับ) และให้จัดทำ UI system, wireframes, component specifications และ interaction flows
- **ขั้นพัฒนา:** ส่งไฟล์นี้พร้อมผลงานจาก Claude Design ให้ Claude Code และให้ลงมือทำทีละ Phase ตาม acceptance criteria
- **ข้อสำคัญ:** ภาพหน้าจอ, โลโก้ หรือคะแนนสมมติไม่ถือเป็น implementation; ห้ามถือว่าอุปกรณ์ Badger C-918 ส่ง MIDI events ใดบ้างจนกว่าจะทดสอบจริง

---

## สารบัญ

1. [Executive Summary](#1-executive-summary)
2. [ข้อมูลที่ยืนยันแล้ว / สมมติฐาน / เรื่องที่ต้องตรวจสอบ](#2-ข้อมูลที่ยืนยันแล้ว--สมมติฐาน--เรื่องที่ต้องตรวจสอบ)
3. [Product Vision และหลักการออกแบบ](#3-product-vision-และหลักการออกแบบ)
4. [เป้าหมายการเรียนและเพลงเป้าหมาย](#4-เป้าหมายการเรียนและเพลงเป้าหมาย)
5. [Persona / User Journey](#5-persona--user-journey)
6. [Feature Specification](#6-feature-specification)
7. [Hardware, MIDI, Audio](#7-hardware-midi-audio)
8. [Technical Architecture](#8-technical-architecture)
9. [Data Model และ Local Storage](#9-data-model-และ-local-storage)
10. [Progress Scoring, Calibration และ Analytics](#10-progress-scoring-calibration-และ-analytics)
11. [หลักสูตรและแผนการฝึกเปียโน](#11-หลักสูตรและแผนการฝึกเปียโน)
12. [UX/UI, Branding, Localization](#12-uxui-branding-localization)
13. [Roadmap และ Milestones](#13-roadmap-และ-milestones)
14. [Acceptance Criteria / Test Plan](#14-acceptance-criteria--test-plan)
15. [Risks / Trade-offs / Out of Scope](#15-risks--trade-offs--out-of-scope)
16. [AI-assisted Development Workflow](#16-ai-assisted-development-workflow)
17. [Master Prompt สำหรับ Codex / Claude Code](#17-master-prompt-สำหรับ-codex--claude-code)
18. [Phase Prompts](#18-phase-prompts)
19. [Decision Log และคำถามที่ยังไม่บล็อกการพัฒนา](#19-decision-log-และคำถามที่ยังไม่บล็อกการพัฒนา)

---

# 1. Executive Summary

**耳コピー (Mimi Kopi)** เป็นโปรแกรมฝึกเปียโนบน Windows 11 ที่เชื่อมต่อกับเปียโนจริงผ่าน MIDI และสร้างเสียงผ่านลำโพงหรือหูฟังคอมพิวเตอร์ เป้าหมายคือช่วยให้ผู้เริ่มต้นฝึกวันละประมาณ **30 นาที** โดยเห็นความก้าวหน้าที่วัดได้ และค่อย ๆ เล่นเพลงที่ชอบ โดยเฉพาะเพลงจาก **Morning Musume / Hello! Project / AKB48**

ผลิตภัณฑ์ผสาน 4 บทบาท:

- **Personal Piano Coach:** แนะนำแบบฝึกตามทักษะที่ยังอ่อนและเป้าหมายเพลง
- **Practice Studio:** โน้ต, Piano Roll, Metronome, วนท่อน, แยกมือ, ฝึกจังหวะ
- **Ear Copy Workspace:** ฟังท่อนสั้นซ้ำ ทดลองเล่นตามด้วยหู และเฉลยแบบค่อยเป็นค่อยไป
- **Progress Tracker:** เก็บผลการฝึกจาก MIDI, วิเคราะห์รายท่อน, เปรียบเทียบแบบฝึกเดียวกันอย่างยุติธรรม

**North-star outcome:** ผู้ใช้ตอบได้ว่า “วันนี้เล่นอะไรได้ดีขึ้นจากเมื่อวาน” และรู้ว่า “ต้องฝึกอะไรต่อเพื่อเข้าใกล้เพลงที่ชอบ”

**เป้าหมายระยะ 6–12 เดือน:** เล่นเพลงเป้าหมายฉบับเปียโนที่เหมาะกับระดับของตนเองได้อย่างน้อยหนึ่งเพลงเต็ม โดยไม่รับประกันกรอบเวลาแน่นอน เพราะขึ้นกับความยากของการเรียบเรียงและความต่อเนื่องในการฝึก

**เป้าหมายระยะยาว:** ฟังแล้วจับทำนองและคอร์ดได้ดีขึ้น เล่นเพลงได้หลายเพลง และปรับรูปแบบ accompaniment/arrangement เพื่อเปลี่ยนสไตล์ได้ด้วยตัวเอง

---

# 2. ข้อมูลที่ยืนยันแล้ว / สมมติฐาน / เรื่องที่ต้องตรวจสอบ

## 2.1 ข้อมูลที่ผู้ใช้ยืนยันแล้ว

| หัวข้อ | รายละเอียด |
|---|---|
| ชื่อผลิตภัณฑ์ | **耳コピー** (Mimi Kopi) |
| OS | Windows 11 |
| รูปแบบผลิตภัณฑ์ | Desktop app, offline-first |
| เปียโน | Badger C-918 |
| สายเชื่อมต่อ | **USB-C ด้านเปียโน → USB-A ด้านคอมพิวเตอร์** |
| เสียงขณะเล่น | ฟังจากลำโพงหรือหูฟัง **คอมพิวเตอร์** |
| อุปกรณ์ฟังเสียงรุ่นจริง | ยังไม่ระบุ |
| เสียงที่ต้องการ | เปียโนในแอป + Metronome + WAV/MP3 + วนท่อนเพลง |
| ระดับปัจจุบัน | รู้ชื่อคีย์ อ่านโน้ตต้น ๆ ได้ไม่แม่น เล่นคอร์ดง่าย ๆ ได้แต่เปลี่ยนไม่คล่อง |
| จุดฝึกสำคัญ | อ่านโน้ต, จังหวะ, สองมือ, คอร์ด |
| เวลาฝึก | ประมาณ 30 นาทีต่อวัน |
| แนวทางเรียน | ชอบเริ่มจากเพลงจริง แต่ยอมฝึกพื้นฐานที่จำเป็น |
| อารมณ์การฝึก | จริงจังพอดี ไม่กดดัน |
| UI | เรียบง่าย เข้ากับโลโก้พาสเทล น่ารักแต่เป็นเครื่องมือจริงจัง |
| ธีม | Light + Dark ปรับได้ |
| ภาษา | ไทย + อังกฤษ + ญี่ปุ่น |
| กลุ่มผู้ใช้แรก | ใช้งานส่วนตัวก่อน |
| ความสามารถในอนาคต | Ear Copy และปรับ arrangement/แนวเพลงอย่างอิสระ |
| AI development | ใช้ Codex และ/หรือ Claude Code พัฒนาทีละระยะจนเป็นแอปใช้งานได้ |

## 2.2 เรื่องที่ **ห้าม AI เดาหรือ hardcode**

1. USB-C → USB-A เป็น **รูปแบบสาย/ขั้วต่อ**; ยังไม่ถือเป็นหลักฐานยืนยันว่า Windows มองเห็น Badger C-918 เป็น USB MIDI endpoint จนกว่าจะตรวจจริง
2. ยังไม่ยืนยันว่า MIDI จาก Badger C-918 ส่งค่า **velocity**, **sustain (CC64)** หรือข้อมูล channel ทุกแบบได้
3. ยังไม่ทราบว่าใช้หูฟังมีสาย / USB / Bluetooth / ลำโพง และ latency จริงเท่าไร
4. ยังไม่มีไฟล์ MIDI, MusicXML หรือไฟล์เสียงของเพลงเป้าหมายที่ยืนยันสิทธิ์ใช้งานและความถูกต้อง
5. ยังไม่ทราบว่าจะใช้ SoundFont ใดเป็นค่าเริ่มต้น และต้องตรวจสอบ license ก่อน bundle
6. สาย MIDI และ USB บางแบบอาจส่งข้อมูลต่างกัน: ให้ระบบ **ตรวจสอบอุปกรณ์จริง** ก่อนสรุปความสามารถ

## 2.3 วิธีแก้ความไม่แน่นอน

- ทำ **Device Setup Wizard** และ **MIDI Diagnostics** ก่อนระบบบทเรียนขั้นสูง
- ทำ **Demo/Simulation MIDI Input** เพื่อพัฒนาต่อได้แม้ไม่ได้เสียบเปียโน
- ออกแบบ `MidiInputAdapter` เพื่อเปลี่ยน backend ได้โดยไม่กระทบ Practice Engine
- ออกแบบ `AudioOutputAdapter` เพื่อเปลี่ยนอุปกรณ์เสียงและรองรับ fallback
- เพิ่มสถานะ `supported / not supported / not yet tested` ตามความสามารถของฮาร์ดแวร์

---

# 3. Product Vision และหลักการออกแบบ

## 3.1 วิสัยทัศน์

**“จากเล่นเพลงที่ชอบตามโน้ต สู่การฟัง แกะ เล่น และเรียบเรียงเองได้”**

## 3.2 Product Principles

1. **Music-first, fundamentals-supported:** เรียนจากเพลงโปรด แต่สอนพื้นฐานเมื่อจำเป็น
2. **Deliberate practice:** ฝึกช่วงสั้น วัดจุดอ่อน แล้วฝึกซ้ำอย่างมีเป้าหมาย
3. **Honest metrics:** ไม่ใช้เวลาฝึกหรือ streak เป็นตัวแทนความเก่งโดยตรง
4. **Active ear training:** เครื่องมือฟังซ้ำและ hint ต้องไม่กลายเป็น auto-answer
5. **Fast to practice:** เปิดแอป → เชื่อมเปียโน → เริ่มฝึกภายในไม่กี่คลิก
6. **Accessible feedback:** ไม่ใช้แค่สีบอกโน้ตถูก/ผิด และมีคำอธิบายภาษาที่อ่านง่าย
7. **Local-first:** ฝึกและดูผลย้อนหลังได้โดยไม่ต้องมีอินเทอร์เน็ต
8. **Extensible codebase:** โมดูล MIDI / Audio / Scoring / Music Content / UI แยกกันชัดเจน
9. **No fabricated ability:** ความสามารถที่ยังไม่ทดสอบต้องติดป้ายชัดเจน

## 3.3 สิ่งที่ไม่ใช่เป้าหมายระยะต้น

- เกมคะแนนอย่างเดียวที่ทำให้กดตามภาพได้แต่ไม่เข้าใจดนตรี
- AI ตัดสิน timing จากเสียงไมโครโฟนแทน MIDI โดยไม่มีเหตุจำเป็น
- auto transcription ที่ให้เฉลยทุกโน้ตทันที
- social network, leaderboard, login/cloud account ใน MVP
- การจัดส่งเพลง/ไฟล์โน้ตที่มีลิขสิทธิ์โดยไม่ได้รับอนุญาต

---

# 4. เป้าหมายการเรียนและเพลงเป้าหมาย

## การใช้งานที่เจ้าของยืนยันเพิ่มเติม (2026-10-27)

- แยก **เรียน** (อธิบายง่าย ภาพโต้ตอบ กดลองทีละขั้น และแบบฝึกท้ายบทก่อนบันทึกจบ), **ฝึก** (ซ้อมซ้ำ/ทดสอบอ้างอิง ปรับจำนวนโจทย์และดูผลจริง) และ **เล่นเพลง** (โน้ตตกเพื่อความเพลิดเพลิน ไม่มีคะแนน) ให้ชัดเจน
- ระหว่างตอบแบบฝึกให้ซ่อนเมนูและข้อความไม่เกี่ยวข้อง เหลือโจทย์ใหญ่ ผลถูก/ผิดเบา ๆ และพัก ภาพแนะนำนิ้วต้องตรงกับ voicing ของคอร์ด โดยไม่อ้างว่า MIDI ตรวจนิ้วได้
- อนุญาตรวมทำนองสาธารณสมบัติพื้นฐานที่ตรวจแหล่งที่มาแล้ว โดยทำข้อมูลโน้ตฝึกขึ้นใหม่ ไม่รวมเสียงบันทึก/ฉบับเรียบเรียงของผู้อื่น แถบมือซ้ายเขียว มือขวาน้ำเงิน มีป้ายบอกมือและเลือกทีละมือได้ ดู FREE_SONGS.md เพลงเป้าหมายที่ยังมีลิขสิทธิ์ยังต้องเป็นไฟล์ของผู้ใช้เอง
- การจบบทคือกดคำตอบถูกครบในแบบฝึกที่สอนไปแล้ว เก็บวันจบและแยกจริง/จำลอง ไม่ใช้จำนวนบทเป็นการรับรองความคล่อง หลักสูตรเริ่มต้นครอบคลุมคีย์ C–G กุญแจซอล/ฟา และคอร์ด ส่วนค่าตัวโน้ต จังหวะ ตัวหยุด เครื่องหมายแปลงเสียงและสองมือเต็มหลักสูตรยังเป็นงานถัดไป

## 4.1 เป้าหมายตามช่วงเวลา

| ช่วง | ผลลัพธ์ที่ต้องการ | สถานะการประเมิน |
|---|---|---|
| ทุกวัน | มีหนึ่งสิ่งที่ทำได้แม่นขึ้น คล่องขึ้น หรือมีความเข้าใจเพิ่มขึ้น | เปรียบเทียบผลแบบฝึกเดิมที่เงื่อนไขเท่ากัน |
| 1–3 เดือน | รู้จักโน้ต อ่านจังหวะง่าย เล่นคอร์ดพื้นฐาน และทำนองสั้น | แบบทดสอบย่อย + เพลงสั้น |
| 3–6 เดือน | เล่นท่อนเพลงโปรดแบบง่าย 2 มือ และคอร์ดเปลี่ยนคล่องขึ้น | Section mastery |
| 6–12 เดือน | เล่นเพลงโปรดฉบับเรียบเรียงสำหรับเปียโนได้หนึ่งเพลงเต็ม | Full-song performance rubric |
| ระยะยาว | แกะทำนอง/คอร์ดด้วยหู และทดลองเปลี่ยนการเรียบเรียง | Ear copy + arrangement portfolio |

## 4.2 รายชื่อเพลงที่สนใจ (เพลงเป้าหมาย ไม่ใช่ไฟล์ที่รวมมาในแอป)

1. **Renai Revolution 21 (恋愛レボリューション21)** — Morning Musume
2. **Kokoro no Placard (心のプラカード)** — AKB48
3. **I WISH** — Morning Musume
4. **Sakura no Ki ni Narou (桜の木になろう)** — AKB48
5. **365 Nichi no Kamihikouki (365日の紙飛行機)** — AKB48

**กลยุทธ์:** ยังไม่กำหนดว่าเพลงไหนง่ายที่สุดจนกว่าจะประเมินจาก arrangement จริง เพราะเพลงเดียวกันมีเวอร์ชันง่ายและยากต่างกันมาก

## 4.3 ระดับของเพลง (Song Skill Ladder)

- **L0 — Listen & Map:** รู้จักโครงสร้าง intro/verse/chorus, เคาะจังหวะ, ร้องหรือฮัมทำนองได้
- **L1 — Melody Fragment:** เล่นทำนองสั้น 2–4 ห้อง มือเดียว
- **L2 — Melody Section:** เล่นทำนองหนึ่งท่อนต่อเนื่องพร้อมจังหวะ
- **L3 — Harmony Basics:** เพิ่ม bass notes / simple chords มือซ้าย
- **L4 — Simplified Two Hands:** รวมสองมือแบบง่าย ช้ากว่าความเร็วต้นฉบับได้
- **L5 — Full Easy Arrangement:** เล่นเพลงฉบับง่ายตั้งแต่ต้นจนจบ
- **L6 — Expressive Performance:** คุมจังหวะ ความต่อเนื่อง น้ำหนัก และ phrasing
- **L7 — Ear & Rearrangement:** หาโน้ต คอร์ด และปรับ accompaniment/style เอง

ระดับเหล่านี้เป็นความสามารถต่อเพลง ไม่ใช่ level ของคนแบบเหมารวม

---

# 5. Persona / User Journey

## 5.1 Primary Persona

- ผู้เริ่มต้นที่คุ้นเคยชื่อคีย์อยู่บ้าง
- ชอบเพลงไอดอลญี่ปุ่นเป็นพิเศษ
- เวลาในแต่ละวันจำกัดประมาณ 30 นาที
- ต้องการครูที่ให้คำแนะนำแบบเฉพาะเจาะจง แต่ไม่กดดัน
- ไม่ต้องการถูกบังคับให้เรียนแต่ทฤษฎีก่อนเล่นเพลงจริง

## 5.2 First-Run Journey

1. เปิด Mimi Kopi เป็นครั้งแรก → เลือกภาษา (ไทยเป็นค่าเริ่มต้น) และธีม
2. Wizard ตรวจว่า Windows มองเห็น MIDI device หรือไม่
3. ผู้ใช้กดคีย์ 3 โน้ต → เห็น note on/off, channel, velocity ถ้ามี
4. ตรวจสอบ Sustain Pedal ถ้ามี; ไม่มีก็ข้ามได้
5. เลือก Audio Output ของ Windows → ทดลองเสียงเปียโนและ Metronome
6. ปรับตั้งค่า buffer/calibration ตามคำแนะนำ
7. ทำ placement mini-test สั้น ๆ (คีย์/อ่านโน้ต/จังหวะ/คอร์ด)
8. ระบบเสนอ Daily Plan และให้เลือกเพลงเป้าหมายหนึ่งเพลง

## 5.3 Returning User Journey

1. เปิด Today → เห็น “ต่อจากเมื่อวาน”
2. กด Start Session → Warm-up/skill/song/ear practice
3. ระบบให้ feedback ทันทีในโหมดเรียน และวัดจริงในโหมดสอบ
4. จบ session → เห็นคะแนนเปรียบเทียบที่เงื่อนไขเดียวกัน
5. เห็น 1–2 งานที่แนะนำสำหรับวันถัดไป พร้อมเหตุผล

---

# 6. Feature Specification

> ความหมาย priority: **P0** = ต้องมีสำหรับฝึกได้จริง; **P1** = เป้าหมายรุ่นแรกที่ใช้งานได้ครบ; **P2** = ต่อขยาย

## 6.1 MIDI Setup & Diagnostics — P0

- Enumerate MIDI input devices พร้อมชื่อ/ID
- Select, connect, disconnect, reconnect
- Real-time monitor: timestamp, status, pitch, channel, velocity, CC
- Interpret `Note On` ที่ velocity 0 เป็น `Note Off`
- รองรับเล่นหลายโน้ตพร้อมกัน
- Detect sustain CC64 ถ้าอุปกรณ์ส่งมา
- Auto-reset key state on disconnect / focus change เพื่อไม่ให้คีย์ติดบนจอ
- Store tested capability report แยกตามอุปกรณ์
- Simulator mode สำหรับ development, demo และ automated tests

**ข้อควรระวัง:** MIDI ไม่บอกนิ้วมือที่ใช้ หรือแยกมือซ้าย/ขวาได้แน่นอนถ้าไม่มีข้อมูล score/track หรือตั้งช่วงโน้ตเอง

## 6.2 Piano Sound Engine — P0

- Built-in polyphonic sampled/synthesized piano ผ่าน SoundFont
- MIDI note on/off/velocity, sustain ตามที่ device รองรับ
- Output ผ่าน Windows default audio device หรือเลือกเอง
- Volume: master / piano / metronome / backing audio
- เครื่องเล่น piano software voice เปิด/ปิดได้ ป้องกันเสียงซ้อนกับลำโพงเปียโน
- Audio device change + underflow/error handling
- Test sound / audio latency setup
- รองรับ import `.sf2` ที่ผู้ใช้มีสิทธิ์ใช้ (ไม่จำเป็นต้องมีหลาย SoundFonts ตั้งแต่ต้น)

## 6.3 Daily Practice & Fundamentals — P0/P1

- Keyboard orientation/landmark notes
- Reading treble/bass notes ตามระดับ
- Rhythm drills ด้วย Metronome/Count-in
- 5-finger patterns และ phrasing สั้น ๆ
- Triads, inverted chords, chord switching
- One-hand drills → two-hand coordination
- จัด exercise เป็นหน่วยเล็ก (2–8 ห้อง)
- บันทึกแต่ละ attempt แยกจาก completed session

## 6.4 Practice Player — P0/P1

- Real-time visual keyboard และ Piano Roll
- Speed/BPM control (เพลง MIDI), count-in, metronome
- Wait mode: หยุดรอจนกดถูก (ไม่ให้คะแนน timing ในช่วงหยุดรอ)
- Continuous mode: เล่นตาม tempo จริงพร้อมบันทึกข้อผิดพลาด
- Loop by bar/section, A/B points
- Practice selected track/hand (ถ้ามี metadata เพลงหรือกำหนดเอง)
- เห็นโน้ตที่พลาดและโน้ตที่กดเกิน
- ลดสิ่งรบกวนเมื่อ fullscreen
- นำเข้า `.mid` และ `.midi`

## 6.5 Song Studio — P1

- Personal library: title, artist, group, tags, local files, imported date
- Categories: Hello! Project / Morning Musume / AKB48 / Foundations / Other
- Song sections: intro, verse, chorus, bridge, custom regions
- แยก arrangement difficulty / track map ต่อไฟล์
- เลือก 2–8 ห้องที่กำลังฝึก แล้วค่อยต่อเป็น section ที่ยาวขึ้น
- Skill ladder สำหรับแต่ละเพลง (L0–L7)
- Bookmark, notes และป้าย “จุดที่ยาก”
- MusicXML import และ sheet notation อยู่ใน Phase ต่อขยาย หากยังไม่พร้อมใน Phase 3
- **ไม่ควรอ้างว่า auto simplify เพลงได้ถูกต้องทุกเพลง**; ใช้ manual simplification/editor ก่อน จึงค่อยสร้าง heuristics

## 6.6 Ear Copy Workspace — P1/P2

- Import audio ของผู้ใช้ เช่น WAV/MP3 โดยไม่อัปโหลดขึ้นบริการภายนอก
- Waveform, A/B loop, replay, seek, bookmark phrase
- Slow playback โดยควรรักษาระดับเสียงเดิมเมื่อเทคโนโลยีรองรับอย่างน่าเชื่อถือ
- Practice capture: บันทึกสิ่งที่ผู้ใช้ลองเล่นเป็น MIDI
- Hint ladder:
  1. ฟังซ้ำ/ช้าลง
  2. บอกลักษณะจังหวะและจำนวนโน้ตโดยประมาณ
  3. ให้ช่วง register หรือโน้ตเริ่มต้นถ้ามี reference
  4. แสดง reference notes เมื่อผู้ใช้เลือกเปิดเฉลยเอง
- ถ้าไม่มี reference transcription **ห้ามให้ pitch accuracy ปลอม**; วัดได้เพียงความพยายาม/จำนวนรอบฟัง/การบันทึกไอเดีย หรือให้ผู้ใช้ self-review
- ส่งเสริมให้ลองจับทำนองด้วยหูก่อนเห็นเฉลย

## 6.7 Progress & Coach — P0/P1

- Today: 30-minute mission, continue last attempt, small win
- Analytics: note accuracy, timing, chord, tempo, consistency, song section coverage, ear copy
- Historical comparison: same exercise version + same tempo + same mode + comparable latency settings
- Personal best และระดับความมั่นใจ (เช่น ผ่านเกณฑ์กี่ครั้งติด)
- จุดอ่อนรายห้อง/ช่วงโน้ต/คอร์ด พร้อมแบบฝึกแนะนำ
- Rules-based Coach เริ่มต้น (offline)
- AI explanation optional ในอนาคต พร้อมการควบคุมข้อมูล/ค่าใช้จ่าย
- Streak เป็นกำลังใจได้ แต่ไม่ใช้เป็นตัวแทนฝีมือ และไม่มีบทลงโทษขาดวัน

## 6.8 Library / Import & Export — P1

- Import locally-owned MIDI and audio files
- Store normalized source metadata, original relative/absolute path with missing-file reconciliation
- Folder or file picker via Tauri native dialogs
- Export user-created practice results (CSV/JSON) และ backup data
- การนำเข้า MusicXML เป็นส่วนต่อขยาย
- ไม่ bundle เนื้อหาเพลงเชิงพาณิชย์โดยไม่มี license

## 6.9 Settings / Localization / Accessibility — P0/P1

- ภาษา ไทย / English / 日本語
- Light/Dark modes ใช้สีหลักจากโลโก้ minimal pastel
- Adjustable font scale, keyboard labels, high contrast mode
- Audio MIDI calibration / selectable devices
- Keyboard shortcuts, tooltips, accessible states
- Settings backed up locally

---

# 7. Hardware, MIDI, Audio

## 7.1 Physical Connection

```text
Badger C-918
  └── USB-C (ฝั่งเปียโน)
        └── USB-A (ฝั่ง Windows 11 PC)
              └── Windows MIDI enumeration
                    └── Mimi Kopi MIDI input
```

**คำเตือน:** รูปร่างสาย USB-C / USB-A อย่างเดียวไม่รับประกันว่าจะมี USB MIDI class endpoint ต้องตรวจจริงกับ Windows และตัวแอป ในขั้นแรกให้ผู้ใช้เปิด Device Manager และ MIDI Diagnostics เพื่อตรวจชื่อ device; ถ้าเห็นเป็น audio อย่างเดียวต้องสืบพอร์ต/โหมดคู่มือของเปียโน

## 7.2 Audio Signal Flow

```text
MIDI keyboard -> MIDI Input Adapter -> timestamped MIDI event queue
                                         |             |
                                         v             v
                                    Sound Engine    Scoring Engine
                                         |
SoundFont piano --------------------------+
Metronome scheduler ----------------------+--> Audio Mixer --> Windows audio output
WAV/MP3 player ---------------------------+                 (headphones/speakers)
```

## 7.3 Engine Choices

- **Native MIDI:** Rust + `midir` หรือ adapter อื่นหากตรวจแล้วจำเป็น
- **Audio output:** `cpal` และ Windows backend ตามที่ฮาร์ดแวร์รองรับ
- **MIDI synthesis:** `rustysynth` + `.sf2` จากแหล่งที่อนุญาต
- **Audio file decoder/playback:** เลือก Rust library ที่ maintenance ดีและรองรับ WAV/MP3 โดยตรวจ version/license ก่อน implementation
- **Time base:** monotonic performance timing สำหรับ event และ scheduling, ไม่ใช้ React render timestamps
- **Threading:** audio callback ต้องไม่ block, ไม่ทำ file I/O / database queries / locking หนัก ๆ บน audio realtime thread; สื่อสารผ่าน buffered/ring channels ที่ออกแบบดี
- **Synchronization:** piano, metronome, backing track ต้องใช้ time base ที่ map กันได้ รวมทั้ง latency offset ระดับอุปกรณ์

## 7.4 Low-Latency Design

- ทดสอบ wired output เป็น baseline ก่อน Bluetooth
- มี device selector, sample rate / buffer settings เท่าที่ library/OS รองรับ
- เก็บผล calibration แยกต่อ output device และ input device
- แสดง end-to-end latency ที่วัดได้จริง หรือแสดงว่า **ยังไม่ได้วัด**; ห้ามแสดงตัวเลขแต่งขึ้น
- MIDI input latency และ speaker/Bluetooth audio latency ไม่เท่ากัน; เกณฑ์ timing ต้องอิง MIDI event ไม่ใช่เวลาที่เสียงจากลำโพงกลับถึงหู
- เปลี่ยนอุปกรณ์เสียงแล้วต้องจัดการ reinitialize และหยุดเสียงค้าง

## 7.5 Hardware Test Checklist

- [ ] Windows 11 เห็น USB MIDI input จาก Badger C-918
- [ ] กด C4 เห็น pitch ที่ถูกต้อง (เช่น MIDI 60 ตามมาตรฐาน) พร้อม display convention ที่สอดคล้อง
- [ ] กดคอร์ดอย่างน้อย 3 โน้ตพร้อมกันได้ครบ
- [ ] ปล่อยคีย์แล้วเสียงหยุดถูกต้อง
- [ ] Velocity response ถ้า hardware รองรับ
- [ ] Sustain response ถ้ามี pedal และส่ง CC64
- [ ] ถอด/เสียบ USB ใหม่แล้วยัง reconnect ได้
- [ ] เสียงเปียโนออกทางลำโพง/หูฟังคอมพิวเตอร์
- [ ] Piano, metronome และ backing audio ทำงานร่วมกัน
- [ ] ไม่เกิดเสียงแตกหรือ buffer underrun ในการทดสอบปกติ
- [ ] มีเสียงปุ่ม test/notes และ logging เมื่อเกิดข้อผิดพลาด

---

# 8. Technical Architecture

## 8.1 Preferred Technology

| Layer | Choice | Reason |
|---|---|---|
| Desktop | Tauri 2 | Windows installer, native bridge, ใช้ Web UI |
| UI | React + TypeScript + Vite | โครงสร้าง component และ tooling |
| Styling | Tailwind CSS + shadcn/ui | ทำ UI พาสเทลที่คงสไตล์ได้ |
| Visual piano roll | HTML Canvas 2D | วาดโน้ตจำนวนมากประสิทธิภาพดี |
| MIDI | Rust + midir | Native MIDI access |
| Audio synth | RustySynth + SoundFont | เสียงเปียโนจาก MIDI |
| Audio output | CPAL | จัดการ audio streams |
| Storage | SQLite (`rusqlite` หรือ `sqlx`) | Offline-first |
| Charts | React chart library ที่เหมาะ | Visualization ของ progress |
| Quality | Rust tests + Vitest + UI e2e (ตามความพร้อม) | Regression control |
| Packaging | Tauri Windows installer | ติดตั้งบน Windows 11 |

ตรวจสอบ compatibility ของ dependency versions ณ วันที่ลงมือ implement จริง ไม่ pin version ตามเอกสารนี้โดยไม่ทดสอบ

## 8.2 Logical Domains

```text
                     ┌──────────────────────────────┐
                     │ React UI / Tauri Shell       │
                     │ Today / Practice / Songs     │
                     │ Ear Copy / Progress/Settings │
                     └───────────┬──────────────────┘
                                 │ typed Tauri IPC/events
                     ┌───────────▼──────────────────┐
                     │ Application Services         │
                     │ Session / Plan / Library     │
                     └───┬────────┬────────┬────────┘
                         │        │        │
                   ┌─────▼──┐ ┌──▼─────┐ ┌▼──────────┐
                   │ MIDI   │ │ Audio  │ │ Practice   │
                   │ Device │ │ Engine │ │ + Scoring  │
                   └─────┬──┘ └──┬─────┘ └┬──────────┘
                         │        │        │
                         └────────┴────┬───┘
                                      ┌▼──────────────┐
                                      │ SQLite / Files │
                                      └───────────────┘
```

## 8.3 Suggested Repository Layout

```text
mimi-kopi/
├─ README.md
├─ docs/
│  ├─ PRODUCT_SPEC.md
│  ├─ ARCHITECTURE.md
│  ├─ MIDI_AUDIO_TEST_PLAN.md
│  ├─ SCORING_SPEC.md
│  ├─ CONTENT_GUIDELINES.md
│  ├─ ROADMAP.md
│  └─ decisions/
├─ assets/
│  ├─ brand/
│  └─ demo-content/             # public-domain/authorized only
├─ src/
│  ├─ app/                      # router, providers, app shell
│  ├─ pages/                    # Today, Practice, Songs, EarCopy, Progress, Settings
│  ├─ features/
│  │  ├─ midi/
│  │  ├─ audio/
│  │  ├─ lessons/
│  │  ├─ practice/
│  │  ├─ songs/
│  │  ├─ ear-copy/
│  │  └─ progress/
│  ├─ components/
│  ├─ hooks/
│  ├─ i18n/
│  ├─ styles/
│  └─ types/
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs
│  │  ├─ lib.rs
│  │  ├─ midi/
│  │  ├─ audio/
│  │  ├─ practice/
│  │  ├─ song/
│  │  ├─ persistence/
│  │  └─ commands/
│  ├─ migrations/
│  └─ tauri.conf.json
├─ tests/
├─ package.json
└─ .github/workflows/             # optional CI
```

## 8.4 Interfaces / Data Contracts

- `MidiInputAdapter`: enumerate, connect, disconnect, subscribe events
- `MidiEvent`: timestamp, device_id, message type, channel, pitch, velocity, control, value
- `AudioEngine`: select_output, load_soundfont, note_on, note_off, sustain, set_gain, shutdown
- `ExerciseDefinition`: id, version, target notes/chords, meter, tempo, scoring policy
- `PracticeAttempt`: exercise_id, version, mode, bpm, calibration_id, events, result
- `ScoringService`: `evaluate(reference, performance, policy) -> breakdown`
- `PracticePlanService`: `suggest(recent_attempts, user_goals, availability) -> tasks`
- `SongSection`: song_id, arrangement_id, start, end, assigned tracks, difficulty level

All IPC request/response schemas should be typed, versioned when persistent, and validated at the boundary.

---

# 9. Data Model และ Local Storage

## 9.1 Core Tables

| Table | สำคัญ | ตัวอย่าง fields |
|---|---|---|
| `app_settings` | P0 | locale, theme, audio device, midi device, output gain |
| `midi_devices` | P0 | id, display name, last_seen, capability_report |
| `audio_calibrations` | P0 | input_id, output_id, measured_offset_ms, method, date |
| `exercise_definitions` | P0 | id, version, type, difficulty, score_definition |
| `practice_sessions` | P0 | id, started_at, ended_at, total_duration, notes |
| `practice_attempts` | P0 | id, session_id, exercise_id, version, bpm, mode, metrics_json |
| `midi_event_records` | P1 | attempt_id, relative_timestamp, message, channel, pitch, velocity |
| `songs` | P1 | title, artist, group, source_status, tags |
| `arrangements` | P1 | song_id, file_reference, level, metadata, track_mapping |
| `song_sections` | P1 | arrangement_id, label, start_tick, end_tick |
| `song_attempts` | P1 | section_id, version, bpm, note_score, timing_score, passed |
| `daily_missions` | P1 | date, plan_version, task_list, status |
| `ear_copy_sessions` | P1 | audio_ref, start/end points, hints_used, self_review |
| `progress_snapshots` | P1 | benchmark_id, date, comparable_metrics |

## 9.2 Data Rules

- Save raw/normalized MIDI performance events where practical เพื่อคำนวณ metrics ใหม่ได้
- Exercise must include **version** so that changing the notes does not silently alter score comparability
- Compare results only when test conditions are compatible
- Use local file references; warn if the user moves a source file
- Backups should include DB plus user-created exercise metadata; large licensed media may remain referenced rather than copied
- Provide import/export schema migration plan; do not lose progress on app upgrades
- Do not include a cloud account or analytics telemetry by default

---

# 10. Progress Scoring, Calibration และ Analytics

## 10.1 Principles

1. **Accuracy ≠ speed:** แสดงความแม่นและ BPM แยกกัน
2. **Learning mode ≠ performance assessment:** Wait mode ช่วยเรียน แต่ไม่ใช้ให้ timing score
3. **Apples to apples:** เทียบแบบฝึกเดิม เวอร์ชันเดิม BPM เดิม และ mode เดิม
4. **Avoid score inflation:** กดโน้ตเกินและพลาดโน้ตต้องมีผลต่อ score
5. **Honest uncertainty:** ไม่มี reference ก็ไม่อ้าง accuracy
6. **Explainable feedback:** ทุกข้อเสนอมีหลักฐานจากโน้ต/ห้อง/คอร์ดที่พลาด

## 10.2 Suggested Quantitative Metrics

| Metric | Definition | Caveat |
|---|---|---|
| Note Precision | correct matched note-ons / all played note-ons | ลงโทษ extra notes |
| Note Recall | correct matched note-ons / all expected note-ons | ลงโทษ missed notes |
| Note F1 | harmonic mean of precision and recall | ใช้เป็น note summary ได้ |
| Onset Timing | median/mean absolute signed timing deviations (ms) | ต้อง calibrate; report early/late |
| Timing Hit Rate | % matched notes within configured tolerance | normal/continuous mode เท่านั้น |
| Chord Accuracy | % target chords with all required notes in chord window | tolerance ต่อการ arpeggiate ตั้งได้ |
| Tempo Mastery | highest BPM passing an equivalent benchmark repeatedly | ขึ้นกับ exercise version |
| Rhythm Stability | spread of timing errors, e.g. standard deviation | แยกจาก bias ที่ช้าหรือเร็วทั้งท่อน |
| Section Mastery | count/proportion sections passed at target quality | ไม่ใช่แค่เล่นผ่านครั้งเดียว |
| Sight-reading | first-attempt performance on previously unseen, level-controlled score | หลีกเลี่ยงท่องจำซ้ำ |
| Ear Copy | rubric by phrase length, hints used, transcription agreement if reference exists | ไม่มี reference ไม่ให้ pitch grade |
| Habit | days practiced / sessions completed | แสดงแยกจาก musical skill |

## 10.3 Example Initial Passing Criteria (ปรับได้)

- Matched notes precision/recall หรือ Note F1 **≥ 90%** ตามเกณฑ์แบบฝึก
- Onset timing: **อย่างน้อย 80%** ของ matched notes อยู่ภายใน **±150 ms** หลัง calibration
- ผ่าน **3 attempts ต่อเนื่อง** ที่ BPM เดียวกันจึงปลดล็อก BPM ถัดไป
- Chord drill ต้องผ่านเกณฑ์ chord window ที่กำหนด
- นี่เป็น **ค่าตั้งต้นเพื่อทดสอบระบบ** ไม่ใช่มาตรฐานสากล และควรปรับตามระดับ/เพลง

## 10.4 Event Matching Algorithm (แนวทาง)

1. Normalize reference notes (pitch/channel/target onset/duration/bar/track)
2. Normalize played events, pair note-on/off ตาม channel/pitch, handle pedal separately
3. Apply per-device timing calibration offset
4. Match expected ↔ actual pitch events within adjustable time window โดยป้องกัน double match
5. Mark missed, extra, late, early, wrong pitch
6. For polyphony/chords, match grouped note-on events within chord window
7. Aggregate per note → beat/bar → section → attempt
8. Persist details and rules version for reproducibility

**Important:** Algorithm must be independently unit tested with synthetic event streams, including chords, repeated same pitches, sustain and notes crossing measure boundaries.

## 10.5 Example Feedback

> “วันนี้ท่อนฮุกห้อง 1–4 ที่ 60 BPM เพิ่ม Note F1 จาก 76% เป็น 86% แต่โน้ตของมือซ้ายในห้อง 3 ยังช้ากว่าจังหวะเฉลี่ย 95 ms แนะนำให้แยกมือซ้าย 4 รอบที่ 50 BPM แล้วทดสอบใหม่”

ประโยคนี้ต้องถูกสร้างจากผลจริงเท่านั้น ไม่สร้างตัวเลขตัวอย่างในข้อมูลผู้ใช้จริง

## 10.6 Progress Dashboard

- Today's focus, what improved since last comparable attempt
- Per-skill trend: reading / rhythm / chords / coordination / song / ear
- Benchmark-specific best scores with date and BPM
- Milestone: first 4 bars, first section, simplified full song
- Weak bar heatmap, note confusion map, chord switch times
- Weekly recap: practice time + validated skill gains (separate)
- Avoid comparisons that penalize rest days or create unhealthy streak pressure

---

# 11. หลักสูตรและแผนการฝึกเปียโน

## 11.1 เริ่มจาก Placement Baseline

ครั้งแรกให้ระบบใช้แบบทดสอบสั้นไม่เกิน 10–15 นาที เพื่อวัด:

- หาโน้ต C–G ตามคำสั่ง
- อ่านโน้ตบน treble/bass staff ระดับง่าย
- เคาะ quarter/eighth patterns กับ metronome
- เล่น C, F, G, Am triads และเปลี่ยนคอร์ดช้า ๆ
- เล่นทำนอง 2 ห้อง มือขวา
- ประสานสองมือแบบง่าย ถ้าพร้อม

**ไม่แนะนำให้ประกาศว่าเป็นผู้เรียนระดับใดจากการทดสอบครั้งเดียว**; เก็บเป็น baseline แล้วปรับแผน

## 11.2 Learning Pillars

1. **Keyboard & Notation:** ตำแหน่งคีย์ มือ ทิศทางโน้ต landmark notes, treble/bass staff
2. **Rhythm & Timing:** meter, pulse, note durations, subdivisions, rests, metronome
3. **Technique & Coordination:** 5-finger patterns, hand independence, note release, controlled tempo
4. **Harmony:** triads, inversions, chord switching, root/broken chord accompaniment
5. **Songs:** melody phrases, chords, sections, simplified arrangements, expressive playing
6. **Ear Copy:** singing/humming, relative pitch, interval contour, short-phrase imitation
7. **Future Arrangement:** accompaniment patterns, voicing, transposition, groove/style variation

## 11.3 Default 30-minute Daily Session

| ระยะ | นาที | ตัวอย่าง |
|---|---:|---|
| Warm-up / Reading | 5 | หาโน้ตและอ่าน pattern ใหม่สั้น ๆ |
| Rhythm | 5 | Metronome / clap-or-key rhythms |
| Chord / Coordination | 5 | C–G–Am–F หรือชุดคอร์ดของท่อนเพลง |
| Idol Song Practice | 10 | ฝึก 2–4 ห้องจากเพลงเป้าหมาย |
| Ear Copy / Review | 5 | ฟังสั้น ๆ แล้วลองเล่นด้วยหู / ทดสอบท้ายคาบ |
| **รวม** | **30** | ปรับตาม fatigue และความพร้อม |

## 11.4 Weekly Pattern

- 4 วัน: บทฝึกพื้นฐาน + เพลงเป้าหมาย
- 2 วัน: เจาะ weakness เช่น โน้ตและจังหวะหรือเปลี่ยนคอร์ด
- 1 วัน: review / benchmark / เล่นสนุกตามเพลง

แผนนี้เป็น **ตัวเลือกแนะนำ** ไม่ใช่ข้อบังคับ การฝึกสั้นและพักอย่างเหมาะสมดีกว่าฝืนเล่นจนเกิดความเจ็บปวด

## 11.5 Curriculum Stages

### Stage A — Weeks 1–4: Orientation

- อ่านชื่อโน้ตและตำแหน่งคีย์ให้คุ้น
- โน้ตบน treble/bass แบบ landmark; rhythmic durations ขั้นต้น
- simple melodies 2–4 bars; 5-finger patterns
- Major/minor triads ง่าย ๆ และการรักษา tempo ช้า
- **Exit evidence:** เล่นทำนองสั้นและแบบฝึกจังหวะพื้นฐานผ่านเกณฑ์ที่ตั้งไว้

### Stage B — Weeks 5–8: Foundations into Song

- Treble/bass literacy กว้างขึ้น, rests, eighth-note subdivisions
- chord switching, broken-chord patterns
- hands-separate → short both-hands practice
- เลือกท่อนเพลงไอดอลจริงมาแบ่งเป็น fragments ที่เหมาะกับระดับ
- **Exit evidence:** ท่อน 4–8 ห้องแบบง่ายที่ BPM กำหนด

### Stage C — Months 3–6: Song Sections

- ลดการพึ่ง falling notes เพิ่ม sheet reading
- Two-hand song passages, accompaniment patterns
- Song map: A/B/chorus/bridge
- Ear copying 2–4 note phrases โดยยังไม่แสดงเฉลย
- **Exit evidence:** อย่างน้อยหนึ่ง section ของเพลงเป้าหมายเล่นได้คล่องในแบบ simplified arrangement

### Stage D — Months 6–12: Full Song Journey

- ต่อหลาย sections เป็นเพลงเต็ม (ฉบับง่ายก่อน)
- ฝึก transitions, stamina, dynamics, tempo stability
- พัฒนาคอร์ด inversions, harmony awareness, basic listening
- **Exit evidence:** เล่นเพลงหนึ่งเพลงตั้งแต่ต้นจนจบตาม arrangement ที่ตกลง ความต่อเนื่องและคุณภาพผ่าน rubric

### Stage E — Long Term: Ear Copy & Arrangement

- บันทึก melodic ideas ด้วยหู
- หา root movement และ triads จากเสียงที่ฟัง
- transposition, chord voicing, patterns for ballad/pop/bossa/jazz foundations
- ทำ arrangement ที่ผู้ใช้สร้างเองและเก็บใน portfolio

## 11.6 Adaptive Practice Rules (เริ่มจาก Rules-based)

- ถ้าโน้ตผิดบ่อย → ลดขนาด phrase หรือเพิ่ม recognition drills
- ถ้าโน้ตถูกแต่ช้ากว่าจังหวะ → ฝึก subdivision/metronome ช้าลง
- ถ้าคอร์ดผิด → แยก chord tones, inversions, switching
- ถ้าสองมือไม่ตรงกัน → hands separate ก่อนและกลับมารวมแบบสั้น
- ถ้าท่อนเดิมผ่านแล้ว 3 รอบ → เพิ่ม BPM ทีละเล็กน้อย/ต่อท่อน
- ถ้าฝึกหลายครั้งแล้วไม่ดีขึ้น → เปลี่ยนวิธีฝึก ไม่ใช่ให้ทำซ้ำไม่มีที่สิ้นสุด
- ถ้าความล้าหรือ discomfort → พักและลดความเข้มข้น

---

# 12. UX/UI, Branding, Localization

## 12.1 Brand

- **Primary display name:** 耳コピー
- **Secondary romanization:** Mimi Kopi
- **Concept:** สัญลักษณ์หู + คีย์เปียโน จากโลโก้ที่ผู้ใช้เลือก
- **Mood:** Japanese pastel minimal, friendly, clean, focused
- **Avoid:** ดวงดาว/หัวใจ/decoration จำนวนมากที่แย่งพื้นที่อ่านโน้ต
- **Icon:** ย่อโลโก้เป็นรูปหู + 2–3 piano keys สำหรับ taskbar และ installer

## 12.2 Color Direction (provisional design tokens)

| Role | Light | Dark |
|---|---|---|
| Background | `#F9FAFF` | `#151B2B` |
| Surface | `#FFFFFF` | `#20283A` |
| Primary pink | `#F47FA8` | `#F18DB5` |
| Secondary blue | `#8BB9FA` | `#83AEFA` |
| Text | `#25324D` | `#EAF0FF` |
| Accent violet | `#AAA1E8` | `#B3A7F2` |

Colors are suggestions. Verify contrast in both themes and allow accessibility override.

## 12.3 Screens

1. **Today / Home:** daily mission, resume previous lesson, one measurable gain
2. **Practice:** Piano Roll, keyboard, metronome, hands, loop, wait/continuous modes
3. **My Songs:** personalized idol song library with arrangements/sections
4. **Song Workspace:** sections, notes, difficulty, exercise list, small progress
5. **Ear Copy:** audio waveform, loop points, play speed, record MIDI attempt, gradual hints
6. **Progress:** metrics, same-test comparison, chart, weak spots, achievements
7. **Sound & MIDI Settings:** device selector, volume mixer, latency, test
8. **Diagnostics:** raw MIDI monitor / audio faults / capability report
9. **Learning Path:** curriculums, competencies, mastered/practice needed

## 12.4 Primary Practice Screen Layout

- Top bar: song/exercise title, selected BPM, MIDI/audio status
- Left sidebar: Today / Practice / My Songs / Ear Copy / Progress / Settings
- Center (~65–75%): notation/Piano Roll, timeline, piano keyboard
- Right rail: today's focus, note/timing feedback, section tips
- Bottom transport: play, pause, loop, count-in, speed, metronome
- Fullscreen focus mode hides sidebars and secondary statistics

## 12.5 Accessibility and Localization

- Thai first, English and Japanese translations via i18n key system
- Chord symbols remain standard (C, Am, F, G)
- Clearly separate MIDI note conventions (Middle C labels may be C3/C4 across systems)
- Do not rely solely on pink/blue for left/right hands; text labels and patterns
- Font selection must render Thai + Japanese correctly without shipping restricted font files
- Responsive for laptop and desktop, including 1366×768 and 1920×1080

## 12.6 Claude Design Handoff (ออกแบบก่อนเขียนโค้ด)

**เป้าหมาย:** ให้ Claude Design ออกแบบหน้าตาและปฏิสัมพันธ์ของแอป Windows 11 ให้ครบ โดยยึด product spec เป็นหลัก ไม่ใช่สร้างภาพสวยที่ไม่สามารถใช้งานจริงได้

**สิ่งที่ควรส่งให้ Claude Design:**

1. ไฟล์ `Mimi_Kopi_Product_Spec_TH.md` ฉบับนี้
2. โลโก้ Ear + Piano สีพาสเทลที่ผู้ใช้เลือกไว้ (ถ้ามีภาพต้นฉบับ ให้แนบแยกต่างหาก; ไฟล์นี้ไม่ได้ฝังภาพ)
3. โจทย์ให้แสดงชื่อหลัก `耳コピー` และชื่อรอง `Mimi Kopi`; รองรับภาษาไทย/อังกฤษ/ญี่ปุ่น

**ขอบเขตออกแบบ:**

- Design tokens: light/dark, spacing, typography, color, focus/hover/error/disabled states
- Navigation: Today, Practice, My Songs, Song Workspace, Ear Copy, Progress, Sound & MIDI Settings, Diagnostics และ Learning Path
- Main practice workspace: piano roll, transport, MIDI keyboard, BPM, metronome, loop A/B, Wait/Continuous mode, left/right/both-hand controls
- Audio settings: MIDI input diagnostics, Windows audio output, SoundFont, piano/metronome/backing volume, latency calibration, device unavailable state
- Daily 30-minute mission, daily improvement, meaningful progress comparisons at identical test conditions
- Song library and section navigation; no reliance on existing copyrighted audio embedded in design
- Ear Copy: listen → loop → attempt → check/review → gradual hint, without automatic answer reveal by default
- Onboarding, first-time no-MIDI demo, permission/error, disconnected/reconnected, empty library, offline states
- Keyboard accessibility, focus order, resizing, minimum window size and responsive desktop resolutions

**Design deliverables:**

1. Screen inventory and user flow map
2. High-fidelity designs for primary screens in Light and Dark modes
3. Component inventory and reusable states
4. Interaction notes including time-based controls, audio settings and keyboard shortcuts
5. Exportable design tokens / component specs usable by React + Tailwind + shadcn/ui
6. Explicit list of design assumptions requiring product or hardware validation

**Copy-ready instruction for Claude Design:**

```text
You are the lead product designer for 耳コピー (Mimi Kopi), a Windows 11
MIDI piano practice and ear-copy application.
Read this entire Markdown product specification as your source of truth.
Create a cohesive, implementation-ready desktop design system and screen
specification, based on the selected pastel minimal ear+piano brand direction.
Use 耳コピー as the primary app name and Mimi Kopi as secondary romanization.
Design for a genuine beginner practicing 30 minutes per day, with clear
progress, daily missions, MIDI diagnostics, playable-song sections, and
an Ear Copy workflow that trains listening rather than revealing answers.
Provide light/dark themes, Thai/English/Japanese-aware layouts, responsive
behavior, complete component states, and realistic empty/error states.
Prioritize usability, clarity of piano roll and keyboard, and low-clutter UI.
Deliver screen designs, tokens, interactions, assets guidance, and a concise
implementation handoff for a Tauri + React + TypeScript development team.
Do not pretend the app is implemented. Do not invent capabilities for
Badger C-918. Mark demo data clearly and avoid copyrighted song content.
```

## 12.7 Claude Code Handoff (พัฒนาหลังออกแบบ)

- ให้ Claude Code อ่านไฟล์ฉบับนี้ **และ** ผลงานของ Claude Design ก่อนเขียน UI
- ถ้า design spec กับ acceptance criteria ขัดกัน ให้ functionality, accessibility, accuracy และ user safety มาก่อน พร้อมบันทึก trade-off
- เริ่มทำ Phase 0 และ Phase 1 เท่านั้นในรอบแรก; ไม่สร้างทุกหน้าพร้อมฟังก์ชันปลอม
- ใช้ design tokens/components ที่ส่งต่อมาอย่างสม่ำเสมอ และคงโครงสร้างปรับ UI ได้ภายหลัง
- ทดสอบ MIDI/audio ด้วย simulation ได้ แต่ต้องแยกบอกงานที่ยังต้องทดสอบกับ Badger C-918 จริง

---

# 13. Roadmap และ Milestones

> **สำคัญ:** ไม่สั่ง AI ให้ทำทุกอย่างรวดเดียว เพราะเสี่ยงได้ UI ที่ดูครบแต่ MIDI/Audio ใช้ไม่ได้จริง ทุก Phase ต้องมี working demo และ acceptance gates ก่อนขยับ

## Phase 0 — Discovery, Setup & Project Governance

**Deliverables:** repository, product docs, design tokens, test plan, decision log, Git baseline, Windows prerequisites, hardware checklist

**Gate:** พัฒนา/ทดสอบ Tauri sample app บน Windows 11 ได้และ build ผ่าน

## Phase 1 — MIDI + Audio Vertical Slice (P0)

**Deliverables:** MIDI enumeration, connect/disconnect/reconnect, keyboard visualization, SoundFont engine, Windows audio output selector, independent volume, basic MIDI/audio diagnostics, error handling

**Gate:** กดคีย์ Badger C-918 แล้วแสดง pitch ถูกต้อง และได้ยินเสียงในคอม; ถ้า device ไม่รองรับ ให้แสดงปัญหาและทำ simulation demo ได้ ไม่อ้างผ่าน hardware gate

## Phase 2 — Daily Fundamentals + Honest Scoring (P0/P1)

**Deliverables:** Note/rhythm/chord exercises, continuous/wait modes, metronome, reference event matching, timing calibration, SQLite attempts, Today mission, simple progress

**Gate:** ทำแบบฝึกได้จริง 30 นาที บันทึกผล ดูย้อนหลังได้ และ scoring ผ่าน unit tests ครอบคลุมกรณีสำคัญ

## Phase 3 — Song Studio (P1)

**Deliverables:** MIDI import, library, arrangement tracks, section loop, hands/practice modes, beat/bar markers, BPM, section progress, personalized list

**Gate:** นำเข้า MIDI ที่มีสิทธิ์ใช้ เลือก 4 ห้อง วนฝึก และบันทึก section accuracy ได้อย่างถูกต้อง

## Phase 4 — Ear Copy Audio Workspace (P1)

**Deliverables:** Local WAV/MP3 player, waveform and A/B loop, replay tools, speed control (รักษาคีย์ถ้าทำได้คุณภาพดี), MIDI capture, hint ladder, self-review

**Gate:** นำเข้า audio, เลือกช่วง, ฟังวน, เล่นทับ/เล่นตอบ, บันทึก MIDI attempt โดยไม่บังคับให้ใช้ transcription และไม่รายงาน accuracy ปลอม

## Phase 5 — Curriculum Intelligence & Notation (P2)

**Deliverables:** adaptive recommendations, MusicXML import and sheet notation, calibrated reading tests, more exercises, richer analytics, export/backups, content authoring

**Gate:** แผนวันถัดไปเปลี่ยนอย่างอธิบายได้จาก weakness จริง, การอ่านโน้ตและ song scores ใช้งานได้

## Phase 6 — Arrangement Lab, Product Hardening, Installer (P2)

**Deliverables:** basic accompaniment patterns, transpose/key changes, arrangement workspace; packaging and Windows update/backup migration plan; localization polish; accessibility; installer/release checklist

**Gate:** stable installer and upgrade test; no loss of practice progress; long-running MIDI/audio tests pass; users can save their own arrangements

---

# 14. Acceptance Criteria / Test Plan

## 14.1 Definition of Done (ใช้ทุก Phase)

- [ ] ฟีเจอร์มี test evidence ไม่ใช่เพียงภาพ UI
- [ ] TypeScript typecheck, lint, Rust check/tests ผ่าน
- [ ] ไม่มี runtime errors/blocking warnings ใน main flow
- [ ] Error/loading/disconnect/empty states มีจริง
- [ ] มี manual QA steps และ expected outcomes
- [ ] Docs/CHANGELOG/decision log อัปเดต
- [ ] Git commit ก่อน merge, ไม่มี secrets ใน repository
- [ ] Mark items `hardware-not-yet-verified` หากไม่ได้ทดสอบกับ Badger C-918 จริง

## 14.2 MIDI Acceptance

- [ ] Detect และเลือก MIDI device ได้
- [ ] Note on/off ตรงกับคีย์ที่กด
- [ ] หลายโน้ตพร้อมกันถูกต้อง
- [ ] Velocity 0 = note-off handling
- [ ] Repeated same pitch handling
- [ ] Sustain optional handling
- [ ] Disconnect/reconnect ไม่เกิด stuck notes
- [ ] Event timestamps monotonic & stable

## 14.3 Audio Acceptance

- [ ] เลือกอุปกรณ์เสียงออกได้หรือใช้ default อย่างชัดเจน
- [ ] Piano note กดแล้วมีเสียง
- [ ] Polyphony และ sustain ตาม capabilities
- [ ] Metronome + audio track + piano เล่นพร้อมกันได้
- [ ] Master/piano/music/metronome volume แยกจริง
- [ ] Buffer/device failures มี recovery/error UX
- [ ] Latency test มีวิธีวัดและรายงานค่าตามจริง

## 14.4 Scoring Acceptance

- [ ] Missed notes ไม่ถูกนับเป็น correct
- [ ] Extra notes ส่งผลต่อ precision
- [ ] Wait mode ไม่ได้ timing grade
- [ ] Wrong note, repeated pitch, chords, sustain, timing edge cases มี unit tests
- [ ] Comparable tests เท่านั้นที่ถูกเปรียบเทียบเป็น improvement
- [ ] Scoring rule version persisted
- [ ] มี per-bar feedback และ reproducible raw event log สำหรับตรวจสอบ

## 14.5 Song & Ear Copy Acceptance

- [ ] Import standard MIDI file, show duration/tempo/track summary
- [ ] Section loop ที่ A/B bounds ถูกต้อง
- [ ] Selected hand/track ไม่ใช่ heuristic ที่อ้างแม่นยำเกินข้อมูล
- [ ] Audio player import WAV/MP3 ได้
- [ ] Playback loop และ speed controls ใช้ได้จริง
- [ ] Ear Copy without ground truth ไม่โชว์ pitch match percentages
- [ ] ไม่มีการดาวน์โหลดเพลงเชิงพาณิชย์อัตโนมัติโดยไม่มีสิทธิ์

## 14.6 Persistence / UX / Windows Acceptance

- [ ] SQLite migrations work across versions
- [ ] Restart app แล้วสถิติไม่หาย
- [ ] Export/backup ผ่าน test round-trip
- [ ] Thai/English/Japanese switch works; no missing key in main flows
- [ ] Light/Dark works and contrast accessible
- [ ] Windows 11 build generates installer and can install/launch/uninstall
- [ ] Offline mode ยังฝึกและดู progress ได้

---

# 15. Risks / Trade-offs / Out of Scope

| Risk | ผลกระทบ | วิธีลดความเสี่ยง |
|---|---|---|
| เปียโนไม่ปรากฏเป็น MIDI device | โหมดเล่นกับเปียโนใช้ไม่ได้ | Phase 1 hardware diagnostics ก่อน |
| Audio latency โดยเฉพาะ Bluetooth | กดแล้วเสียงตามช้า | wired baseline, buffer/calibration, device guidance |
| Rust audio callback เกิด blocking | เสียงกระตุก | real-time design & stress tests |
| Software synth / SoundFont license | แจกจ่ายไม่ได้ | ตรวจ license และใช้ authorized assets |
| เพลงต้นฉบับมีลิขสิทธิ์ | ไม่สามารถ bundle/copy freely | user imports / licensed content |
| คะแนนดูดีแต่ไม่ได้เก่งจริง | คำแนะนำผิดทาง | scoring modes, comparable benchmarks, holdout tests |
| MIDI import ไม่มี hand metadata | แยกมือไม่แม่น | explicit track mapping/manual sections |
| Audio song ไม่มีโน้ตอ้างอิง | ไม่สามารถ auto-score pitch | self-review / optional reference annotation |
| Scope ใหญ่เกินไป | แอปไม่เสร็จจริง | phase gates, feature flags, MVP vertical slices |
| AI เปลี่ยน API/อัปเกรด dependency พัง | build ล้มเหลว | tests, lockfiles, Git, small PRs |

**MVP out of scope:** Cloud sync, subscriptions, community, auto song acquisition, full automatic polyphonic transcription, universal hands detection, AI arrangement generation, automatic commercially copyrighted arrangements.

---

# 16. AI-assisted Development Workflow

## 16.1 Tool Choice

- ใช้ **Codex** หรือ **Claude Code** เป็นตัวลงมือทำหลักเพียงตัวเดียวในแต่ละงาน
- ใช้อีกตัวตรวจโค้ด/review ได้ แต่ไม่ให้แก้ branch เดียวพร้อมกันแบบไม่ประสานงาน
- โค้ด, docs, test cases, migrations ทั้งหมดอยู่ใน Git repository ของผู้ใช้ ไม่ผูกกับโมเดลใด

## 16.2 Working Rules for Coding Agent

1. Read `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before modifying architecture.
2. Confirm toolchain and dependency compatibility on Windows 11.
3. List exact scope of the current phase and **non-goals**.
4. Build a **working vertical slice** first; never label mock UI a finished feature.
5. Run tests, static checks and build after implementation.
6. Clearly distinguish tested on simulation vs tested on real Badger C-918.
7. Add simple diagnostics and user-visible error states for hardware-dependent features.
8. Save decisions in `docs/decisions/` (ADRs) for irreversible architectural choices.
9. Commit a stable milestone after the user verifies or automated tests pass.
10. Do not silently download unlicensed tracks, fonts, SoundFonts, or proprietary media.
11. Use small, reviewable tasks and report changes/files/tests/blockers at each checkpoint.
12. Do not add cloud, login, telemetry, or unrequested AI API keys by default.

## 16.3 Repository Controls

- Branch naming: `feat/midi-diagnostics`, `feat/audio-engine`, `feat/practice-scoring`
- Commit naming: `feat: add native MIDI input monitor`
- Required files: `.gitignore`, `README.md`, `docs/PRODUCT_SPEC.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, `LICENSE` if chosen
- CI: lint + TypeScript check + Rust check + unit tests; packaging build where Windows runner available

## 16.4 AI Tutor In-App (optional future architecture)

- Start with **offline deterministic rules**, not an LLM dependency
- AI-generated advice receives structured, de-identified practice summaries only with user consent if online
- Never let LLM modify score or invent success metrics
- Cache/record tutor recommendation provenance and show “why this suggestion”
- Support an entirely offline experience when AI is not configured

---

# 17. Master Prompt สำหรับ Codex / Claude Code

> ส่งข้อความนี้ใน repo พร้อมไฟล์ Product Spec ฉบับนี้ แนะนำให้ใส่ข้อความนี้ใน `docs/AGENT_BRIEF.md` หรือ paste เป็นงานแรกของ coding agent

```text
You are a senior Windows desktop engineer, Rust audio/MIDI engineer,
React/TypeScript product engineer, and music education systems designer.

PROJECT:
耳コピー (Mimi Kopi) — a Windows 11 offline-first MIDI piano practice,
ear-copy, and measurable learning application.

Read docs/PRODUCT_SPEC.md carefully. Treat it as the product source of truth.
Do not implement features that contradict it.

USER CONTEXT:
- Beginner who knows basic key names and a few notes, but struggles with
  sight-reading, timing, chord switching, and both-hand coordination.
- Practices approximately 30 minutes per day.
- Loves Morning Musume / Hello! Project / AKB48 music.
- Goal: measurable daily progress, simplified full-song performance in
  6–12 months (not guaranteed), and eventually ear-copy/arrangement skills.
- Keyboard: Badger C-918 via USB-C (piano) to USB-A (Windows 11 PC).
  Do NOT assume this proves the device exposes USB MIDI, velocity, or CC64.
  Implement device diagnostics and validate on real hardware.
- Audio output: computer speakers or headphones (exact type unknown).

STACK PREFERENCE:
- Tauri 2
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Rust + midir native MIDI adapter
- RustySynth with licensed SoundFont and CPAL/WASAPI for sound output
- SQLite local database
- Canvas 2D piano roll

PRODUCT EXPERIENCE:
- App display name: 耳コピー; English secondary label: Mimi Kopi.
- Thai, English, Japanese support.
- Minimal pastel pink/blue interface inspired by existing selected logo.
- Light and dark themes.
- Offline-first and installable on Windows 11.
- Piano sound, metronome, and WAV/MP3 backing audio through computer audio.
- MIDI diagnostics, real-time keyboard, note/rhythm/chord exercises.
- Song library, MIDI import, sections, loops, hands modes, BPM.
- Ear-copy tools that encourage genuine listening, not instant reveal.
- Reproducible scoring and progress tracking, daily practice missions.

NON-NEGOTIABLE ENGINEERING RULES:
1. Build incrementally; DO NOT implement all phases at once.
2. Phase 0: validate toolchain and architecture. Phase 1: MIDI + audio
   working vertical slice. Stop for real hardware testing gate where needed.
3. Do not present mock data/visualizations as real performance results.
4. Separate MIDI timing, audio callback, scoring, UI rendering, and storage.
5. Do not perform DB operations or blocking file I/O in audio callback.
6. Handle note-on velocity zero, repeated pitches, chords, disconnect,
   sustain if supported, stuck notes, and device/output errors.
7. Timing scores only in continuously scheduled benchmark mode, not wait mode.
8. Match note precision/recall and handle extra/missed note events.
9. Compare progress only under compatible exercise version/BPM/mode conditions.
10. In Ear Copy with no reference, do not invent pitch accuracy.
11. No unlicensed song files or SoundFonts bundled.
12. Git commits, tests, clear setup docs, migrations, logs and honest status.

FIRST TASK:
A. Inspect environment; list Windows 11 prerequisites and verify toolchains.
B. Propose architecture and folder structure consistent with the spec.
C. Identify hardware unknowns and implement a MIDI simulation adapter.
D. Implement Phase 1 step by step: native MIDI input/monitor, on-screen
   keyboard, basic software piano audio via computer, device settings,
   diagnostics, reconnect recovery, and SQLite bootstrap.
E. Run formatting, tests, typechecks, Rust checks and Tauri dev/build.
F. Produce a report with changed files, commands run, evidence, known
   issues, and checklist of manual Badger C-918 hardware tests.
G. Do not claim Phase 1 is complete until criteria actually pass.

Produce code, not just architecture slides or a mockup.
```

---

# 18. Phase Prompts

## 18.1 Phase 0 — Repo & Architecture

```text
Read the attached PRODUCT_SPEC.md. Set up a maintainable Windows 11 Tauri 2 +
React/TypeScript/Rust repository. Create architecture docs, MIDI/audio/scoring
interfaces, design tokens, test plan, README, and Git workflow. Verify
Windows toolchain prerequisites. Keep functionality minimal; no fake MIDI
success claims. Run basic build/checks. Report blockers and next tasks.
```

## 18.2 Phase 1 — Hardware Vertical Slice

```text
Implement native MIDI enumeration/connection and real-time note/CC monitor
in Rust. Build an on-screen piano; create a software piano engine using
RustySynth + CPAL with an authorized SoundFont selection workflow. Output
audio to Windows speakers/headphones. Add diagnostics, connect/reconnect,
volume controls, and a simulator adapter. Test pitch, velocity, chord,
sustain optionality and disconnect handling. Document which results still
require live Badger C-918 validation. Do not claim working MIDI without it.
```

## 18.3 Phase 2 — Lessons & Scoring

```text
Implement beginner note, reading, rhythm, chord and two-hand micro-exercises.
Add metronome, count-in, wait mode, continuous assessment mode, session
records, and a reproducible scoring engine. Include note precision/recall,
F1, timing hit rate, calibration, chord matching and per-bar feedback.
Use versioned exercises and compare only compatible benchmarks. Persist
attempts in SQLite. Create a 30-minute Today view and basic progress charts.
Test synthetic MIDI edge cases comprehensively.
```

## 18.4 Phase 3 — Personal Idol Song Studio

```text
Implement user-owned MIDI import, track mapping, song library, section
selection, adjustable tempo, loop practice, hands practice and section
mastery. Support personalized categories Morning Musume, Hello! Project,
AKB48 without bundling commercial tracks. Store arrangements separately
from songs. Test note-on alignment, time signatures, tempo changes, loop
boundaries and song section score persistence.
```

## 18.5 Phase 4 — Ear Copy Workspace

```text
Implement offline local WAV/MP3 import, audio playback, waveform, A/B repeat,
replay bookmarks, adjustable playback speed, and optional pitch-preserving
slowdown after quality validation. Capture user's MIDI attempts. Design
progressive hints, defaulting to listening without instant transcription.
Where no reference score exists, label the attempt as unverified and use
self-review instead of fabricated pitch scores. Test audio/MIDI timing.
```

## 18.6 Phase 5 — Adaptive Coaching, MusicXML, Analytics

```text
Implement rule-based adaptive recommendations using real benchmark results:
weakness location, suggested exercise, suggested tempo and explanation.
Add MusicXML import and notation display if compatible parsers are available.
Build sight-reading benchmarks, richer analytics, accessibility settings,
local backup/export, and multilingual polish. Keep AI-generated feedback
optional rather than required. Test migrations, benchmark comparability
and localization strings.
```

## 18.7 Phase 6 — Arrangement & Release

```text
Add a basic Arrangement Lab with user-authored chord/voicing/accompaniment
patterns, transpose/key change and arrangement export. Harden MIDI/audio
stability, device failures and recovery. Produce a Windows 11 installer,
validate first-run setup, offline use, upgrades, data migration, backup,
uninstall/reinstall and performance. Write a reproducible release checklist.
Do not ship unauthorized songs, fonts or SoundFonts.
```

---

# 19. Decision Log และคำถามที่ยังไม่บล็อกการพัฒนา

## 19.1 Accepted Product Decisions

- **Windows 11 native desktop** ไม่ใช่ HTML page ที่เปิดอย่างเดียว
- **Tauri + React + TypeScript + Rust** เป็นทิศทางหลัก
- **USB-C → USB-A** เป็นการเชื่อมต่อจริงที่ผู้ใช้ระบุ ไม่เรียกมันว่า MIDI DIN converter อีก
- เสียงเปียโนจาก **คอมพิวเตอร์** เป็นค่าเริ่มต้น พร้อม master/piano/metronome/backing controls
- **ไทย / อังกฤษ / ญี่ปุ่น**, Light/Dark
- **เพลงไอดอลเป็นแรงขับเคลื่อนหลัก** แต่มี fundamentals ที่จำเป็น
- Progress ต้อง **แยก metric และสรุปภาพรวม**, ไม่อิง streak อย่างเดียว
- Wait mode สำหรับ learning; continuous mode สำหรับ scoring
- **Ear Copy ไม่เฉลยแทนผู้เรียนทันที**
- MVP ทำทีละ vertical slice พร้อมเกณฑ์ทดสอบ

## 19.2 Open Items (ตรวจภายหลังโดยไม่ต้องหยุดเริ่ม Phase 0)

1. Windows enumerates Badger C-918 MIDI device ชื่ออะไร, ส่ง event อะไรบ้าง?
2. Computer audio ใช้อุปกรณ์ wired/USB/Bluetooth/ลำโพงใดเป็นหลัก?
3. Sustain pedal มีหรือไม่ และส่ง MIDI CC64 หรือไม่?
4. Authorized `.sf2` เริ่มต้นใช้ชุดใด/license อะไร?
5. เพลงเป้าหมายแรกที่จะนำเข้า MIDI/โน้ตที่มีสิทธิ์ใช้เป็นเพลงใด?
6. ระดับความซับซ้อนของ rhythm/notation ใช้อะไรเป็น placement baseline?
7. ต้องการ MusicXML import เป็น gate สำคัญก่อน Phase 4 หรือหลัง Phase 4?
8. รายละเอียด install/update method, app ID, legal license ในช่วง release

## 19.3 Recommended Next Action

1. สร้าง repository `mimi-kopi` และวางเอกสารนี้ที่ `docs/PRODUCT_SPEC.md`
2. ใช้ **Master Prompt** ทำ Phase 0/Phase 1 เท่านั้น
3. เสียบ Badger C-918 กับ Windows 11 และตรวจ MIDI event จริงให้ได้ก่อน
4. เมื่อตรวจแล้วว่ากดคีย์มีเสียง/มี note off ถูกต้อง จึงเริ่ม Phase 2
5. เลือกเพลงเป้าหมายจากรายการ 5 เพลงและหา arrangement ที่ได้รับอนุญาตมาเริ่มฝึกเป็นท่อน

---

## Appendix A — Minimal User Stories

- **US-01:** ในฐานะผู้ฝึก ฉันต้องการเสียบเปียโนแล้วเห็นโน้ตบนจอทันที
- **US-02:** ฉันต้องการได้ยินเสียงเปียโนจากหูฟังคอม ไม่ต้องอาศัยเสียงจากตัวเครื่อง
- **US-03:** ฉันต้องการรู้ว่าวันนี้ควรฝึกอะไรภายใน 30 นาที
- **US-04:** ฉันต้องการฝึกท่อนฮุก 4 ห้องวนซ้ำช้า ๆ ก่อนเล่นต่อ
- **US-05:** ฉันต้องการคะแนนที่แยก note accuracy กับ timing เพื่อรู้ว่าจะปรับอะไร
- **US-06:** ฉันต้องการเห็นว่าฉันผ่าน BPM เดิมได้แม่นขึ้นหรือยัง
- **US-07:** ฉันต้องการเปิดเพลงที่ชอบวนช่วงหนึ่ง แล้วลองแกะด้วยหูโดยไม่ถูกเฉลยทันที
- **US-08:** ฉันต้องการย้อนดูผลทุกวันแม้ไม่ต่ออินเทอร์เน็ต
- **US-09:** ฉันต้องการเปลี่ยน UI เป็นไทย อังกฤษ หรือญี่ปุ่นและเลือก Light/Dark
- **US-10:** ฉันต้องการเพิ่มเพลงที่มีสิทธิ์ใช้งานเข้า My Songs และฝึกทีละ section

## Appendix B — Suggested First Hardware Test (Manual)

1. เปิด MIDI Diagnostics ขณะเสียบสาย USB-C → USB-A
2. เลือก input device ที่ปรากฏ (อาจไม่แสดงชื่อ Badger โดยตรง)
3. กด C4 สั้น ๆ 3 ครั้งและตรวจ note on/off
4. กด C-E-G พร้อมกันและตรวจว่ามี 3 note events
5. ตรวจค่าความแรง (ถ้ามี); เปรียบเทียบการกดเบา/แรง
6. ตรวจ CC64 ถ้ามี pedal
7. เลือก Windows audio device และกด Test Sound
8. เล่น metronome พร้อมกดเปียโน
9. ถอด USB ตอน idle → reconnect แล้วลองใหม่
10. Export diagnostics JSON (โดยไม่รวมข้อมูลส่วนตัวที่ไม่จำเป็น) เพื่อใช้ debug

## Appendix C — Notes for Content Copyright and Learning Integrity

- เพลง AKB48/Morning Musume ที่ระบุเป็น **เป้าหมายการเรียน** ไม่ใช่ไฟล์เพลงที่แอปมีสิทธิ์แจกจ่าย
- ให้ผู้ใช้นำเข้าไฟล์เสียง/โน้ต/MIDI ของตนเองที่มีสิทธิ์ใช้
- หากในอนาคตมี auto-transcription ให้แสดง provenance ความเชื่อมั่นและให้ผู้ใช้ตรวจทาน
- แบบฝึก theory, scales, chord drills สามารถสร้างเป็นเนื้อหาออริจินัลของแอปได้
- ระบบฝึกแกะเพลงเน้นการฟัง การเดา การลองเล่น และการสะท้อนผล ไม่ใช่การให้คำตอบอัตโนมัติทุกครั้ง

---

**End of Mimi Kopi Product Specification v1.1 — Claude Design → Claude Code handoff**
