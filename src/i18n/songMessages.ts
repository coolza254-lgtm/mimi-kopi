const th = {
  songsHands: "มือที่เล่น", songsLeft: "มือซ้าย", songsRight: "มือขวา", songsBoth: "สองมือ",
  navSongs: "เล่นเพลง", songsTitle: "เล่นเพลง", songsIntro: "ทำนองคุ้นหู สำหรับช่วงพักจากการฝึก",
  songsSimple: "ฉบับง่าย · เลือกเล่นทีละมือได้", songsOpen: "เล่นโน้ตตก", songsRights: "ทำนองสาธารณสมบัติ · โน้ตฝึกทำขึ้นใหม่", songsSource: "ที่มาทำนอง",
  songsStart: "เริ่มเล่น", songsPause: "พัก", songsResume: "เล่นต่อ", songsRestart: "เริ่มใหม่", songsBack: "เลือกเพลง", songsSpeed: "ความเร็ว", songsGuide: "เสียงตัวอย่าง", songsLoop: "วนเพลง", songsFinished: "จบเพลงแล้ว", songsReady: "พร้อมเมื่อไหร่ก็เริ่มได้", songsNoScore: "เล่นตามแถบเมื่อถึงคีย์ · ไม่มีคะแนน", songsBrowser: "จำลองในเบราว์เซอร์ · ไม่มีเสียงเปียโน", songsError: "การเชื่อมต่อหยุดลง กรุณาตรวจเสียงและ MIDI ก่อนเล่นต่อ", songsRoll: "โน้ตตก", songsProgress: "ตำแหน่งในเพลง", songsOn: "เปิด", songsOff: "ปิด",
};
type SongMessages = { [K in keyof typeof th]: string };
const en: SongMessages = {
  songsHands: "Hands", songsLeft: "Left hand", songsRight: "Right hand", songsBoth: "Both hands",
  navSongs: "Play songs", songsTitle: "Play songs", songsIntro: "Familiar melodies for a break from practice",
  songsSimple: "Easy setting · play one hand at a time", songsOpen: "Play falling notes", songsRights: "Public-domain melodies · newly made practice notes", songsSource: "Melody source",
  songsStart: "Start playing", songsPause: "Pause", songsResume: "Continue", songsRestart: "Restart", songsBack: "Choose a song", songsSpeed: "Speed", songsGuide: "Guide audio", songsLoop: "Loop song", songsFinished: "Song finished", songsReady: "Start when you are ready", songsNoScore: "Play as each bar reaches its key · no scoring", songsBrowser: "Browser simulation · no piano audio", songsError: "Connection stopped. Check Sound & MIDI before continuing.", songsRoll: "Falling notes", songsProgress: "Song position", songsOn: "On", songsOff: "Off",
};
const ja: SongMessages = {
  songsHands: "演奏する手", songsLeft: "左手", songsRight: "右手", songsBoth: "両手",
  navSongs: "曲を弾く", songsTitle: "曲を弾く", songsIntro: "練習の合間に、なじみのあるメロディーを",
  songsSimple: "やさしい版 · 片手ずつ練習可能", songsOpen: "落下ノートで弾く", songsRights: "著作権保護期間が終了した旋律 · 練習用ノートは新規作成", songsSource: "旋律の出典",
  songsStart: "演奏を始める", songsPause: "休憩", songsResume: "続ける", songsRestart: "最初から", songsBack: "曲を選ぶ", songsSpeed: "速さ", songsGuide: "お手本の音", songsLoop: "繰り返す", songsFinished: "曲が終わりました", songsReady: "準備ができたら始めましょう", songsNoScore: "バーが鍵盤に届いたら弾く · 採点なし", songsBrowser: "ブラウザーの模擬演奏 · ピアノの音は出ません", songsError: "接続が停止しました。音とMIDIを確認してください。", songsRoll: "落下ノート", songsProgress: "曲の位置", songsOn: "オン", songsOff: "オフ",
};
export const songMessages = { th, en, ja };
