// Lesson results kept between sessions. Only runs played on a real piano
// count towards stars and bests; on-screen runs are counted separately so
// the app never presents a simulated result as a piano result (spec §2.2).
// Like the settings, this moves to SQLite (spec §9.1) later.
import type { Lesson } from "./lessons";

export interface LessonRecord {
  /** Lesson version the record belongs to; another version starts fresh. */
  version: number;
  pianoRuns: number;
  screenRuns: number;
  /** Best note accuracy (0–1) from a piano run. */
  bestAccuracy: number | null;
  /** Fastest piano run, in ms. Wait mode, so this is not a timing score. */
  bestTimeMs: number | null;
  lastPlayedAt: string | null;
}

export type Progress = Record<string, LessonRecord>;

export interface RunResult {
  accuracy: number | null;
  durationMs: number | null;
  simulated: boolean;
}

const KEY = "mimi-kopi.lessons";

const empty = (version: number): LessonRecord => ({
  version,
  pianoRuns: 0,
  screenRuns: 0,
  bestAccuracy: null,
  bestTimeMs: null,
  lastPlayedAt: null,
});

/** The record for this version of the lesson; older versions read as new. */
export function recordFor(progress: Progress, lesson: Lesson): LessonRecord {
  const r = progress[lesson.id];
  return r && r.version === lesson.version ? r : empty(lesson.version);
}

export function recordRun(progress: Progress, lesson: Lesson, result: RunResult, now: Date): Progress {
  const r = recordFor(progress, lesson);
  const best = (old: number | null, value: number | null, better: (a: number, b: number) => boolean) =>
    value === null ? old : old === null || better(value, old) ? value : old;
  const next: LessonRecord = result.simulated
    ? { ...r, screenRuns: r.screenRuns + 1, lastPlayedAt: now.toISOString() }
    : {
        ...r,
        pianoRuns: r.pianoRuns + 1,
        bestAccuracy: best(r.bestAccuracy, result.accuracy, (a, b) => a > b),
        bestTimeMs: best(r.bestTimeMs, result.durationMs, (a, b) => a < b),
        lastPlayedAt: now.toISOString(),
      };
  return { ...progress, [lesson.id]: next };
}

/**
 * 0–3 stars from the best piano accuracy: one for finishing on the piano,
 * two at 85% or better, three at 95% or better.
 */
export function stars(record: LessonRecord): number {
  return record.pianoRuns === 0 ? 0 : starsFor(record.bestAccuracy ?? 0);
}

/** Stars a finished piano run with this accuracy earns. */
export function starsFor(accuracy: number): number {
  return accuracy >= 0.95 ? 3 : accuracy >= 0.85 ? 2 : 1;
}

export const played = (r: LessonRecord) => r.pianoRuns + r.screenRuns > 0;

/** The first lesson not yet finished on the piano, in path order. */
export function nextLesson(all: readonly Lesson[], progress: Progress): Lesson | null {
  return all.find((l) => recordFor(progress, l).pianoRuns === 0) ?? null;
}

function readRecord(value: unknown): LessonRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const count = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 ? x : 0);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);
  if (typeof v.version !== "number") return null;
  const accuracy = num(v.bestAccuracy);
  return {
    version: v.version,
    pianoRuns: count(v.pianoRuns),
    screenRuns: count(v.screenRuns),
    bestAccuracy: accuracy === null ? null : Math.min(1, accuracy),
    bestTimeMs: num(v.bestTimeMs),
    lastPlayedAt: typeof v.lastPlayedAt === "string" ? v.lastPlayedAt : null,
  };
}

export function loadProgress(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Progress {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Progress = {};
    for (const [id, value] of Object.entries(parsed)) {
      const r = readRecord(value);
      if (r) out[id] = r;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveProgress(progress: Progress, storage?: Pick<Storage, "setItem">): boolean {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    // Storage can be unavailable or full; the lesson itself still works.
    return false;
  }
}
