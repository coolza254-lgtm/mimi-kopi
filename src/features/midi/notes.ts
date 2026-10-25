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
