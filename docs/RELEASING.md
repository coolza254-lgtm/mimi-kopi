# การออกเวอร์ชันใหม่ (Release)

แอปเช็กเวอร์ชันใหม่จาก GitHub Releases ของรีโปนี้ (`latest.json`) แล้วติดตั้งให้เองเมื่อผู้ใช้กดอัปเดต
ไฟล์อัปเดตต้องลงนามด้วยกุญแจส่วนตัวที่คู่กับกุญแจสาธารณะใน `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`)

## ตั้งค่าครั้งเดียว (เจ้าของทำเอง)

1. เปิด GitHub ของรีโปนี้ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `TAURI_SIGNING_PRIVATE_KEY` และ Secret: ข้อความทั้งหมดในไฟล์กุญแจส่วนตัวที่ได้รับ (บรรทัดเดียวยาว ๆ)
3. กุญแจนี้ไม่มีรหัสผ่าน จึงไม่ต้องเพิ่ม `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
4. เก็บสำเนากุญแจไว้ในที่ปลอดภัย (เช่น password manager) **ถ้ากุญแจหาย แอปที่ติดตั้งไว้จะรับอัปเดตไม่ได้อีก** ต้องติดตั้งเวอร์ชันใหม่ด้วยมือ
5. ห้าม commit กุญแจส่วนตัวลงรีโป (โฟลเดอร์ `.secrets/` อยู่ใน `.gitignore`)

## ออกเวอร์ชันใหม่ (agent ทำได้)

1. เพิ่มเลขเวอร์ชันให้ตรงกันใน 3 ไฟล์: `package.json`, `Cargo.toml` (`[workspace.package]`) และ `src-tauri/tauri.conf.json` แล้วรัน `npm install` เพื่อให้ `package-lock.json` ตรงกัน
   เลขต้องมากกว่าเวอร์ชันล่าสุดที่ปล่อยไปแล้ว ไม่งั้นแอปจะไม่เห็นว่าเป็นของใหม่
2. ย้ายหัวข้อ "Unreleased" ใน `CHANGELOG.md` ไปเป็นหัวข้อเวอร์ชันนั้น
3. เขียนสิ่งที่เปลี่ยนเป็นภาษาไทยสั้น ๆ ใน `.github/release-notes.md` (แอปแสดงข้อความนี้ก่อนอัปเดต) และอัปเดต `docs/HANDOFF.md`
   workflow ใช้ `.github/scripts/release-notes.mjs` เขียน UTF-8 พร้อม delimiter แยกบรรทัด แม้ไฟล์ไม่มี newline ท้ายสุด ตรวจตัวช่วยนี้ด้วย `node --test .github/scripts/release-notes.test.mjs` (CI เว็บรันด้วย)
4. รันการตรวจตาม `AGENTS.md` ให้ผ่าน แล้ว commit และ push
5. workflow **Release** จะรันเองเมื่อ push แก้ `package.json` หรือ `.github/release-notes.md` และรอ **CI ของ commit เดียวกัน** เขียวครบ 3 job ก่อน build ลงนามและเผยแพร่ ถ้า CI ล้ม/ถูกยกเลิก หรือหา CI ไม่พบจะไม่เผยแพร่
   และจะสร้าง release ก็ต่อเมื่อเวอร์ชันใน `package.json` ยังไม่เคยปล่อย ถ้าเคยปล่อยแล้วจะข้ามไปเฉย ๆ
   (agent ใน cloud push แท็กไม่ได้ จึงใช้วิธีนี้แทนแท็ก ส่วนปุ่ม Run workflow ในแท็บ Actions ใช้ได้เมื่อ `release.yml` อยู่ใน branch หลักแล้ว)
6. workflow สร้าง `vX.Y.Z` และ GitHub Release ที่มีตัวติดตั้ง `.exe`, ไฟล์ลายเซ็น `.sig` และ `latest.json`
   แอปที่ติดตั้งไว้จะเห็นเวอร์ชันใหม่ตอนเปิดครั้งถัดไป หรือเมื่อกด **ตั้งค่า → ตรวจหาอัปเดต**
7. ก่อนแจ้งว่าอัปเดตในแอปพร้อมแล้ว ให้ตรวจ CI และ Release สำเร็จ ตรวจ URL `releases/latest/download/latest.json` ว่าส่งเลขเวอร์ชันใหม่และ Windows URL ถูกต้อง มี `.exe`/`.sig` ครบ ลายเซ็นใน manifest ตรงกับ `.sig` และตรวจลายเซ็นตัวติดตั้งกับ public key ของแอปเดิมได้ แล้วบันทึกผลใน `docs/HANDOFF.md`

## หมายเหตุ

- ตัวติดตั้งจาก CI ปกติ (artifact `mimi-kopi-windows-installer`) ไม่ได้ลงนามสำหรับ updater ใช้ทดสอบได้ แต่ไม่ใช่ช่องทางอัปเดต
- ยังไม่มี code signing certificate ของ Windows ตอนติดตั้งครั้งแรก SmartScreen อาจเตือน ให้กด "More info" → "Run anyway"
