// Names the chord formed by held keys, for the free piano page. Only common
// shapes a beginner meets; anything else gets no name rather than a guess.
import { noteName } from "./notes";

const SHAPES: { intervals: number[]; suffix: string }[] = [
  { intervals: [0, 4, 7], suffix: "" },
  { intervals: [0, 3, 7], suffix: "m" },
  { intervals: [0, 3, 6], suffix: "dim" },
  { intervals: [0, 4, 8], suffix: "aug" },
  { intervals: [0, 2, 7], suffix: "sus2" },
  { intervals: [0, 5, 7], suffix: "sus4" },
  { intervals: [0, 4, 7, 10], suffix: "7" },
  { intervals: [0, 4, 7, 11], suffix: "maj7" },
  { intervals: [0, 3, 7, 10], suffix: "m7" },
  { intervals: [0, 3, 6, 10], suffix: "m7♭5" },
];

const pitchClassName = (pc: number) => noteName(60 + pc).replace(/-?\d+$/, "");

/** e.g. "C", "Am", "G7", or "C/E" when the lowest key is not the root. */
export function chordName(pitches: readonly number[]): string | null {
  if (pitches.length < 3) return null;
  const classes = [...new Set(pitches.map((p) => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
  const bass = ((Math.min(...pitches) % 12) + 12) % 12;
  for (const root of classes) {
    const intervals = classes.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
    const shape = SHAPES.find(
      (s) => s.intervals.length === intervals.length && s.intervals.every((v, i) => v === intervals[i]),
    );
    if (shape) {
      const name = pitchClassName(root) + shape.suffix;
      return bass === root ? name : `${name}/${pitchClassName(bass)}`;
    }
  }
  return null;
}
