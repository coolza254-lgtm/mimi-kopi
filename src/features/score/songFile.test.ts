import { describe, expect, it } from "vitest";
import { loadSongs, newSong, saveSongs } from "./score";
import { MAX_SONG_FILE_BYTES, parseSongFile, serializeSongFile, songFilename } from "./songFile";

const now = new Date("2026-10-26T00:00:00Z");
const source = {
  ...newSong("original", "เพลงของฉัน · 練習", now),
  fifths: -2, beats: 3, tempo: 123, measures: 4,
  notes: [
    { id: "a", pitch: 60, start: 0, dur: 1.5, hand: "R" as const },
    { id: "b", pitch: 48, start: 0, dur: 6, hand: "L" as const },
    { id: "c", pitch: 64, start: 1.5, dur: 1.5, hand: "R" as const },
    { id: "d", pitch: 67, start: 24, dur: 24, hand: "R" as const },
  ],
};
const file = (song: unknown) => JSON.stringify({ format: "mimi-kopi-song", version: 1, song });

describe("song files", () => {
  it("preserves settings, chords, fractional timing and long dotted notes with fresh IDs", () => {
    const imported = parseSongFile("\uFEFF" + serializeSongFile(source), "copy", now);
    expect(imported).toEqual({ ...source, id: "copy", notes: source.notes.map((n, i) => ({ ...n, id: `copy-${i}` })) });
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    saveSongs([source, imported], storage);
    expect(loadSongs(storage)).toEqual([source, imported]);
  });

  it("supports empty songs", () => {
    expect(parseSongFile(serializeSongFile(newSong("old", "", now)), "new", now).notes).toEqual([]);
  });

  it.each(["nope", "null", "[]", JSON.stringify({ format: "mimi-kopi-song", version: 2, song: source }), JSON.stringify(source)])(
    "rejects malformed or unsupported files: %s", (text) => expect(() => parseSongFile(text, "new", now)).toThrow(),
  );

  it.each([
    { beats: 0 }, { beats: 2.5 }, { fifths: 5 }, { measures: 401 }, { tempo: "80" },
    { title: "x".repeat(201) }, { notes: {} }, { notes: [null] },
    { notes: [{ ...source.notes[0], pitch: 109 }] },
    { notes: [{ ...source.notes[0], start: -1 }] },
    { notes: [{ ...source.notes[0], start: 0.25 }] },
    { notes: [{ ...source.notes[0], start: 48 }] },
    { notes: [{ ...source.notes[0], start: 47, dur: 2 }] },
    { notes: [{ ...source.notes[0], dur: 5 }] },
    { notes: [{ ...source.notes[0], hand: "both" }] },
    { notes: Array.from({ length: 20_001 }, () => source.notes[0]) },
  ])("rejects invalid data without partial imports: %j", (change) => {
    expect(() => parseSongFile(file({ ...source, ...change }), "new", now)).toThrow();
  });

  it("limits UTF-8 file size before parsing", () => {
    expect(() => parseSongFile(" ".repeat(MAX_SONG_FILE_BYTES + 1), "new", now)).toThrow("too large");
    expect(() => parseSongFile("ก".repeat(Math.ceil(MAX_SONG_FILE_BYTES / 3)), "new", now)).toThrow("too large");
  });

  it.each([
    ["เพลงแรก", "เพลงแรก.mimi.json"], ["a/b:c?", "a_b_c_.mimi.json"],
    ["CON", "song.mimi.json"], ["nul.txt", "song.mimi.json"], ["...", "song.mimi.json"], ["", "song.mimi.json"],
  ])("makes safe filenames: %s", (title, expected) => expect(songFilename(title)).toBe(expected));
});
