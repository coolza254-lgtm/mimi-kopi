import { describe, expect, it } from "vitest";
import { chapterPlan, courseChapters } from "./course";
import type { DrillRecord } from "./drillHistory";
import { createDrillPlan } from "./drills";
import { chapterPracticePlan, skillPracticeIntent } from "./practiceNavigation";

describe("focused practice navigation", () => {
  it("keeps chapter pools exact and separates practice from chapter checks", () => {
    for (const chapter of courseChapters) {
      const plan = chapterPracticePlan(chapter);
      expect(plan.config.mode).toBe("practice");
      expect(plan.key).not.toBe(chapterPlan(chapter).key);
      expect(plan.targets).toEqual(chapterPlan(chapter).targets);
    }
    const bass = chapterPracticePlan(courseChapters.find((chapter) => chapter.id === "bass")!);
    expect([...new Set(bass.targets.flatMap((target) => target.pitches))].sort((a, b) => a - b)).toEqual([48, 50, 52, 53, 55]);
    expect(bass.targets.every((target) => target.pitches[0] < 60)).toBe(true);
    expect(chapterPracticePlan(courseChapters.find((chapter) => chapter.id === "chords")!).targets.map((target) => target.id)).not.toContain("F");
  });

  it("opens the evidence's chapter or exact generic range without switching to assessment", () => {
    const plan = chapterPlan(courseChapters.find((chapter) => chapter.id === "bass")!);
    const record: DrillRecord = { id: "test-evidence", at: "2026-10-29T00:00:00Z", key: plan.key, plan: plan.config, completed: true, simulated: false, trials: [] };
    expect(skillPracticeIntent("staff", record)).toEqual({ kind: "chapter", chapterId: "bass" });
    const generic = createDrillPlan({ kind: "chords", level: 3, count: 48, mode: "check" }, 0);
    expect(skillPracticeIntent("chords", { ...record, key: generic.key, plan: generic.config })).toEqual({ kind: "drill", config: { kind: "chords", level: 3, count: 48, mode: "practice" } });
    expect(skillPracticeIntent("staff", null)).toEqual({ kind: "chapter", chapterId: "treble" });
  });
});
