import { learningPath, pathStepStatus, type PathStep } from "./learningPath";
import type { LearningProgress } from "./course";
import type { DrillRecord } from "./drillHistory";
import type { ExerciseRecord } from "./exercises";
import type { MessageKey } from "../../i18n/messages";

export interface DailySuggestion {
  step: PathStep;
  reason: MessageKey;
  mode: "learn" | "check";
  evidence?: ExerciseRecord;
  days?: number;
}
const day = 86_400_000;

/** A transparent navigation heuristic, not a mastery or retention model. */
export function dailyLearning(progress: LearningProgress, drills: DrillRecord[], records: ExerciseRecord[], now: Date): DailySuggestion {
  const time = now.getTime();
  const validAt = (at: string) => Number.isFinite(Date.parse(at)) && Date.parse(at) <= time;
  const datedProgress = Object.fromEntries(Object.entries(progress).map(([id, p]) => [id, {
    ...(p.realAt && validAt(p.realAt) ? { realAt: p.realAt } : {}),
    ...(p.simulatedAt && validAt(p.simulatedAt) ? { simulatedAt: p.simulatedAt } : {}),
  }]));
  const datedDrills = drills.filter((r) => validAt(r.at));
  const exercises = records.filter((r) => validAt(r.at)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const chapterDates = Object.values(progress).flatMap((p) => [p.realAt, p.simulatedAt]).filter((at): at is string => !!at && validAt(at));
  const latestOther = Math.max(0, ...drills.filter((r) => validAt(r.at)).map((r) => Date.parse(r.at)), ...chapterDates.map(Date.parse));
  const latest = exercises[0];
  if (latest && Date.parse(latest.at) >= latestOther) {
    const step = learningPath.find((s) => s.exercise === latest.kind)!;
    if (!latest.completed) return { step, reason: "dailyRestartReason", mode: latest.mode, evidence: latest };
    if (latest.trials.some((q) => q.wrong > 0)) return { step, reason: "dailyRepairReason", mode: "learn", evidence: latest };
    if (latest.mode === "learn") return { step, reason: "dailyTryReason", mode: "check", evidence: latest };
  }
  const next = learningPath.find((s) => pathStepStatus(s, datedProgress, datedDrills, exercises) === "new");
  if (next) return { step: next, reason: next.id === "keyboard" ? "dailyStartReason" : "dailyNextReason", mode: "learn" };
  // Each input source has its own observed history. Never merge scores across sources.
  const latestChecks = exercises.filter((r, i, all) => r.completed && r.mode === "check"
    && !all.slice(0, i).some((other) => other.completed && other.mode === "check" && other.kind === r.kind && other.simulated === r.simulated));
  const review = latestChecks.filter((r) => time - Date.parse(r.at) >= day).at(-1);
  if (review) return { step: learningPath.find((s) => s.exercise === review.kind)!, reason: "dailyReviewReason", mode: "check", evidence: review, days: Math.floor((time - Date.parse(review.at)) / day) };
  return { step: learningPath.find((s) => s.id === "phrase")!, reason: "dailyExploreReason", mode: "check" };
}

export function completedToday(records: ExerciseRecord[], now: Date): { real: number; simulated: number } {
  const today = now.toDateString();
  const completed = records.filter((r) => r.completed && Date.parse(r.at) <= now.getTime() && new Date(r.at).toDateString() === today);
  return { real: completed.filter((r) => !r.simulated).length, simulated: completed.filter((r) => r.simulated).length };
}
