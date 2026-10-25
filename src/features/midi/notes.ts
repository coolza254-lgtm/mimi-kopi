const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const BLACK = new Set([1, 3, 6, 8, 10]);

/** Lowest and highest keys of an 88-key piano (A0, C8). */
export const PIANO_LOW = 21;
export const PIANO_HIGH = 108;

/**
 * Scientific pitch notation with middle C (MIDI 60) = C4. Some keyboards and
 * DAWs call the same key C3, so the UI always shows this convention (spec §12.5).
 */
export function noteName(pitch: number): string {
  return `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function isBlackKey(pitch: number): boolean {
  return BLACK.has(pitch % 12);
}

const SOLFEGE: Record<"th" | "ja", readonly string[]> = {
  th: ["โด", "เร", "มี", "ฟา", "ซอล", "ลา", "ที"],
  ja: ["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ"],
};
/** Index of the natural note at or below each pitch class (C = 0 … B = 6). */
const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] as const;

/** Do-re-mi name for Thai and Japanese (with ♯ for black keys); letter name otherwise. */
export function solfege(pitch: number, locale: "th" | "en" | "ja"): string {
  if (locale === "en") return NAMES[pitch % 12];
  return SOLFEGE[locale][LETTER[pitch % 12]] + (isBlackKey(pitch) ? "♯" : "");
}

/**
 * Position on the staff counted in lines and spaces: each white key is one
 * step, C4 = 28. Black keys sit on the step of the note below, drawn with ♯.
 */
export function staffStep(pitch: number): number {
  return (Math.floor(pitch / 12) - 1) * 7 + LETTER[pitch % 12];
}
