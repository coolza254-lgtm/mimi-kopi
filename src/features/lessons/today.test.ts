import { describe, expect, it } from "vitest";
import { lessons } from "./lessons";
import { recordRun, type Progress } from "./progress";
import { todayRecommendation } from "./today";

const now = new Date("2026-10-26T00:00:00Z");
const run = (progress: Progress, index: number, accuracy: number, simulated = false) =>
  recordRun(progress, lessons[index], { accuracy, durationMs: 1000, simulated }, now);

describe("today recommendations", () => {
  it("starts a new player at the first lesson with no fabricated results", () => {
    expect(todayRecommendation(lessons, {})).toEqual({
      lesson: lessons[0], review: false, completed: 0, totalStars: 0, pianoRuns: 0, screenRuns: 0,
    });
  });

  it("keeps simulated practice separate and recommends the unfinished piano lesson", () => {
    const p = run(run({}, 0, 0.95), 1, 1, true);
    expect(todayRecommendation(lessons, p)).toMatchObject({
      lesson: lessons[1], review: false, completed: 1, totalStars: 3, pianoRuns: 1, screenRuns: 1,
    });
  });

  it("reviews the weakest real result after the curriculum is complete", () => {
    const p = lessons.reduce((progress, _, index) => run(progress, index, index === 3 ? 0.7 : 0.95), {});
    expect(todayRecommendation(lessons, run(p, 3, 1, true))).toMatchObject({ lesson: lessons[3], review: true, completed: lessons.length });
  });

  it("ignores old lesson versions and songs outside the curriculum", () => {
    const old = run({}, 0, 1);
    old[lessons[0].id].version--;
    old["song-custom"] = { ...old[lessons[0].id], version: 1, pianoRuns: 999 };
    expect(todayRecommendation(lessons, old)).toMatchObject({ lesson: lessons[0], completed: 0, pianoRuns: 0, totalStars: 0 });
  });

  it("handles empty curricula and keeps tied reviews in curriculum order", () => {
    expect(todayRecommendation([], {})).toMatchObject({ lesson: null, review: false, completed: 0 });
    const p = lessons.reduce((progress, _, index) => run(progress, index, 0.9), {});
    expect(todayRecommendation(lessons, p).lesson).toBe(lessons[0]);
  });
});
