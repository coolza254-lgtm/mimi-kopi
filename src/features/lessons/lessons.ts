import type { Locale } from "../../i18n/messages";

export type Hand = "right" | "left" | "both";

export type UnitId = "keyboard" | "right" | "left" | "chords" | "song";

/**
 * A wait-mode lesson: each step lists the pitches that must be held together
 * (one pitch for a melody note, several for a chord). The version changes
 * whenever the steps change, so results from different versions are never
 * compared (spec §9.2). All content here is original practice material.
 */
export interface Lesson {
  id: string;
  version: number;
  unit: UnitId;
  hand: Hand;
  title: Record<Locale, string>;
  goal: Record<Locale, string>;
  steps: number[][];
  /** Finger numbers (1 = thumb … 5 = little finger), matching `steps`. */
  fingers?: number[][];
}

export interface Unit {
  id: UnitId;
  title: Record<Locale, string>;
  blurb: Record<Locale, string>;
}

export const units: Unit[] = [
  {
    id: "keyboard",
    title: { th: "รู้จักคีย์บอร์ด", en: "Know the keyboard", ja: "鍵盤を知る" },
    blurb: {
      th: "ใช้คีย์ดำเป็นจุดสังเกตเพื่อหาโน้ตให้เจอเร็ว",
      en: "Use the black keys as landmarks to find notes fast.",
      ja: "黒鍵を目印にして音をすばやく見つけます。",
    },
  },
  {
    id: "right",
    title: { th: "มือขวา", en: "Right hand", ja: "右手" },
    blurb: {
      th: "วางมือ 5 นิ้ว เล่นทำนองสั้น ๆ แล้วต่อด้วยบันไดเสียง C",
      en: "Five-finger position, short tunes, then the C scale.",
      ja: "5 指のポジション、短いメロディー、そして C の音階。",
    },
  },
  {
    id: "left",
    title: { th: "มือซ้าย", en: "Left hand", ja: "左手" },
    blurb: {
      th: "มือซ้ายเริ่มจากนิ้ว 5 ฝึกให้คล่องเท่ามือขวาและเล่นเบส",
      en: "Start from the little finger, catch up with the right hand and play bass.",
      ja: "小指から始め、右手に追いつき、ベースを弾きます。",
    },
  },
  {
    id: "chords",
    title: { th: "คอร์ดแรก", en: "First chords", ja: "はじめてのコード" },
    blurb: {
      th: "กดหลายโน้ตพร้อมกัน แล้วเล่นสองมือด้วยกัน",
      en: "Several notes at once, then both hands together.",
      ja: "複数の音を同時に押さえ、両手で弾きます。",
    },
  },
];

const notes = (...pitches: number[]) => pitches.map((p) => [p]);
const one = (...fingers: number[]) => fingers.map((f) => [f]);

const C = [60, 64, 67];
const G = [59, 62, 67];
const Am = [57, 60, 64];
const F = [57, 60, 65];

