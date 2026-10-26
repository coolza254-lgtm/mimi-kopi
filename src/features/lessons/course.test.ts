import { expect, it } from "vitest";
import { chapterPlan, chapterStatus, chapterTargets, courseChapters, learningStatus, loadLearningProgress, saveChapterCompletion } from "./course";
import { advanceDrill, inputDrill, startDrill } from "./drills";
import { drillRecord } from "./drillHistory";

it("assesses only taught targets and uses a separate versioned chapter reference", () => {
  for (const chapter of courseChapters) {
    const pool = chapterTargets(chapter);
    expect(pool.length).toBe(chapter.steps.length);
    const plan = chapterPlan(chapter);
    expect(plan.targets).toHaveLength(12);
    expect(plan.key).toBe(`learn-v1:${chapter.id}:12`);
    expect(new Set(plan.targets.map((t) => t.id))).toEqual(new Set(pool.map((t) => t.id)));
    for (let i = 1; i < plan.targets.length; i++) expect(plan.targets[i].id).not.toBe(plan.targets[i - 1].id);
  }
  expect(chapterTargets(courseChapters[2]).every((t) => t.pitches[0] < 60)).toBe(true);
});
it("requires a finished check, distinguishes simulation and keeps real completion when a later simulated round is added", () => {
  const chapter = courseChapters[0];
  const plan = chapterPlan(chapter);
  let run = startDrill();
  const date = new Date("2026-10-26T10:00:00Z");
  expect(chapterStatus(chapter, [])).toBe("new");
  for (const target of plan.targets) {
    run = inputDrill(plan, run, { kind: "noteOn", pitch: target.pitches[0], timeMs: 0, simulated: true });
    run = inputDrill(plan, run, { kind: "noteOff", pitch: target.pitches[0], timeMs: 1, simulated: true });
    if (run.trials.length < 12) expect(chapterStatus(chapter, [drillRecord(plan, run, date, "partial")])).toBe("new");
    run = advanceDrill(plan, run);
  }
  const simulated = drillRecord(plan, run, date, "sim");
  expect(chapterStatus(chapter, [simulated])).toBe("simulated");
  expect(chapterStatus(chapter, [{ ...simulated, key: "drill-v1:notes" }])).toBe("new");
  expect(chapterStatus(chapter, [{ ...simulated, id: "real", simulated: false }, simulated])).toBe("completed");
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  expect(saveChapterCompletion(chapter, { ...simulated, completed:false }, storage)).toBe(false);
  expect(saveChapterCompletion(chapter, simulated, storage)).toBe(true);
  expect(learningStatus(chapter, loadLearningProgress(storage))).toBe("simulated");
  expect(saveChapterCompletion(chapter, { ...simulated, simulated:false }, storage)).toBe(true);
  expect(saveChapterCompletion(chapter, simulated, storage)).toBe(true);
  expect(learningStatus(chapter, loadLearningProgress(storage), [])).toBe("completed");
  expect(saveChapterCompletion(chapter, simulated, { ...storage, setItem: () => { throw new Error("Full"); } })).toBe(false);
  raw = '{"keyboard":{"realAt":"invalid"},"injected":{"realAt":"2026-10-26"}}';
  expect(learningStatus(chapter, loadLearningProgress(storage))).toBe("new");
  raw = "not json"; expect(loadLearningProgress(storage)).toEqual({});
});
