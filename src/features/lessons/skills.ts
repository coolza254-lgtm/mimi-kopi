import { chapterPlan, courseChapters, loadLearningProgress } from "./course";
import { comparableChecks, loadDrillHistory, type DrillRecord } from "./drillHistory";
import { createDrillPlan, type DrillKind } from "./drills";
import { loadProgress } from "./progress";

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
    for (const [key, array] of [["mimi-kopi.drill-history.v1", true], ["mimi-kopi.learning.v1", false], ["mimi-kopi.lessons", false]] as const) {
      const raw = target.getItem(key);
      if (raw === null) continue;
      if (raw.length > 3000000) throw new Error("Oversized history");
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data) !== array) throw new Error("Invalid history");
    }
    return { ok: true as const, drills: loadDrillHistory(target), learning: loadLearningProgress(target), legacy: loadProgress(target) };
  } catch { return { ok: false as const }; }
}
