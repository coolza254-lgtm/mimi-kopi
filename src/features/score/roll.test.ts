import { describe, expect, it } from "vitest";
import { newSong } from "./score";
import {
  rollPlan,
  rollGeometry,
  startRoll,
  rollInput,
  rollTick,
  rollFinished,
} from "./roll";
const song = {
  ...newSong("s", "test", new Date()),
  tempo: 60,
  measures: 2,
  notes: [
    { id: "l", pitch: 48, hand: "L" as const, start: 0, dur: 8 },
    { id: "r", pitch: 60, hand: "R" as const, start: 0, dur: 4 },
    { id: "r2", pitch: 60, hand: "R" as const, start: 4, dur: 4 },
    { id: "r3", pitch: 64, hand: "R" as const, start: 8, dur: 4 },
  ],
};
const plan = rollPlan(song, "both", 0, 1, 1);
describe("falling-note practice", () => {
  it("keeps precise times, crops held notes at boundaries, and filters hands", () => {
    const s = {
      ...song,
      notes: [
        { id: "p", pitch: 60, hand: "R" as const, start: 15.123, dur: 4.567 },
      ],
    };
    const p = rollPlan(s, "R", 1, 1, 0.5);
    expect(p.notes[0]).toMatchObject({ start: 0 });
    expect(p.notes[0].dur).toBeCloseTo((19.69 - 16) * 0.5, 8);
    expect(rollPlan(s, "L", 0, 1, 1).notes).toEqual([]);
  });
  it("waits at the line, requires the full chord held, and counts wrong attacks", () => {
    let r = rollTick(plan, startRoll(), 10, false);
    expect(r.time).toBe(0);
    expect(r.step).toBe(0);
    r = rollInput(plan, r, 48, true, false);
    expect(r.step).toBe(0);
    r = rollInput(plan, r, 61, true, false);
    r = rollInput(plan, r, 60, true, false);
    expect(r.wrong).toBe(1);
    expect(r.step).toBe(0);
    r = rollInput(plan, r, 61, false, false);
    r = rollTick(plan, r, 0.016, false);
    expect(r.step).toBe(1);
    expect(r.realSeen).toBe(true);
    expect(r.simulated).toBe(false);
  });
  it("requires release and a new attack for a repeated note, even with a sustained other voice", () => {
    let r = rollTick(plan, startRoll(), 3, false);
    r = rollInput(plan, r, 48, true, false);
    r = rollInput(plan, r, 60, true, false);
    r = rollTick(plan, r, 4, false);
    expect(r.time).toBe(1);
    expect(r.step).toBe(1);
    r = rollInput(plan, r, 60, true, false);
    expect(r.step).toBe(1);
    r = rollInput(plan, r, 60, false, false);
    r = rollInput(plan, r, 60, true, false);
    expect(r.step).toBe(2);
  });
  it("accepts an early held target without grading timing but still requires new attacks for repeats", () => {
    let r = rollInput(plan, startRoll(), 60, true, true);
    r = rollTick(plan, r, 3, false);
    r = rollInput(plan, r, 48, true, false);
    expect(r.step).toBe(1);
    expect(r.simulated).toBe(true);
    r = rollTick(plan, r, 2, false);
    expect(r.step).toBe(1);
    r = rollInput(plan, r, 60, false, true);
    r = rollInput(plan, r, 60, true, true);
    expect(r.step).toBe(2);
  });
  it("keeps the last note tail and ends listening without requiring answers", () => {
    const r = rollTick(plan, startRoll(), 20, true);
    expect(r.time).toBe(3);
    expect(rollFinished(plan, r, true)).toBe(true);
    expect(rollFinished(plan, r, false)).toBe(false);
  });
  it("aligns black and white note lanes exactly with the keyboard", () => {
    const keys = rollGeometry(60, 72);
    expect(keys.get(60)).toEqual({ x: 0, width: 1 / 8 });
    expect(keys.get(61)?.width).toBeCloseTo((1 / 8) * 0.62);
    expect(keys.get(61)?.x).toBeCloseTo(1 / 8 - (1 / 8) * 0.31);
    expect(keys.get(72)?.x).toBeCloseTo(7 / 8);
  });
});

it("latches simulation even when a screen press duplicates a held physical key", () => {
  let r = rollInput(plan, startRoll(), 60, true, false);
  r = rollInput(plan, r, 60, true, true);
  expect(r.simulated).toBe(true);
  expect(r.realSeen).toBe(true);
  expect(r.held).toEqual([60]);
});
