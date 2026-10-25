import { DURATIONS, type ScoreNote, type Song } from "./score";

export const MAX_SONG_FILE_BYTES = 5 * 1024 * 1024;
const MAX_NOTES = 20_000;
const lengths = DURATIONS.flatMap((d) => [d, d * 1.5]);

const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Reject malformed files as a whole rather than silently changing the music. */
export function parseSongFile(text: string, id: string, now: Date): Song {
  if (new TextEncoder().encode(text).length > MAX_SONG_FILE_BYTES) throw new Error("Song file too large");
  const file: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!object(file) || file.format !== "mimi-kopi-song" || file.version !== 1 || !object(file.song)) {
    throw new Error("Unsupported song file");
  }
  const s = file.song;
  if (
    typeof s.title !== "string" || s.title.length > 200 ||
    !integer(s.fifths, -4, 4) || !integer(s.beats, 2, 6) ||
    !integer(s.tempo, 30, 240) || !integer(s.measures, 1, 400) ||
    !Array.isArray(s.notes) || s.notes.length > MAX_NOTES
  ) throw new Error("Invalid song settings");
  const end = s.measures * s.beats * 4;
  const notes = s.notes.map((n: unknown, i: number): ScoreNote => {
    if (
      !object(n) || !integer(n.pitch, 21, 108) ||
      typeof n.start !== "number" || !Number.isFinite(n.start) || n.start < 0 || !Number.isInteger(n.start * 2) ||
      typeof n.dur !== "number" || !lengths.includes(n.dur) || n.start + n.dur > end ||
      (n.hand !== "R" && n.hand !== "L")
    ) throw new Error("Invalid song note");
    return { id: `${id}-${i}`, pitch: n.pitch, start: n.start, dur: n.dur, hand: n.hand };
  });
  return {
    id, title: s.title, fifths: s.fifths, beats: s.beats, tempo: s.tempo,
    measures: s.measures, notes, updatedAt: now.toISOString(),
  };
}

export function serializeSongFile(song: Song): string {
  return JSON.stringify({ format: "mimi-kopi-song", version: 1, song }, null, 2) + "\n";
}

/** Safe default filename on Windows; the user can change it in the save dialog. */
export function songFilename(title: string): string {
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").slice(0, 100).replace(/[. ]+$/, "");
  const safe = !name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? "song" : name;
  return `${safe}.mimi.json`;
}
