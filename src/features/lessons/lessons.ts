import type { Locale } from "../../i18n/messages";

export type Hand = "right" | "left" | "both";

/**
 * A wait-mode lesson: each step lists the pitches that must be held together
 * (one pitch for a melody note, several for a chord). The version changes
 * whenever the steps change, so results from different versions are never
 * compared (spec §9.2). All content here is original practice material.
 */
export interface Lesson {
  id: string;
  version: number;
  hand: Hand;
  title: Record<Locale, string>;
  goal: Record<Locale, string>;
  steps: number[][];
}

const notes = (...pitches: number[]) => pitches.map((p) => [p]);

const C = [60, 64, 67];
const G = [59, 62, 67];
const Am = [57, 60, 64];
const F = [57, 60, 65];

export const lessons: Lesson[] = [
  {
    id: "landmark-c",
    version: 1,
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
    id: "find-c-to-g",
    version: 1,
    hand: "right",
    title: { th: "หาโน้ต C ถึง G", en: "Find C to G", ja: "C から G を探す" },
    goal: {
      th: "มือขวาวางนิ้ว 1 ที่ C กลาง แล้วกดตามโน้ตที่ไฮไลต์ ขึ้นแล้วลง",
      en: "Right thumb on middle C. Play the highlighted notes up and back down.",
      ja: "右手の親指を中央の C に置き、光る音を上がって下がります。",
    },
    steps: notes(60, 62, 64, 65, 67, 65, 64, 62, 60),
  },
  {
    id: "five-finger-right",
    version: 1,
    hand: "right",
    title: { th: "5 นิ้วมือขวา", en: "Right-hand five-finger pattern", ja: "右手 5 指パターン" },
    goal: {
      th: "นิ้ว 1–5 อยู่ที่ C D E F G ตลอด ไม่ต้องย้ายมือ เล่นช้า ๆ ให้ถูกก่อน",
      en: "Fingers 1–5 stay on C D E F G; the hand never moves. Slow and correct first.",
      ja: "指 1〜5 を C D E F G に置いたまま弾きます。まずはゆっくり正確に。",
    },
    steps: notes(60, 62, 64, 62, 60, 64, 65, 67, 65, 64, 62, 60),
  },
  {
    id: "five-finger-left",
    version: 1,
    hand: "left",
    title: { th: "5 นิ้วมือซ้าย", en: "Left-hand five-finger pattern", ja: "左手 5 指パターン" },
    goal: {
      th: "มือซ้ายนิ้ว 5 ที่ C3 นิ้ว 1 ที่ G3 กดขึ้นแล้วลง",
      en: "Left little finger on C3, thumb on G3. Play up and back down.",
      ja: "左手の小指を C3、親指を G3 に置き、上がって下がります。",
    },
    steps: notes(48, 50, 52, 53, 55, 53, 52, 50, 48),
  },
  {
    id: "chords-c-g-am-f",
    version: 1,
    hand: "right",
    title: { th: "คอร์ด C – G – Am – F", en: "Chords C – G – Am – F", ja: "コード C – G – Am – F" },
    goal: {
      th: "กดโน้ตของคอร์ดให้ครบพร้อมกัน จะกดทีละตัวก็ได้แต่ต้องค้างไว้จนครบ ตำแหน่งเหล่านี้ขยับนิ้วน้อยที่สุด",
      en: "Hold all notes of each chord together; pressing them one by one is fine if you keep them down. These shapes need the least hand movement.",
      ja: "コードの音を全部同時に押さえます。1 音ずつでも、押さえたままなら OK。手の移動が最小の形です。",
    },
    steps: [C, G, Am, F, C, G, Am, F],
  },
];

/** Range shown on the lesson keyboard: C3 to C6. */
export const LESSON_LOW = 48;
export const LESSON_HIGH = 84;
