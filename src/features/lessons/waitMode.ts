/**
 * Wait mode (spec §6.4): the lesson stops on each step until it is played,
 * so there is no timing grade (spec §10.1). A step is done when every target
 * pitch has been pressed since the step began and all of them are held at
 * the same moment. Wrong presses are counted; they never advance the lesson.
 */

export interface WaitRun {
  step: number;
  /** Target pitches pressed since this step began. */
  pressed: number[];
  held: number[];
  correctNotes: number;
  wrongPresses: number;
  lastWrong: number | null;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  /** True if any input came from the on-screen keyboard. */
  simulated: boolean;
}

export interface NoteInput {
  kind: "noteOn" | "noteOff";
  pitch: number;
  timeMs: number;
  simulated: boolean;
}

export const startRun = (): WaitRun => ({
  step: 0,
  pressed: [],
  held: [],
  correctNotes: 0,
  wrongPresses: 0,
  lastWrong: null,
  startedAtMs: null,
  finishedAtMs: null,
  simulated: false,
});

const without = (list: number[], p: number) => list.filter((x) => x !== p);
const withPitch = (list: number[], p: number) => (list.includes(p) ? list : [...list, p]);

export function playNote(steps: readonly number[][], run: WaitRun, input: NoteInput): WaitRun {
  if (run.finishedAtMs !== null || run.step >= steps.length) return run;
  if (input.kind === "noteOff") {
    return { ...run, held: without(run.held, input.pitch) };
  }
  const next: WaitRun = {
    ...run,
    held: withPitch(run.held, input.pitch),
    startedAtMs: run.startedAtMs ?? input.timeMs,
    simulated: run.simulated || input.simulated,
  };
  const target = steps[run.step];
  if (!target.includes(input.pitch)) {
    return { ...next, wrongPresses: run.wrongPresses + 1, lastWrong: input.pitch };
  }
  const pressed = withPitch(next.pressed, input.pitch);
  const complete = target.every((p) => pressed.includes(p) && next.held.includes(p));
  if (!complete) return { ...next, pressed, lastWrong: null };
  const step = run.step + 1;
  return {
    ...next,
    step,
    pressed: [],
    correctNotes: run.correctNotes + target.length,
    lastWrong: null,
    finishedAtMs: step >= steps.length ? input.timeMs : null,
  };
}

export interface RunSummary {
  /** Correct notes over all presses; null before any press. */
  accuracy: number | null;
  durationMs: number | null;
}

export function summarize(run: WaitRun): RunSummary {
  const presses = run.correctNotes + run.wrongPresses;
  return {
    accuracy: presses > 0 ? run.correctNotes / presses : null,
    durationMs: run.startedAtMs !== null && run.finishedAtMs !== null ? run.finishedAtMs - run.startedAtMs : null,
  };
}