export const lessons: Lesson[] = [
  {
    id: "landmark-c",
    version: 1,
    unit: "keyboard",
    hand: "both",
    title: { th: "จุดสังเกต: โน้ต C", en: "Landmark: the C keys", ja: "目印：C の鍵盤" },
    goal: {
      th: "หาโน้ต C สามตำแหน่ง: C3, C กลาง (C4) และ C5 C อยู่ซ้ายของกลุ่มคีย์ดำ 2 อัน",
      en: "Find three Cs: C3, middle C (C4) and C5. C sits just left of each pair of black keys.",
      ja: "3 つの C（C3・中央の C4・C5）を探します。C は黒鍵 2 本の組の左にあります。",
    },
    steps: notes(60, 48, 60, 72, 60),
  },
  {
    id: "find-d-f-b",
    version: 1,
    unit: "keyboard",
    hand: "both",
    title: { th: "คีย์ดำช่วยหาโน้ต D F B", en: "Black keys point to D, F and B", ja: "黒鍵で D・F・B を探す" },
    goal: {
      th: "D อยู่ตรงกลางคีย์ดำ 2 อัน F อยู่ซ้ายของคีย์ดำ 3 อัน และ B อยู่ขวาของคีย์ดำ 3 อัน",
      en: "D sits between the two black keys, F left of the three, B right of the three.",
      ja: "D は黒鍵 2 本の間、F は 3 本の左、B は 3 本の右にあります。",
    },
    steps: notes(62, 65, 71, 74, 77, 59, 50, 53),
  },
  {
    id: "find-c-to-g",
    version: 1,
    unit: "keyboard",
    hand: "right",
    title: { th: "หาโน้ต C ถึง G", en: "Find C to G", ja: "C から G を探す" },
    goal: {
      th: "มือขวาวางนิ้ว 1 ที่ C กลาง แล้วกดตามโน้ตที่ไฮไลต์ ขึ้นแล้วลง",
      en: "Right thumb on middle C. Play the highlighted notes up and back down.",
      ja: "右手の親指を中央の C に置き、光る音を上がって下がります。",
    },
    steps: notes(60, 62, 64, 65, 67, 65, 64, 62, 60),
    fingers: one(1, 2, 3, 4, 5, 4, 3, 2, 1),
  },
  {
    id: "five-finger-right",
    version: 1,
    unit: "right",
    hand: "right",
    title: { th: "5 นิ้วมือขวา", en: "Right-hand five-finger pattern", ja: "右手 5 指パターン" },
    goal: {
      th: "นิ้ว 1–5 อยู่ที่ C D E F G ตลอด ไม่ต้องย้ายมือ เล่นช้า ๆ ให้ถูกก่อน",
      en: "Fingers 1–5 stay on C D E F G; the hand never moves. Slow and correct first.",
      ja: "指 1〜5 を C D E F G に置いたまま弾きます。まずはゆっくり正確に。",
    },
    steps: notes(60, 62, 64, 62, 60, 64, 65, 67, 65, 64, 62, 60),
    fingers: one(1, 2, 3, 2, 1, 3, 4, 5, 4, 3, 2, 1),
  },
  {
    id: "melody-right",
    version: 1,
    unit: "right",
    hand: "right",
    title: { th: "เดินและกระโดด มือขวา", en: "Steps and skips, right hand", ja: "順次進行と跳躍（右手）" },
    goal: {
      th: "สลับเดินทีละขั้นกับกระโดดข้ามหนึ่งโน้ต มือยังอยู่ที่ C ถึง G",
      en: "Mix moving by step with skipping one note. The hand stays on C to G.",
      ja: "隣の音への移動と 1 音飛ばしを混ぜます。手は C〜G のまま。",
    },
    steps: notes(60, 64, 62, 65, 64, 67, 65, 62, 64, 60),
    fingers: one(1, 3, 2, 4, 3, 5, 4, 2, 3, 1),
  },
  {
    id: "scale-c-right",
    version: 1,
    unit: "right",
    hand: "right",
    title: { th: "บันไดเสียง C มือขวา", en: "C major scale, right hand", ja: "ハ長調の音階（右手）" },
    goal: {
      th: "ขาขึ้นสอดนิ้วโป้งใต้มือไปที่ F ขาลงข้ามนิ้ว 3 ไปที่ E ให้มือเลื่อนไปอย่างนุ่มนวล",
      en: "Going up, pass the thumb under to F; coming down, cross finger 3 over to E. Keep the hand smooth.",
      ja: "上りは親指を F へくぐらせ、下りは 3 の指を E へ越えます。手をなめらかに。",
    },
    steps: notes(60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60),
    fingers: one(1, 2, 3, 1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 2, 1),
  },
  {
    id: "five-finger-left",
    version: 1,
    unit: "left",
    hand: "left",
    title: { th: "5 นิ้วมือซ้าย", en: "Left-hand five-finger pattern", ja: "左手 5 指パターン" },
    goal: {
      th: "มือซ้ายนิ้ว 5 ที่ C3 นิ้ว 1 ที่ G3 กดขึ้นแล้วลง",
      en: "Left little finger on C3, thumb on G3. Play up and back down.",
      ja: "左手の小指を C3、親指を G3 に置き、上がって下がります。",
    },
    steps: notes(48, 50, 52, 53, 55, 53, 52, 50, 48),
    fingers: one(5, 4, 3, 2, 1, 2, 3, 4, 5),
  },
  {
    id: "melody-left",
    version: 1,
    unit: "left",
    hand: "left",
    title: { th: "เดินและกระโดด มือซ้าย", en: "Steps and skips, left hand", ja: "順次進行と跳躍（左手）" },
    goal: {
      th: "เริ่มจากนิ้วโป้งที่ G3 แล้วเดินลงสลับกระโดด นิ้วโป้งของมือซ้ายคือนิ้ว 1",
      en: "Start with the thumb on G3 and move down by steps and skips. The left thumb is finger 1.",
      ja: "親指を G3 に置き、順次と跳躍で下がります。左手の親指が 1 の指です。",
    },
    steps: notes(55, 52, 53, 50, 52, 48, 50, 53, 52, 55),
    fingers: one(1, 3, 2, 4, 3, 5, 4, 2, 3, 1),
  },
  {
    id: "bass-fifths-left",
    version: 1,
    unit: "left",
    hand: "left",
    title: { th: "เบสคู่ 5 มือซ้าย", en: "Left-hand fifths", ja: "左手の 5 度" },
    goal: {
      th: "กดนิ้ว 5 กับนิ้ว 1 พร้อมกัน (ห่างกัน 5 โน้ต) แล้วย้ายทั้งมือไป C F G ใช้เป็นเบสของเพลงได้เกือบทุกเพลง",
      en: "Press fingers 5 and 1 together, five notes apart, then move the whole hand between C, F and G. A bass that fits most songs.",
      ja: "5 の指と 1 の指を同時に（5 度）押さえ、手ごと C・F・G へ移動します。多くの曲に合うベースです。",
    },
    steps: [
      [48, 55],
      [53, 60],
      [55, 62],
      [48, 55],
      [53, 60],
      [55, 62],
      [48, 55],
    ],
    fingers: [
      [5, 1],
      [5, 1],
      [5, 1],
      [5, 1],
      [5, 1],
      [5, 1],
      [5, 1],
    ],
  },
  {
    id: "chords-c-g",
    version: 1,
    unit: "chords",
    hand: "right",
    title: { th: "คอร์ดแรก: C กับ G", en: "First chords: C and G", ja: "はじめてのコード：C と G" },
    goal: {
      th: "คอร์ด C ใช้นิ้ว 1 3 5 ส่วนคอร์ด G เลื่อนนิ้ว 1 ลงไปที่ B ใช้นิ้ว 2 กด D และนิ้ว 5 อยู่ที่ G เหมือนเดิม",
      en: "C uses fingers 1 3 5. For G, the thumb drops to B and finger 2 takes D; finger 5 stays on G.",
      ja: "C は 1・3・5 の指。G は親指を B に下げ、2 の指で D、5 の指は G のまま。",
    },
    steps: [C, G, C, G, C],
    fingers: [
      [1, 3, 5],
      [1, 2, 5],
      [1, 3, 5],
      [1, 2, 5],
      [1, 3, 5],
    ],
  },
  {
    id: "chords-c-g-am-f",
    version: 1,
    unit: "chords",
    hand: "right",
    title: { th: "คอร์ด C – G – Am – F", en: "Chords C – G – Am – F", ja: "コード C – G – Am – F" },
    goal: {
      th: "กดโน้ตของคอร์ดให้ครบพร้อมกัน จะกดทีละตัวก็ได้แต่ต้องค้างไว้จนครบ ตำแหน่งเหล่านี้ขยับนิ้วน้อยที่สุด",
      en: "Hold all notes of each chord together; pressing them one by one is fine if you keep them down. These shapes need the least hand movement.",
      ja: "コードの音を全部同時に押さえます。1 音ずつでも、押さえたままなら OK。手の移動が最小の形です。",
    },
    steps: [C, G, Am, F, C, G, Am, F],
    fingers: [
      [1, 3, 5],
      [1, 2, 5],
      [1, 2, 4],
      [1, 2, 5],
      [1, 3, 5],
      [1, 2, 5],
      [1, 2, 4],
      [1, 2, 5],
    ],
  },
  {
    id: "hands-together",
    version: 1,
    unit: "chords",
    hand: "both",
    title: { th: "สองมือ: เบส + คอร์ด", en: "Both hands: bass + chord", ja: "両手：ベース＋コード" },
    goal: {
      th: "มือซ้ายกดโน้ตเบสตัวเดียว มือขวากดคอร์ด กดให้ครบทั้งสองมือแล้วค้างไว้ เป็นรูปแบบพื้นฐานของการเล่นเพลง",
      en: "Left hand plays one bass note, right hand the chord. Hold both together: the basic shape of accompanying a song.",
      ja: "左手はベース 1 音、右手はコード。両手を同時に押さえます。伴奏の基本形です。",
    },
    steps: [
      [48, ...C],
      [43, ...G],
      [45, ...Am],
      [41, ...F],
      [48, ...C],
    ],
    fingers: [
      [5, 1, 3, 5],
      [5, 1, 2, 5],
      [5, 1, 2, 4],
      [5, 1, 2, 5],
      [5, 1, 3, 5],
    ],
  },
];

/** Default range of the lesson keyboard: C3 to C6. */
export const LESSON_LOW = 48;
export const LESSON_HIGH = 84;

/** Keyboard range for a lesson: C3–C6, widened to whole octaves if a step goes outside. */
export function lessonRange(lesson: Lesson): { low: number; high: number } {
  const all = lesson.steps.flat();
  const low = Math.min(LESSON_LOW, Math.floor(Math.min(...all) / 12) * 12);
  const high = Math.max(LESSON_HIGH, Math.ceil(Math.max(...all) / 12) * 12);
  return { low, high };
}
