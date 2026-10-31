import type { NoteInput } from "./waitMode";

export type DrillKind = "notes" | "staff" | "chords";
export interface DrillConfig {
  kind: DrillKind;
  level: 1 | 2 | 3;
  count: number;
  mode: "practice" | "check";
}
export interface DrillTarget { id: string; pitches: number[]; fingers?: number[]; name?: string }
export interface DrillPlan { config: DrillConfig; seed: number; key: string; targets: DrillTarget[] }
export interface TrialResult { target: string; firstTry: boolean; wrong: number }
export interface DrillRun {
  step: number;
  phase: "playing" | "feedback" | "review" | "release" | "paused" | "finished";
  pausedFrom: "playing" | "feedback" | "review" | "release";
  held: number[];
  pressed: number[];
  wrong: number;
  lastWrong: number | null;
  simulated: boolean;
  trials: TrialResult[];
}
const naturals = [60, 62, 64, 65, 67, 69, 71, 72];
export const chordTargets: DrillTarget[] = [
  { id: "C", name: "C", pitches: [60, 64, 67], fingers: [1, 3, 5] },
  { id: "G", name: "G/B", pitches: [59, 62, 67], fingers: [1, 2, 5] },
  { id: "Am", name: "Am", pitches: [57, 60, 64], fingers: [1, 2, 4] },
  { id: "F", name: "F/A", pitches: [57, 60, 65], fingers: [1, 2, 5] },
];
export function drillPool(config: DrillConfig): DrillTarget[] {
  if (config.kind === "chords") return chordTargets.slice(0, config.level === 1 ? 2 : config.level === 2 ? 3 : 4);
  const pitches = config.level === 1 ? naturals.slice(0, 5)
    : config.level === 2 ? naturals : [...naturals.slice(0, 7).map((p) => p - 12), ...naturals];
  return pitches.map((pitch) => ({ id: String(pitch), pitches: [pitch] }));
}
/** Check rounds have a fixed reference; shuffled practice is never a benchmark. */
export function createDrillPlan(input: DrillConfig, seed: number): DrillPlan {
  const config = { ...input, count: Math.max(12, Math.min(120, Math.round(Number.isFinite(input.count) ? input.count : 24))) };
  const actualSeed = config.mode === "check" ? 0x51a7 : seed >>> 0;
  let random = actualSeed || 1;
  const next = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 4294967296; };
  const pool = drillPool(config);
  const targets: DrillTarget[] = [];
  while (targets.length < config.count) {
    const bag = [...pool];
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag[0].id === targets.at(-1)?.id) [bag[0], bag[1]] = [bag[1], bag[0]];
    targets.push(...bag.slice(0, config.count - targets.length));
  }
  return { config, seed: actualSeed, key: `drill-v1:${config.kind}:${config.level}:${config.count}:${config.mode}:${actualSeed}`, targets };
}
export const startDrill = (): DrillRun => ({ step: 0, phase: "playing", pausedFrom: "playing", held: [], pressed: [], wrong: 0, lastWrong: null, simulated: false, trials: [] });

/** Require a fresh, fully released attempt after each answer; no timing grade. */
export function inputDrill(plan: DrillPlan, run: DrillRun, input: NoteInput): DrillRun {
  if (run.phase === "finished") return run;
  const held = input.kind === "noteOff" ? run.held.filter((p) => p !== input.pitch) : [...new Set([...run.held, input.pitch])];
  const next = { ...run, held, simulated: run.simulated || input.simulated };
  if (run.phase === "paused" || run.phase === "feedback" || run.phase === "review") return next;
  if (run.phase === "release") return held.length === 0 ? { ...next, phase: "playing", pressed: [] } : next;
  if (input.kind === "noteOn" && run.held.includes(input.pitch)) return next;
  const target = plan.targets[run.step];
  if (!target) return run;
  if (input.kind === "noteOn" && !target.pitches.includes(input.pitch)) return { ...next, phase: "review", wrong: run.wrong + 1, lastWrong: input.pitch };
  const pressed = input.kind === "noteOn" ? [...new Set([...run.pressed, input.pitch])] : run.pressed;
  const complete = target.pitches.every((p) => pressed.includes(p) && held.includes(p)) && held.length === target.pitches.length;
  if (!complete) return { ...next, pressed };
  return { ...next, pressed, phase: "feedback", lastWrong: null, trials: [...run.trials, { target: target.id, firstTry: run.wrong === 0, wrong: run.wrong }] };
}
export function advanceDrill(plan: DrillPlan, run: DrillRun): DrillRun {
  if (run.phase !== "feedback") return run;
  const step = run.step + 1;
  return { ...run, step, wrong: 0, pressed: [], lastWrong: null, phase: step === plan.targets.length ? "finished" : run.held.length ? "release" : "playing" };
}
export function pauseDrill(run: DrillRun): DrillRun {
  return run.phase === "paused" || run.phase === "finished" ? run : { ...run, phase: "paused", pausedFrom: run.phase };
}
export function retryDrill(run: DrillRun): DrillRun {
  if (run.phase !== "review") return run;
  return { ...run, pressed: [], lastWrong: null, phase: run.held.length ? "release" : "playing" };
}
export function resumeDrill(run: DrillRun): DrillRun {
  if (run.phase !== "paused") return run;
  return { ...run, pressed: [], phase: run.pausedFrom === "feedback" ? "feedback" : run.pausedFrom === "review" ? "review" : run.held.length ? "release" : "playing" };
}
export function resetDrillInput(run: DrillRun): DrillRun {
  return { ...pauseDrill(run), held: [], pressed: [] };
}
