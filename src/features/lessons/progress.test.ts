import { describe, expect, it } from "vitest";
import { lessons } from "./lessons";
import { loadProgress, nextLesson, recordFor, recordRun, saveProgress, stars, type Progress } from "./progress";

const lesson = lessons[0];
const now = new Date("2026-10-25T12:00:00Z");

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("lesson progress", () => {
  it("keeps the best piano accuracy and the fastest piano time", () => {
    let p: Progress = {};
    p = recordRun(p, lesson, { accuracy: 0.8, durationMs: 9000, simulated: false }, now);
    p = recordRun(p, lesson, { accuracy: 0.7, durationMs: 7000, simulated: false }, now);
    const r = recordFor(p, lesson);
    expect(r.pianoRuns).toBe(2);
    expect(r.bestAccuracy).toBe(0.8);
    expect(r.bestTimeMs).toBe(7000);
    expect(r.lastPlayedAt).toBe(now.toISOString());
  });

  it("never counts on-screen runs as piano results", () => {
    const p = recordRun({}, lesson, { accuracy: 1, durationMs: 1000, simulated: true }, now);
    const r = recordFor(p, lesson);
    expect(r.screenRuns).toBe(1);
    expect(r.pianoRuns).toBe(0);
    expect(r.bestAccuracy).toBeNull();
    expect(stars(r)).toBe(0);
  });

  it("gives stars from real accuracy", () => {
    const at = (accuracy: number) =>
      stars(recordFor(recordRun({}, lesson, { accuracy, durationMs: 1, simulated: false }, now), lesson));
    expect(at(0.5)).toBe(1);
    expect(at(0.85)).toBe(2);
    expect(at(0.95)).toBe(3);
  });

  it("starts fresh when the lesson version changes", () => {
    const p = recordRun({}, lesson, { accuracy: 1, durationMs: 1, simulated: false }, now);
    expect(recordFor(p, { ...lesson, version: lesson.version + 1 }).pianoRuns).toBe(0);
  });

  it("recommends the first lesson not yet finished on the piano", () => {
    expect(nextLesson(lessons, {})).toBe(lessons[0]);
    let p = recordRun({}, lessons[0], { accuracy: 1, durationMs: 1, simulated: false }, now);
    p = recordRun(p, lessons[1], { accuracy: 1, durationMs: 1, simulated: true }, now);
    expect(nextLesson(lessons, p)).toBe(lessons[1]);
  });

  it("round-trips through storage and drops bad records", () => {
    const storage = memoryStorage();
    const p = recordRun({}, lesson, { accuracy: 0.9, durationMs: 5000, simulated: false }, now);
    saveProgress(p, storage);
    expect(loadProgress(storage)).toEqual(p);
    const bad = JSON.stringify({ a: { version: "x" }, b: 3, c: { version: 1, pianoRuns: -2, bestAccuracy: 7 } });
    expect(loadProgress({ getItem: () => bad })).toEqual({
      c: { version: 1, pianoRuns: 0, screenRuns: 0, bestAccuracy: 1, bestTimeMs: null, lastPlayedAt: null },
    });
    expect(loadProgress({ getItem: () => "{oops" })).toEqual({});
  });
});
