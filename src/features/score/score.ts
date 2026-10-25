// Songs the player writes down themselves in the note editor ("แกะโน้ต"),
// for private practice. Times are counted in sixteenth notes.

export type ScoreHand = "R" | "L";

export interface ScoreNote {
  id: string;
  /** MIDI pitch. */
  pitch: number;
  /** Start, in sixteenths from the beginning of the song. */
  start: number;
  /** Length in sixteenths: 16 whole, 8 half, 4 quarter, 2 eighth, 1 sixteenth; ×1.5 when dotted. */
  dur: number;
  hand: ScoreHand;
}

export interface Song {
  id: string;
  title: string;
  /** Key signature as a count of sharps (positive) or flats (negative), −4…4. */
  fifths: number;
  /** Beats per measure, in quarter notes. */
  beats: number;
  /** Quarter notes per minute. */
  tempo: number;
  measures: number;
  notes: ScoreNote[];
  updatedAt: string;
}

export const DURATIONS = [16, 8, 4, 2, 1] as const;

export const KEYS: { fifths: number; name: string }[] = [
  { fifths: 0, name: "C" },
  { fifths: 1, name: "G" },
  { fifths: 2, name: "D" },
  { fifths: 3, name: "A" },
  { fifths: 4, name: "E" },
  { fifths: -1, name: "F" },
  { fifths: -2, name: "B♭" },
  { fifths: -3, name: "E♭" },
  { fifths: -4, name: "A♭" },
];

/** Letters as staff steps within an octave: C = 0 … B = 6. */
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11] as const;
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6] as const; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3] as const; // B E A D G C F

export const unitsPerMeasure = (song: Pick<Song, "beats">) => song.beats * 4;

/** −1, 0 or +1: what the key signature does to a letter (0 = C … 6 = B). */
export function keyAlter(letter: number, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(letter as never)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(letter as never)) return -1;
  return 0;
}

/** Letters the key signature alters, in the order they are written. */
export function keySignatureLetters(fifths: number): number[] {
  return fifths >= 0 ? SHARP_ORDER.slice(0, fifths) : FLAT_ORDER.slice(0, -fifths);
}

export interface Spelled {
  /** Staff step: one per letter, C4 = 28. */
  step: number;
  letter: number;
  alter: number;
  /** Accidental to print, or null when the key signature already says it. */
  accidental: "♯" | "♭" | "♮" | null;
}

/** How a pitch is written in a key: sharps in sharp keys, flats in flat keys. */
export function spell(pitch: number, fifths: number): Spelled {
  const pc = ((pitch % 12) + 12) % 12;
  let letter = NATURAL_PC.indexOf(pc as never);
  let alter = 0;
  if (letter < 0) {
    if (fifths < 0) {
      letter = NATURAL_PC.indexOf(((pc + 1) % 12) as never);
      alter = -1;
    } else {
      letter = NATURAL_PC.indexOf((pc - 1) as never);
      alter = 1;
    }
  }
  const natural = pitch - alter;
  const step = (Math.floor(natural / 12) - 1) * 7 + letter;
  const expected = keyAlter(letter, fifths);
  const accidental = alter === expected ? null : alter === 1 ? "♯" : alter === -1 ? "♭" : "♮";
  return { step, letter, alter, accidental };
}

/** The pitch for a staff step in a key, optionally overriding the alteration. */
export function pitchAt(step: number, fifths: number, alter?: number): number {
  const letter = ((step % 7) + 7) % 7;
  const octave = Math.floor(step / 7);
  return (octave + 1) * 12 + NATURAL_PC[letter] + (alter ?? keyAlter(letter, fifths));
}

/** Snaps a start to the grid a note of this length sits on, inside one measure. */
export function snapStart(raw: number, dur: number, units: number): number {
  const grid = Math.min(4, Math.max(1, dur % 3 === 0 ? dur / 3 : dur));
  const measure = Math.floor(Math.max(0, raw) / units);
  const within = Math.floor((Math.max(0, raw) - measure * units) / grid) * grid;
  return measure * units + Math.min(within, Math.max(0, units - dur));
}

export const isDotted = (dur: number) => dur % 3 === 0;
export const baseDuration = (dur: number) => (isDotted(dur) ? (dur * 2) / 3 : dur);

/** Wait-mode steps: notes starting together become one chord step. */
export function toSteps(song: Song, hands: "R" | "L" | "both", fromMeasure = 0, toMeasure = song.measures - 1): number[][] {
  const units = unitsPerMeasure(song);
  const lo = fromMeasure * units;
  const hi = (toMeasure + 1) * units;
  const byStart = new Map<number, Set<number>>();
  for (const n of song.notes) {
    if (n.start < lo || n.start >= hi) continue;
    if (hands !== "both" && n.hand !== hands) continue;
    const set = byStart.get(n.start) ?? new Set<number>();
    set.add(n.pitch);
    byStart.set(n.start, set);
  }
  return [...byStart.entries()].sort(([a], [b]) => a - b).map(([, set]) => [...set].sort((a, b) => a - b));
}

/** Measures that hold at least one note, so a song can be trimmed or extended. */
export function lastUsedMeasure(song: Song): number {
  const units = unitsPerMeasure(song);
  return song.notes.reduce((m, n) => Math.max(m, Math.floor((n.start + n.dur - 1) / units)), -1);
}

export function newSong(id: string, title: string, now: Date): Song {
  return { id, title, fifths: 0, beats: 4, tempo: 80, measures: 8, notes: [], updatedAt: now.toISOString() };
}

const KEY = "mimi-kopi.songs";

function readSong(value: unknown): Song | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const int = (x: unknown, lo: number, hi: number, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback;
  if (typeof v.id !== "string" || !Array.isArray(v.notes)) return null;
  const beats = int(v.beats, 2, 6, 4);
  const notes: ScoreNote[] = [];
  for (const raw of v.notes as unknown[]) {
    const n = (raw ?? {}) as Record<string, unknown>;
    if (typeof n.id !== "string" || (n.hand !== "R" && n.hand !== "L")) continue;
    notes.push({
      id: n.id,
      pitch: int(n.pitch, 21, 108, 60),
      start: int(n.start, 0, 100_000, 0),
      dur: int(n.dur, 1, 16, 4),
      hand: n.hand,
    });
  }
  return {
    id: v.id,
    title: typeof v.title === "string" ? v.title : "",
    fifths: int(v.fifths, -4, 4, 0),
    beats,
    tempo: int(v.tempo, 30, 240, 80),
    measures: int(v.measures, 1, 400, 8),
    notes,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : "",
  };
}

export function loadSongs(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Song[] {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(readSong).filter((s): s is Song => s !== null) : [];
  } catch {
    return [];
  }
}

export function saveSongs(songs: Song[], storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, JSON.stringify(songs));
  } catch {
    // Storage can be unavailable or full; the editor keeps working in memory.
  }
}
