import type { DrillPlan, DrillRun, TrialResult } from "./drills";

export interface DrillRecord {
  id: string;
  at: string;
  plan: DrillPlan["config"];
  key: string;
  simulated: boolean;
  completed: boolean;
  trials: TrialResult[];
  pending?: TrialResult | null;
}
const KEY = "mimi-kopi.drill-history.v1";
export const HISTORY_LIMIT = 200;
export function drillRecord(plan: DrillPlan, run: DrillRun, at: Date, id: string): DrillRecord {
  return { id, at: at.toISOString(), plan: { ...plan.config }, key: plan.key, simulated: run.simulated,
    completed: run.step === plan.targets.length && run.phase === "finished", trials: run.trials.map((t) => ({ ...t })),
    pending: run.phase !== "feedback" && run.phase !== "finished" && !(run.phase === "paused" && run.pausedFrom === "feedback") && run.wrong > 0 && plan.targets[run.step]
      ? { target: plan.targets[run.step].id, firstTry: false, wrong: run.wrong } : null };
}
function validTrial(t: TrialResult): boolean {
  return !!t && typeof t.target === "string" && t.target.length < 40 && typeof t.firstTry === "boolean"
    && Number.isSafeInteger(t.wrong) && t.wrong >= 0 && t.firstTry === (t.wrong === 0);
}
function valid(value: unknown): value is DrillRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as DrillRecord;
  return typeof r.id === "string" && r.id.length <= 100 && typeof r.at === "string" && Number.isFinite(Date.parse(r.at))
    && typeof r.key === "string" && r.key.length <= 200 && typeof r.simulated === "boolean" && typeof r.completed === "boolean"
    && !!r.plan && ["notes", "staff", "chords"].includes(r.plan.kind) && [1, 2, 3].includes(r.plan.level)
    && ["practice", "check"].includes(r.plan.mode) && Number.isInteger(r.plan.count) && r.plan.count >= 12 && r.plan.count <= 120
    && Array.isArray(r.trials) && r.trials.length > 0 && r.trials.length <= r.plan.count
    && (!r.completed || r.trials.length === r.plan.count)
    && r.trials.every(validTrial) && (r.pending == null || (!r.completed && validTrial(r.pending)));
}
export function loadDrillHistory(storage?: Pick<Storage, "getItem">): DrillRecord[] {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(KEY);
    if (!raw || raw.length > 3000000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(valid).slice(-HISTORY_LIMIT);
  } catch { return []; }
}
export function appendDrillHistory(record: DrillRecord, storage?: Pick<Storage, "getItem" | "setItem">): boolean {
  try {
    if (!valid(record)) return false;
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    const history = loadDrillHistory(target).filter((r) => r.id !== record.id);
    target.setItem(KEY, JSON.stringify([...history, record].slice(-HISTORY_LIMIT)));
    return true;
  } catch { return false; }
}
export const firstTryRate = (r: DrillRecord): number => r.trials.filter((t) => t.firstTry).length / r.trials.length;
/** Only identical check references from the same input source can be compared. */
export function comparableChecks(history: DrillRecord[], current: DrillRecord): DrillRecord[] {
  if (!current.completed || current.plan.mode !== "check") return [];
  return history.filter((r) => r.id !== current.id && r.completed && r.plan.mode === "check" && r.key === current.key && r.simulated === current.simulated);
}
export function weakTargets(record: DrillRecord): { id: string; wrong: number }[] {
  const totals = new Map<string, number>();
  for (const trial of [...record.trials, ...(record.pending ? [record.pending] : [])]) if (trial.wrong > 0) totals.set(trial.target, (totals.get(trial.target) ?? 0) + trial.wrong);
  return [...totals].map(([id, wrong]) => ({ id, wrong })).sort((a, b) => b.wrong - a.wrong);
}
