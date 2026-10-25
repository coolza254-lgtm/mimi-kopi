import { describe, expect, it } from "vitest";
import { baseDuration, isDotted, newSong, snapStart } from "./score";
import { clampMeasureRange, enterMidiNote, playbackEvents, type MidiEntry } from "./editor";

const now = new Date("2026-10-26T00:00:00Z");
const initial = (): MidiEntry => ({ song: newSong("s", "test", now), cursor: null, last: null });
const noteOn = { kind: "noteOn" as const, pitch: 60, velocity: 80, simulated: false };

describe("MIDI entry", () => {
  it("keeps a chord together while successive melody notes move the cursor", () => {
    const a = enterMidiNote(initial(), noteOn, 4, "a", 0, now)!;
    const b = enterMidiNote(a, { ...noteOn, pitch: 64 }, 4, "b", 80, now)!;
    const c = enterMidiNote(b, { ...noteOn, pitch: 67 }, 4, "c", 160, now)!;
    expect(c.song.notes.map((n) => [n.pitch, n.start])).toEqual([[60, 0], [64, 0], [67, 4]]);
    expect(c.cursor).toBe(8);
    expect(initial().song.notes).toEqual([]);
  });

  it("keeps dotted sixteenths and extends a measure at fractional boundaries", () => {
    const s = initial();
    s.song.measures = 1;
    s.cursor = 16.5;
    const next = enterMidiNote(s, { ...noteOn, pitch: 48 }, 1.5, "a", 0, now)!;
    expect(next.song.measures).toBe(2);
    expect(next.song.notes[0]).toMatchObject({ start: 16.5, dur: 1.5, hand: "L" });
    expect(s.song.measures).toBe(1);
    expect(isDotted(1.5)).toBe(true);
    expect(baseDuration(1.5)).toBe(1);
    expect(snapStart(1.5, 1.5, 16)).toBe(1.5);
  });

  it("rejects simulated events, releases and out-of-range pitches", () => {
    for (const event of [
      { ...noteOn, simulated: true }, { ...noteOn, kind: "noteOff" as const },
      { ...noteOn, velocity: 0 }, { ...noteOn, pitch: null },
      { ...noteOn, pitch: 20 }, { ...noteOn, pitch: 109 }, { ...noteOn, pitch: 60.5 },
    ]) expect(enterMidiNote(initial(), event, 4, "x", 0, now)).toBeNull();
  });

  it("moves a dotted melody to the next bar instead of overlapping earlier notes", () => {
    let state = initial();
    for (let i = 0; i < 4; i++) state = enterMidiNote(state, noteOn, 6, String(i), i * 200, now)!;
    expect(state.song.notes.map((n) => n.start)).toEqual([0, 6, 16, 22]);
  });

  it("does not create a song longer than the supported file format", () => {
    const s = initial();
    s.cursor = 400 * 16;
    expect(enterMidiNote(s, noteOn, 4, "x", 0, now)).toBeNull();
  });
});

describe("playback and ranges", () => {
  it("clamps a range after removing measures", () => {
    expect(clampMeasureRange(1, { from: 7, to: 10 })).toEqual({ from: 0, to: 0 });
    expect(clampMeasureRange(5, { from: 3, to: 1 })).toEqual({ from: 3, to: 3 });
    expect(clampMeasureRange(5, { from: 1, to: 2 })).toEqual({ from: 1, to: 2 });
  });

  it("releases an overlapping pitch only when every voice has ended", () => {
    const s = newSong("s", "", now);
    s.notes = [
      { id: "a", pitch: 60, start: 0, dur: 8, hand: "R" },
      { id: "b", pitch: 60, start: 4, dur: 8, hand: "R" },
      { id: "c", pitch: 48, start: 0, dur: 4, hand: "L" },
    ];
    expect(playbackEvents(s, "R", 0, 16)).toEqual([
      { at: 0, pitch: 60, on: true }, { at: 4, pitch: 60, on: true }, { at: 12, pitch: 60, on: false },
    ]);
  });

  it("includes held notes at the start and clips releases to the selected end", () => {
    const s = newSong("s", "", now);
    s.notes = [
      { id: "a", pitch: 60, start: 0, dur: 16, hand: "R" },
      { id: "b", pitch: 48, start: 0, dur: 16, hand: "L" },
    ];
    expect(playbackEvents(s, "L", 4, 8)).toEqual([{ at: 0, pitch: 48, on: true }, { at: 4, pitch: 48, on: false }]);
    expect(playbackEvents(s, "both", 16, 32)).toEqual([]);
  });

  it("releases before reattacking repeated notes at the same instant", () => {
    const s = newSong("s", "", now);
    s.notes = [
      { id: "a", pitch: 60, start: 0, dur: 4, hand: "R" },
      { id: "b", pitch: 60, start: 4, dur: 4, hand: "R" },
    ];
    expect(playbackEvents(s, "R", 0, 16)).toEqual([
      { at: 0, pitch: 60, on: true }, { at: 4, pitch: 60, on: false },
      { at: 4, pitch: 60, on: true }, { at: 8, pitch: 60, on: false },
    ]);
  });
});
