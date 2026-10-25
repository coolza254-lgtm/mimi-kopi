import { describe, expect, it } from "vitest";
import { lessons, LESSON_HIGH, LESSON_LOW } from "./lessons";
import { playNote, startRun, summarize, type NoteInput, type WaitRun } from "./waitMode";

let clock = 0;
const on = (pitch: number, simulated = false): NoteInput => ({ kind: "noteOn", pitch, timeMs: (clock += 100), simulated });
const off = (pitch: number): NoteInput => ({ kind: "noteOff", pitch, timeMs: (clock += 100), simulated: false });

function play(steps: number[][], ...inputs: NoteInput[]): WaitRun {
  return inputs.reduce((run, input) => playNote(steps, run, input), startRun());
}

describe("wait mode", () => {
  it("advances through a melody and finishes", () => {
    const steps = [[60], [62], [64]];
    const run = play(steps, on(60), off(60), on(62), off(62), on(64), off(64));
    expect(run.step).toBe(3);
    expect(run.finishedAtMs).not.toBeNull();
    expect(summarize(run).accuracy).toBe(1);
  });

  it("counts a wrong note without advancing", () => {
    const run = play([[60], [62]], on(61), off(61));
    expect(run.step).toBe(0);
    expect(run.wrongPresses).toBe(1);
    expect(run.lastWrong).toBe(61);
    const fixed = playNote([[60], [62]], run, on(60));
    expect(fixed.step).toBe(1);
    expect(fixed.lastWrong).toBeNull();
    expect(summarize(fixed).accuracy).toBe(0.5);
  });

  it("needs a fresh press when the same pitch repeats", () => {
    const steps = [[60], [60]];
    let run = play(steps, on(60));
    expect(run.step).toBe(1);
    run = playNote(steps, run, on(60)); // still held, a duplicate note on
    expect(run.step).toBe(2);
    const held = play([[60], [60]], on(60), off(62));
    expect(held.step, "holding the key does not complete the next step").toBe(1);
  });

  it("accepts a chord pressed one note at a time while held", () => {
    const steps = [[60, 64, 67]];
    const run = play(steps, on(60), on(64), on(67));
    expect(run.step).toBe(1);
    expect(run.correctNotes).toBe(3);
  });

  it("does not accept a chord whose notes were not held together", () => {
    const steps = [[60, 64, 67]];
    let run = play(steps, on(60), off(60), on(64), on(67));
    expect(run.step).toBe(0);
    run = playNote(steps, run, on(60));
    expect(run.step).toBe(1);
  });

  it("ignores input after finishing and reports duration", () => {
    clock = 0;
    const run = play([[60]], on(60));
    expect(playNote([[60]], run, on(62))).toBe(run);
    expect(summarize(run).durationMs).toBe(0);
    expect(summarize(startRun()).accuracy).toBeNull();
  });

  it("marks runs that used the on-screen keyboard", () => {
    expect(play([[60], [62]], on(60), on(62, true)).simulated).toBe(true);
    expect(play([[60]], on(60)).simulated).toBe(false);
  });
});

describe("lessons", () => {
  it("have unique ids, a version, and notes on the lesson keyboard", () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(lesson.version).toBeGreaterThan(0);
      expect(lesson.steps.length).toBeGreaterThan(0);
      for (const step of lesson.steps) {
        expect(step.length).toBeGreaterThan(0);
        expect(new Set(step).size, `${lesson.id}: duplicate pitch in a chord`).toBe(step.length);
        for (const p of step) {
          expect(p).toBeGreaterThanOrEqual(LESSON_LOW);
          expect(p).toBeLessThanOrEqual(LESSON_HIGH);
        }
      }
      for (const text of [...Object.values(lesson.title), ...Object.values(lesson.goal)]) {
        expect(text.trim()).not.toBe("");
      }
    }
  });
});
