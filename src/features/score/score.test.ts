import { describe, expect, it } from "vitest";
import { keyAlter, lastUsedMeasure, loadSongs, newSong, pitchAt, saveSongs, snapStart, spell, toSteps, type Song } from "./score";

const now = new Date("2026-10-25T00:00:00Z");

function song(notes: Song["notes"], fifths = 0): Song {
  return { ...newSong("s", "test", now), fifths, notes };
}

describe("key signatures and spelling", () => {
  it("knows which letters a key alters", () => {
    expect(keyAlter(3, 1)).toBe(1); // F# in G major
    expect(keyAlter(0, 1)).toBe(0);
    expect(keyAlter(6, -1)).toBe(-1); // Bb in F major
    expect(keyAlter(2, -2)).toBe(-1); // Eb in Bb major
  });

  it("spells black keys by the key and prints only needed accidentals", () => {
    expect(spell(66, 1)).toMatchObject({ step: 31, alter: 1, accidental: null }); // F#4 in G
    expect(spell(66, 0)).toMatchObject({ step: 31, accidental: "♯" });
    expect(spell(70, -1)).toMatchObject({ step: 34, alter: -1, accidental: null }); // Bb4 in F
    expect(spell(65, 1)).toMatchObject({ step: 31, accidental: "♮" }); // F natural in G
    expect(spell(60, 0)).toMatchObject({ step: 28, accidental: null });
  });

  it("turns staff steps back into pitches", () => {
    expect(pitchAt(28, 0)).toBe(60);
    expect(pitchAt(31, 1)).toBe(66);
    expect(pitchAt(31, 1, 0)).toBe(65);
    expect(pitchAt(34, -1)).toBe(70);
    for (const fifths of [-4, 0, 3]) {
      for (let p = 36; p < 84; p++) {
        const s = spell(p, fifths);
        expect(pitchAt(s.step, fifths, s.alter)).toBe(p);
      }
    }
  });
});

describe("timing", () => {
  it("snaps to the note's own grid and stays inside the measure", () => {
    expect(snapStart(5, 4, 16)).toBe(4);
    expect(snapStart(7, 2, 16)).toBe(6);
    expect(snapStart(15, 8, 16)).toBe(8);
    expect(snapStart(17, 4, 16)).toBe(16);
    expect(snapStart(-3, 4, 16)).toBe(0);
    expect(snapStart(13, 6, 16)).toBe(10); // dotted quarter cannot cross the barline
  });

  it("builds chord steps per hand and measure range", () => {
    const s = song([
      { id: "a", pitch: 60, start: 0, dur: 4, hand: "R" },
      { id: "b", pitch: 64, start: 0, dur: 4, hand: "R" },
      { id: "c", pitch: 48, start: 0, dur: 8, hand: "L" },
      { id: "d", pitch: 62, start: 4, dur: 4, hand: "R" },
      { id: "e", pitch: 67, start: 16, dur: 4, hand: "R" },
    ]);
    expect(toSteps(s, "R")).toEqual([[60, 64], [62], [67]]);
    expect(toSteps(s, "both", 0, 0)).toEqual([[48, 60, 64], [62]]);
    expect(toSteps(s, "L")).toEqual([[48]]);
    expect(lastUsedMeasure(s)).toBe(1);
  });

  it("counts the following measure when a fractional note extends into it", () => {
    expect(lastUsedMeasure(song([{ id: "a", pitch: 60, start: 15, dur: 1.5, hand: "R" }]))).toBe(1);
  });
});

describe("song storage", () => {
  it("round-trips and drops broken notes", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const s = song([{ id: "a", pitch: 60, start: 0, dur: 4, hand: "R" }], 1);
    saveSongs([s], storage);
    expect(loadSongs(storage)).toEqual([s]);
    const raw = JSON.stringify([{ id: "x", notes: [{ id: "n", hand: "Q" }, { id: "m", hand: "L", pitch: 500 }] }, 7]);
    const [loaded] = loadSongs({ getItem: () => raw });
    expect(loaded.notes).toEqual([{ id: "m", hand: "L", pitch: 108, start: 0, dur: 4 }]);
    expect(loadSongs({ getItem: () => "nope" })).toEqual([]);
  });
});
