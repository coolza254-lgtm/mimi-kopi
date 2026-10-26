import type { MessageKey } from "../../i18n/messages";
import { chordTargets, createDrillPlan, type DrillKind, type DrillPlan, type DrillTarget } from "./drills";
import type { DrillRecord } from "./drillHistory";

export interface CourseChapter { id: string; title: MessageKey; intro: MessageKey; kind: DrillKind; pitches: number[]; steps: MessageKey[] }
export const courseChapters: readonly CourseChapter[] = [
  { id: "keyboard", title: "learnKeyboard", intro: "learnKeyboardIntro", kind: "notes", pitches: [60,62,64,65,67], steps: ["learnKeyC","learnKeyD","learnKeyE","learnKeyF","learnKeyG"] },
  { id: "treble", title: "learnTreble", intro: "learnTrebleIntro", kind: "staff", pitches: [60,62,64,65,67], steps: ["learnTrebleC","learnTrebleD","learnTrebleE","learnTrebleF","learnTrebleG"] },
  { id: "bass", title: "learnBass", intro: "learnBassIntro", kind: "staff", pitches: [48,50,52,53,55], steps: ["learnBassC","learnBassD","learnBassE","learnBassF","learnBassG"] },
  { id: "chords", title: "learnChords", intro: "learnChordsIntro", kind: "chords", pitches: [], steps: ["learnChordC","learnChordG","learnChordAm"] },
];
export function chapterTargets(chapter: CourseChapter): DrillTarget[] {
  return chapter.kind === "chords" ? chordTargets.slice(0, 3) : chapter.pitches.map((p) => ({ id: String(p), pitches: [p] }));
}
export function chapterPlan(chapter: CourseChapter): DrillPlan {
  const plan = createDrillPlan({ kind: chapter.kind, level: chapter.kind === "chords" ? 2 : 1, count: 12, mode: "check" }, 0);
  const pool = chapterTargets(chapter);
  // The assessment only uses notes taught in this chapter, with an alternating fixed order.
  return { ...plan, key: `learn-v1:${chapter.id}:12`, targets: Array.from({ length: 12 }, (_, i) => pool[(i * 2) % pool.length]) };
}
export function chapterStatus(chapter: CourseChapter, history: readonly DrillRecord[]): "new" | "simulated" | "completed" {
  const rounds = history.filter((r) => r.completed && r.key === chapterPlan(chapter).key);
  return rounds.some((r) => !r.simulated) ? "completed" : rounds.length ? "simulated" : "new";
}

export interface ChapterCompletion { realAt?: string; simulatedAt?: string }
export type LearningProgress = Record<string, ChapterCompletion>;
const PROGRESS_KEY = "mimi-kopi.learning.v1";
export function loadLearningProgress(storage?: Pick<Storage, "getItem">): LearningProgress {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(PROGRESS_KEY);
    if (!raw || raw.length > 10000) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const progress: LearningProgress = {};
    for (const chapter of courseChapters) {
      const item = (data as LearningProgress)[chapter.id];
      if (!item || typeof item !== "object") continue;
      const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
      progress[chapter.id] = { ...(validDate(item.realAt) ? { realAt: item.realAt } : {}), ...(validDate(item.simulatedAt) ? { simulatedAt: item.simulatedAt } : {}) };
    }
    return progress;
  } catch { return {}; }
}
/** Durable chapter completion is independent of the rolling 200-round drill history. */
export function saveChapterCompletion(chapter: CourseChapter, record: DrillRecord, storage?: Pick<Storage, "getItem" | "setItem">): boolean {
  if (!record.completed || record.key !== chapterPlan(chapter).key || record.trials.length !== 12 || !Number.isFinite(Date.parse(record.at))) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    const progress = loadLearningProgress(target);
    progress[chapter.id] = { ...progress[chapter.id], [record.simulated ? "simulatedAt" : "realAt"]: record.at };
    target.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch { return false; }
}
export function learningStatus(chapter: CourseChapter, progress: LearningProgress, history: readonly DrillRecord[] = []): "new" | "simulated" | "completed" {
  if (progress[chapter.id]?.realAt) return "completed";
  const previous = chapterStatus(chapter, history);
  return previous === "completed" ? previous : progress[chapter.id]?.simulatedAt ? "simulated" : previous;
}
