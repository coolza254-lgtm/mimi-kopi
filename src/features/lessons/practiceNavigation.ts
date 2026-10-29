import { chapterPlan, courseChapters, type CourseChapter } from "./course";
import type { DrillRecord } from "./drillHistory";
import type { DrillConfig, DrillKind, DrillPlan } from "./drills";

export type PracticeIntent =
  | { kind: "chapter"; chapterId: string }
  | { kind: "drill"; config: DrillConfig };

/** Keep the taught pitch pool; bass is narrower than a generic level-three drill. */
export function chapterPracticePlan(chapter: CourseChapter): DrillPlan {
  const plan = chapterPlan(chapter);
  return { ...plan, config: { ...plan.config, mode: "practice" }, key: `learn-practice-v1:${chapter.id}:${plan.config.count}` };
}

/** Practise the evidence's exact scope without presenting practice as a new check. */
export function skillPracticeIntent(kind: DrillKind, record: DrillRecord | null): PracticeIntent {
  if (record) {
    const chapter = courseChapters.find((item) => chapterPlan(item).key === record.key);
    if (chapter) return { kind: "chapter", chapterId: chapter.id };
    return { kind: "drill", config: { ...record.plan, mode: "practice" } };
  }
  return { kind: "chapter", chapterId: kind === "notes" ? "keyboard" : kind === "staff" ? "treble" : "chords" };
}
