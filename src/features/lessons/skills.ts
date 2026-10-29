import { chapterPlan, courseChapters, readLearningProgress } from "./course";
import { comparableChecks, readDrillHistory, type DrillRecord } from "./drillHistory";
import { createDrillPlan, type DrillKind } from "./drills";
import { readProgress } from "./progress";

export function skillScope(record: DrillRecord): string | null {
  const chapter = courseChapters.find((c) => chapterPlan(c).key === record.key);
  const expected=chapter?chapterPlan(chapter):createDrillPlan(record.plan,0);
  if(record.key!==expected.key||record.plan.kind!==expected.config.kind||record.plan.level!==expected.config.level||record.plan.count!==expected.config.count||record.plan.mode!==expected.config.mode||record.trials.some((q,i)=>q.target!==expected.targets[i]?.id))return null;
  if (chapter) return chapter.id;
  return record.plan.kind === "chords" ? `chords-${record.plan.level}` : `range-${record.plan.level}`;
}
/** A completed familiar-form check is evidence for that form, never general mastery. */
export function skillEvidence(history: DrillRecord[], simulated: boolean, kind: DrillKind) {
  const records = history.filter((r) => r.simulated === simulated && r.completed && r.plan.mode === "check" && r.plan.kind === kind && skillScope(r))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const latest = records[0] ?? null;
  return { latest, previous: latest ? comparableChecks(records, latest).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-5) : [] };
}
export function readSkillData(storage?: Pick<Storage, "getItem">) {
  try {
    const target=storage??globalThis.localStorage;
    const history = readDrillHistory(target), learning = readLearningProgress(target), legacy = readProgress(target);
    if (!history.ok || !learning.ok || !legacy.ok) return { ok: false as const };
    return { ok: true as const, drills: history.records, learning: learning.progress, legacy: legacy.progress };
  } catch { return { ok: false as const }; }
}
