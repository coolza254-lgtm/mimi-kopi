import { isBlackKey } from "../midi/notes";
import type { Song, ScoreHand } from "./score";

export interface RollNote {
  id: string;
  pitch: number;
  hand: ScoreHand;
  start: number;
  dur: number;
}
export interface RollStep {
  start: number;
  pitches: number[];
}
export interface RollPlan {
  notes: RollNote[];
  steps: RollStep[];
  duration: number;
  low: number;
  high: number;
}
export function rollPlan(
  song: Song,
  hands: ScoreHand | "both",
  from: number,
  to: number,
  speed: number,
): RollPlan {
  const unit = song.beats * 4,
    lo = from * unit,
    hi = (to + 1) * unit;
  const seconds = 60 / song.tempo / 4 / speed;
  const notes = song.notes
    .filter(
      (n) =>
        (hands === "both" || n.hand === hands) &&
        n.start < hi &&
        n.start + n.dur > lo,
    )
    .map((n) => ({
      ...n,
      start: (Math.max(lo, n.start) - lo) * seconds,
      dur: (Math.min(hi, n.start + n.dur) - Math.max(lo, n.start)) * seconds,
    }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const grouped = new Map<number, Set<number>>();
  for (const n of notes) {
    const set = grouped.get(n.start) ?? new Set<number>();
    set.add(n.pitch);
    grouped.set(n.start, set);
  }
  const steps = [...grouped].map(([start, pitches]) => ({
    start,
    pitches: [...pitches].sort((a, b) => a - b),
  }));
  let low = Math.max(21, Math.min(...notes.map((n) => n.pitch), 60) - 3);
  let high = Math.min(108, Math.max(...notes.map((n) => n.pitch), 72) + 3);
  while (isBlackKey(low)) low--;
  while (isBlackKey(high)) high++;
  return {
    notes,
    steps,
    duration: Math.max(0, ...notes.map((n) => n.start + n.dur)),
    low,
    high,
  };
}
export function rollGeometry(low: number, high: number) {
  const whites = Array.from(
    { length: high - low + 1 },
    (_, i) => low + i,
  ).filter((p) => !isBlackKey(p));
  const width = 1 / whites.length;
  let index = -1;
  const keys = new Map<number, { x: number; width: number }>();
  for (let p = low; p <= high; p++) {
    if (!isBlackKey(p)) {
      index++;
      keys.set(p, { x: index * width, width });
    } else
      keys.set(p, {
        x: (index + 1) * width - width * 0.31,
        width: width * 0.62,
      });
  }
  return keys;
}
export interface RollState {
  time: number;
  step: number;
  held: number[];
  pressed: number[];
  extra: number[];
  wrong: number;
  lastWrong: number | null;
  simulated: boolean;
  realSeen: boolean;
}
export const startRoll = (): RollState => ({
  time: -3,
  step: 0,
  held: [],
  pressed: [],
  extra: [],
  wrong: 0,
  lastWrong: null,
  simulated: false,
  realSeen: false,
});
function settle(plan: RollPlan, state: RollState): RollState {
  const target = plan.steps[state.step];
  if (
    target &&
    state.time >= target.start &&
    !state.extra.length &&
    target.pitches.every(
      (p) => state.pressed.includes(p) && state.held.includes(p),
    )
  )
    return {
      ...state,
      step: state.step + 1,
      pressed: [],
      extra: [],
      lastWrong: null,
    };
  return state;
}
export function rollTick(
  plan: RollPlan,
  state: RollState,
  delta: number,
  listen: boolean,
): RollState {
  const time = Math.min(plan.duration, state.time + Math.max(0, delta));
  return settle(plan, {
    ...state,
    time: listen
      ? time
      : Math.min(time, plan.steps[state.step]?.start ?? plan.duration),
  });
}
export function rollInput(
  plan: RollPlan,
  state: RollState,
  pitch: number,
  down: boolean,
  simulated: boolean,
): RollState {
  if (!down)
    return {
      ...state,
      held: state.held.filter((p) => p !== pitch),
      extra: state.extra.filter((p) => p !== pitch),
    };
  if (state.held.includes(pitch))
    return {
      ...state,
      simulated: state.simulated || simulated,
      realSeen: state.realSeen || !simulated,
    };
  const next = {
    ...state,
    held: [...state.held, pitch],
    simulated: state.simulated || simulated,
    realSeen: state.realSeen || !simulated,
  };
  const target = plan.steps[state.step];
  if (!target) return next;
  if (target.pitches.includes(pitch))
    return settle(plan, {
      ...next,
      pressed: [...new Set([...state.pressed, pitch])],
    });
  if (state.time < target.start - 0.18) return next;
  return {
    ...next,
    wrong: state.wrong + 1,
    lastWrong: pitch,
    extra: [...state.extra, pitch],
  };
}
export const rollFinished = (
  plan: RollPlan,
  state: RollState,
  listen: boolean,
) => state.time >= plan.duration && (listen || state.step >= plan.steps.length);
