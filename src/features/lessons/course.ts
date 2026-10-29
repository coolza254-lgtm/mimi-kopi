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
export type LearningProgressRead = { ok: true; progress: LearningProgress } | { ok: false };
export function readLearningProgress(storage?: Pick<Storage, "getItem">): LearningProgressRead {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(PROGRESS_KEY);
    if (raw === null) return { ok: true, progress: {} };
    if (raw.length > 10000) return { ok: false };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false };
    const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
    const valid = Object.entries(data).every(([id, item]) => courseChapters.some((chapter) => chapter.id === id)
      && item && typeof item === "object" && !Array.isArray(item)
      && Object.entries(item).every(([key, value]) => ["realAt", "simulatedAt"].includes(key) && validDate(value)));
    return valid ? { ok: true, progress: data as LearningProgress } : { ok: false };
  } catch { return { ok: false }; }
}
export function loadLearningProgress(storage?: Pick<Storage, "getItem">): LearningProgress {
  const result = readLearningProgress(storage);
  return result.ok ? result.progress : {};
}
/** Durable chapter completion is independent of the rolling 200-round drill history. */
export function saveChapterCompletion(chapter: CourseChapter, record: DrillRecord, storage?: Pick<Storage, "getItem" | "setItem">): boolean {
  if (!record.completed || record.key !== chapterPlan(chapter).key || record.trials.length !== 12 || !Number.isFinite(Date.parse(record.at))) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    const loaded = readLearningProgress(target);
    if (!loaded.ok) return false;
    const progress = loaded.progress;
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
