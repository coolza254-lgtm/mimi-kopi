import { describe, expect, it } from "vitest";
import { parseMidiFile } from "./midiFile";
import { parseSongFile, serializeSongFile } from "./songFile";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const chunk = (events: number[]) => [...ascii("MTrk"), ...u32(events.length), ...events];
const end = [0, 255, 47, 0];
const note = [0, 144, 60, 80, 0x83, 0x60, 128, 60, 0];
const midi = (tracks: number[][], format = 1, division = 480) => new Uint8Array([
  ...ascii("MThd"), 0, 0, 0, 6, 0, format, 0, tracks.length, division >> 8, division & 255,
  ...tracks.flatMap(chunk),
]);
const parse = (data: Uint8Array) => parseMidiFile(data, "test.mid", "import", new Date("2026-11-01"));

describe("MIDI import", () => {
  it("reads format 1 conductor tempo and explicit hand names, preserving rests/chords and reopening", () => {
    const data = midi([
      [0, 255, 81, 3, 11, 113, 176, ...end],
      [0, 255, 3, 9, ...ascii("Left hand"), ...note, ...end],
      [0, 255, 3, 10, ...ascii("Right hand"), 0x83, 0x60, 144, 48, 80, 0, 144, 52, 80, 0x83, 0x60, 128, 48, 0, 0, 128, 52, 0, ...end],
    ]);
    const song = parse(data);
    expect(song.tempo).toBe(80);
    expect(song.notes.map(({ pitch, start, dur, hand }) => ({ pitch, start, dur, hand }))).toEqual([
      { pitch: 60, start: 0, dur: 4, hand: "L" },
      { pitch: 48, start: 4, dur: 4, hand: "R" },
      { pitch: 52, start: 4, dur: 4, hand: "R" },
    ]);
    expect(parseSongFile(serializeSongFile(song), "reopened", new Date()).notes).toHaveLength(3);
  });
  it("handles running status and velocity-zero note off in format 0", () => {
    const song = parse(midi([[0, 144, 59, 80, 0x83, 0x60, 59, 0, ...end]], 0));
    expect(song.notes[0]).toMatchObject({ pitch: 59, dur: 4, hand: "L" });
  });
  it.each([
    midi([[...note, ...end]], 2),
    midi([[...note, ...end]], 0, 0xe728),
    midi([[0, 144, 60, 80, ...end]]),
    midi([[0, 128, 60, 0, ...end]]),
    midi([[0, 144, 60, 80, 0, 128, 60, 0, ...end]]),
    midi([[0, 185, 64, 127, ...note, ...end]]),
    midi([[0, 153, 60, 80, 0x83, 0x60, 137, 60, 0, ...end]]),
    midi([[0, 255, 81, 3, 7, 161, 32, ...note, 0, 255, 81, 3, 11, 113, 176, ...end]]),
    midi([[0, 255, 88, 4, 6, 3, 24, 8, ...note, ...end]]),
    midi([[...note]]),
    midi([[...note, ...end]]).slice(0, -1),
    new Uint8Array(5 * 1024 * 1024 + 1),
  ])("rejects damaged or unrepresentable input without returning a partial song", (data) => {
    expect(() => parse(data)).toThrow();
  });
});


it("preserves unquantized starts and note lengths instead of rounding them", () => {
  const song = parse(midi([[1, 144, 60, 80, 7, 128, 60, 0, ...end]], 0));
  expect(song.notes[0]).toMatchObject({ start: 1 / 120, dur: 7 / 120 });
  const reopened = parseSongFile(serializeSongFile(song), "again", new Date());
  expect(reopened.notes[0]).toMatchObject({ start: 1 / 120, dur: 7 / 120 });
});
