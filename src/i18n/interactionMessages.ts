const th = {
  studioBackup: "การสำรองเพลง",
  answerRetry: "เข้าใจแล้ว ลองใหม่",
  answerWrongTitle: "ลองดูตรงนี้อีกนิด",
  answerPlayed: "คุณกด {actual} · ต้องการ {expected}",
  answerSequence: "โน้ตตัวที่ {index}: คุณกด {actual} · ต้องการ {expected}",
  answerRelease: "ปล่อยคีย์เดิมก่อน แล้วเล่นทีละโน้ต",
  answerChoice: "คุณตอบ {actual} · คำตอบคือ {expected}",
  answerAuto: "ถูกต้อง · กำลังไปต่อ",
  answerReleaseNext: "ถูกต้อง · ปล่อยคีย์เพื่อไปต่อ",
  answerAutoHint: "ตอบถูกแล้วไปต่ออัตโนมัติ",
};
type Messages = { [K in keyof typeof th]: string };
const en: Messages = {
  studioBackup: "Song backups",
  answerRetry: "Got it, try again",
  answerWrongTitle: "Take another look",
  answerPlayed: "You played {actual} · Expected {expected}",
  answerSequence: "Note {index}: you played {actual} · Expected {expected}",
  answerRelease: "Release the previous key, then play one note at a time",
  answerChoice: "You chose {actual} · The answer is {expected}",
  answerAuto: "Correct · Moving on",
  answerReleaseNext: "Correct · Release keys to continue",
  answerAutoHint: "Correct answers move on automatically",
};
const ja: Messages = {
  studioBackup: "楽曲のバックアップ",
  answerRetry: "わかった、もう一度",
  answerWrongTitle: "ここを確認しましょう",
  answerPlayed: "弾いた音 {actual} · 正解 {expected}",
  answerSequence: "{index}音目：弾いた音 {actual} · 正解 {expected}",
  answerRelease: "前の鍵盤を離してから、1音ずつ弾きます",
  answerChoice: "選んだ答え {actual} · 正解 {expected}",
  answerAuto: "正解・次へ進みます",
  answerReleaseNext: "正解・鍵盤を離すと進みます",
  answerAutoHint: "正解すると自動で次へ進みます",
};
export const interactionMessages = { th, en, ja };
