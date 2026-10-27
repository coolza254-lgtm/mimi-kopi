import { expect, it } from "vitest";
import { activeSongPitches, fallingKey, notesForHands, practiceSongs, songEnd, songSeconds } from "./catalog";

it("ships only bounded monophonic practice melodies with a provenance link", () => {
  expect(new Set(practiceSongs.map((s) => s.id)).size).toBe(3);
  for (const song of practiceSongs) {
    expect(song.source).toMatch(/^https:\/\/(www.mutopiaproject.org|imslp.org)\//);
    expect(song.notes.length).toBeGreaterThan(25);
    for (const hand of ["left", "right"] as const) {
    let end = 0;
    for (const note of notesForHands(song, hand)) {
      expect(note.beat).toBe(end);
      expect(note.duration).toBeGreaterThan(0);
      expect(note.pitch).toBeGreaterThanOrEqual(43);
      expect(note.pitch).toBeLessThanOrEqual(79);
      end = note.beat + note.duration;
    }
    expect(songEnd(song)).toBe(end);
    }
    expect(songSeconds(song, .5)).toBe(songSeconds(song, 1) * 2);
    expect(Math.max(...notesForHands(song, "left").map((n) => n.pitch))).toBeLessThan(Math.min(...notesForHands(song, "right").map((n) => n.pitch)));
    for (let beat = 0; beat < songEnd(song); beat += .25) {
      const left = activeSongPitches(song, beat, "left");
      expect(activeSongPitches(song, beat, "right").some((pitch) => left.includes(pitch))).toBe(false);
    }
  }
});
it("leaves an audible release gap between repeated notes and no sound in lead-in or after end", () => {
  const song = practiceSongs[0];
  expect(activeSongPitches(song, -1)).toEqual([]);
  expect(activeSongPitches(song, 0, "right")).toEqual([60]);
  expect(activeSongPitches(song, .95, "right")).toEqual([]);
  expect(activeSongPitches(song, 1, "right")).toEqual([60]);
  expect(activeSongPitches(song, 0, "left")).toEqual([48]);
  expect(activeSongPitches(song, 0)).toEqual([48,60]);
  expect(activeSongPitches(song, songEnd(song))).toEqual([]);
});
it("aligns falling bars with the white and black keys of the same piano range", () => {
  expect(fallingKey(43)).toEqual({ left: 0, width: 4.545454545454546 });
  expect(fallingKey(60).left).toBeCloseTo(10 * 100 / 22);
  expect(fallingKey(61).left + fallingKey(61).width / 2).toBeCloseTo(11 * 100 / 22);
  expect(fallingKey(79).left + fallingKey(79).width).toBeCloseTo(100);
});
