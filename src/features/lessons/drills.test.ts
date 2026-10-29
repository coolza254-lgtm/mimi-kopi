import { describe, expect, it } from "vitest";
import { advanceDrill, chordTargets, createDrillPlan, inputDrill, pauseDrill, resetDrillInput, resumeDrill, startDrill, type DrillConfig } from "./drills";
import { appendDrillHistory, comparableChecks, drillRecord, firstTryRate, HISTORY_LIMIT, loadDrillHistory, readDrillHistory, weakTargets } from "./drillHistory";

const config: DrillConfig = { kind: "notes", level: 1, count: 12, mode: "check" };
const note = (pitch: number, kind: "noteOn" | "noteOff" = "noteOn", simulated = false) => ({ pitch, kind, simulated, timeMs: 0 });
describe("focused drill programs", () => {
  it("uses stable checks, balanced shuffled practice, and bounded intensity", () => {
    expect(createDrillPlan(config, 1)).toEqual(createDrillPlan(config, 999));
    const a = createDrillPlan({ ...config, mode: "practice", count: 120 }, 12);
    const b = createDrillPlan({ ...config, mode: "practice", count: 120 }, 99);
    expect(a.targets).not.toEqual(b.targets);
    for (let i = 1; i < a.targets.length; i++) expect(a.targets[i].id).not.toBe(a.targets[i - 1].id);
    expect(new Set(a.targets.map((t) => t.id)).size).toBe(5);
    expect(createDrillPlan({ ...config, count: Infinity }, 1).targets).toHaveLength(24);
    expect(createDrillPlan({ ...config, count: 1000 }, 1).targets).toHaveLength(120);
    expect(createDrillPlan({ ...config, kind: "staff", level: 3 }, 1).targets.some((t) => t.pitches[0] < 60)).toBe(true);
  });
  it("does not skip a wrong answer and records first-try errors per target", () => {
    const plan = createDrillPlan(config, 1);
    const pitch = plan.targets[0].pitches[0];
    let run = inputDrill(plan, startDrill(), note(1));
    expect(run.step).toBe(0);
    run = inputDrill(plan, run, note(pitch));
    expect(run.trials).toHaveLength(0);
    run = inputDrill(plan, run, note(1, "noteOff"));
    expect(run.trials[0]).toEqual({ target: String(pitch), firstTry: false, wrong: 1 });
    expect(inputDrill(plan, run, note(pitch)).trials).toHaveLength(1);
    run = advanceDrill(plan, run);
    expect(run.phase).toBe("release");
    run = inputDrill(plan, run, note(pitch, "noteOff"));
    expect(run.phase).toBe("playing");
  });
  it("requires every chord tone, rejects extra held notes and clears partial chords on reset", () => {
    const plan = { ...createDrillPlan({ ...config, kind: "chords" }, 1), targets: [chordTargets[0]] };
    let run = inputDrill(plan, startDrill(), note(60));
    run = resetDrillInput(run);
    run = resumeDrill(run);
    run = inputDrill(plan, run, note(64));
    run = inputDrill(plan, run, note(67));
    expect(run.trials).toHaveLength(0);
    run = inputDrill(plan, run, note(60, "noteOn", true));
    expect(run.trials).toHaveLength(1);
    expect(run.simulated).toBe(true);
    run = resumeDrill(pauseDrill(run));
    expect(run.phase).toBe("feedback");
    expect(advanceDrill(plan, run).phase).toBe("finished");
  });
  it("ignores notes during a pause and requires release when resuming", () => {
    const plan = createDrillPlan(config, 1);
    let run = pauseDrill(startDrill());
    run = inputDrill(plan, run, note(plan.targets[0].pitches[0]));
    expect(run.trials).toHaveLength(0);
    expect(resumeDrill(run).phase).toBe("release");
  });
});
describe("drill history", () => {
  const plan = createDrillPlan(config, 1);
  const completed = { ...startDrill(), step: 12, phase: "finished" as const,
    trials: plan.targets.map((t, i) => ({ target: t.id, firstTry: i > 0, wrong: i ? 0 : 2 })) };
  const record = drillRecord(plan, completed, new Date("2026-10-26T00:00:00Z"), "one");
  it("stores actual trials, does not duplicate saves and reports write errors", () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    expect(appendDrillHistory(record, storage)).toBe(true);
    expect(appendDrillHistory(record, storage)).toBe(true);
    expect(loadDrillHistory(storage)).toHaveLength(1);
    expect(firstTryRate(record)).toBe(11 / 12);
    expect(weakTargets(record)).toEqual([{ id: plan.targets[0].id, wrong: 2 }]);
    expect(appendDrillHistory(record, { ...storage, setItem: () => { throw new Error("Full"); } })).toBe(false);
    expect(loadDrillHistory({ getItem: () => JSON.stringify([{ ...record, trials: [{ target: "x", firstTry: true, wrong: 1 }] }]) })).toEqual([]);
  });
  it("distinguishes missing and empty history from an unreadable store", () => {
    expect(readDrillHistory({ getItem: () => null })).toEqual({ ok: true, records: [] });
    expect(readDrillHistory({ getItem: () => "[]" })).toEqual({ ok: true, records: [] });
    expect(readDrillHistory({ getItem: () => { throw Error("Denied"); } })).toEqual({ ok: false });
    let writes = 0;
    expect(appendDrillHistory(record, { getItem: () => { throw Error("Denied"); }, setItem: () => { writes++; } })).toBe(false);
    expect(writes).toBe(0);
  });
  it.each(["", "broken", "{}", "null", JSON.stringify([record, { ...record, trials: [{ target: "x", firstTry: true, wrong: 1 }] }]), " ".repeat(3000001)])("preserves all raw history when any part cannot be read or validated (case %#)", (raw) => {
    let value = raw;
    let writes = 0;
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { writes++; value = next; } };
    expect(readDrillHistory(storage)).toEqual({ ok: false });
    expect(appendDrillHistory(record, storage)).toBe(false);
    expect(value).toBe(raw);
    expect(writes).toBe(0);
  });
  it("keeps the documented rolling limit without dropping invalid records silently", () => {
    let value = JSON.stringify(Array.from({ length: HISTORY_LIMIT }, (_, i) => ({ ...record, id: String(i) })));
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    expect(appendDrillHistory({ ...record, id: "next" }, storage)).toBe(true);
    const loaded = readDrillHistory(storage);
    if (!loaded.ok) throw Error("Expected readable history");
    expect(loaded.records).toHaveLength(HISTORY_LIMIT);
    expect(loaded.records[0].id).toBe("1");
    expect(loaded.records.at(-1)).toEqual({ ...record, id: "next" });
  });
  it("compares only complete identical check rounds with matching simulation labels", () => {
    const next = { ...record, id: "two" };
    expect(comparableChecks([record], next)).toEqual([record]);
    for (const changed of [{ completed: false }, { simulated: true }, { key: "different" }, { plan: { ...config, mode: "practice" as const } }]) {
      expect(comparableChecks([{ ...record, ...changed }], next)).toEqual([]);
    }
  });
  it("keeps wrong presses on an unfinished last question without calling it completed", () => {
    const run = { ...startDrill(), step: 1, wrong: 3, phase: "paused" as const, trials: completed.trials.slice(0, 1) };
    const partial = drillRecord(plan, run, new Date("2026-10-26T01:00:00Z"), "partial");
    expect(partial.completed).toBe(false);
    expect(partial.pending).toEqual({ target: plan.targets[1].id, firstTry: false, wrong: 3 });
    expect(weakTargets(partial).some((item) => item.id === plan.targets[1].id && item.wrong >= 3)).toBe(true);
  });
});
