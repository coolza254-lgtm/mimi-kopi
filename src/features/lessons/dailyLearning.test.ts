import { expect, it } from "vitest";
import { completedToday, dailyLearning } from "./dailyLearning";
import { courseChapters } from "./course";
import { questionBank, type ExerciseKind, type ExerciseRecord } from "./exercises";
const now = new Date("2026-10-29T10:00:00Z");
function round(kind: ExerciseKind, patch: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return { id: kind, at: "2026-10-29T09:00:00Z", kind, mode: "check", count: 3, completed: true, simulated: true, pauses: 0,
    trials: questionBank(kind).slice(0, 3).map((q) => ({ question: q.id, wrong: 0, plays: 1, helped: false, unseen: true, finished: true })), ...patch };
}
it("starts with a taught foundation, then follows introduced topics without claiming mastery", () => {
  expect(dailyLearning({}, [], [], now)).toMatchObject({ step: { id: "keyboard" }, reason: "dailyStartReason" });
  expect(dailyLearning({ keyboard: { simulatedAt: "2026-10-28T00:00:00Z" } }, [], [], now)).toMatchObject({ step: { id: "direction" }, reason: "dailyNextReason" });
});
it("offers practice after actual mistakes and an independent attempt after supported practice", () => {
  const r = round("melody");
  expect(dailyLearning({}, [], [{ ...r, trials: r.trials.map((q) => ({ ...q, wrong: 2 })) }], now)).toMatchObject({ step: { id: "melody" }, mode: "learn", reason: "dailyRepairReason", evidence: { simulated: true } });
  expect(dailyLearning({}, [], [round("direction", { mode: "learn" })], now)).toMatchObject({ step: { id: "direction" }, mode: "check", reason: "dailyTryReason" });
});
it("labels partial rounds as a new start and does not let future dates drive recommendations", () => {
  expect(dailyLearning({}, [], [round("phrase", { completed: false })], now)).toMatchObject({ reason: "dailyRestartReason", step: { id: "phrase" } });
  expect(dailyLearning({}, [], [round("phrase", { completed: false, at: "2099-01-01T00:00:00Z" })], now).step.id).toBe("keyboard");
  expect(dailyLearning({ keyboard: { realAt: "2099-01-01T00:00:00Z" } }, [], [], now).step.id).toBe("keyboard");
});
it("does not keep an old exercise repair ahead of a more recent chapter", () => {
  expect(dailyLearning({ keyboard: { realAt: "2026-10-29T09:30:00Z" } }, [], [round("phrase", { completed: false })], now).step.id).toBe("direction");
});
it("offers an observed delayed review after all topics, while keeping each source separate", () => {
  const progress = Object.fromEntries(courseChapters.map((c) => [c.id, { realAt: "2026-10-28T00:00:00Z" }]));
  const records = (["direction", "rhythm", "phrase", "melody"] as const).map((kind) => round(kind, { at: "2026-10-25T10:00:00Z" }));
  records.push(round("direction", { id: "new-real", simulated: false }));
  const result = dailyLearning(progress, [], records, now);
  expect(result.reason).toBe("dailyReviewReason");
  expect(result.days).toBe(4);
  expect(result.evidence?.simulated).toBe(true);
  expect(result.step.id).not.toBe("keyboard");
});
it("records only completed activity on the local calendar day, never an ability percentage", () => {
  expect(completedToday([round("phrase"), round("melody", { simulated: false }), round("direction", { completed: false }), round("rhythm", { at: "2026-10-25T10:00:00Z" })], now)).toEqual({ real: 1, simulated: 1 });
});
