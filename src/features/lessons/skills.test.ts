import { expect, it } from "vitest";
import { createDrillPlan } from "./drills";
import type { DrillRecord } from "./drillHistory";
import { readSkillData, skillEvidence, skillScope } from "./skills";
import { chapterPlan, courseChapters } from "./course";
const plan = createDrillPlan({ kind:"staff", level:1, count:12, mode:"check" }, 1);
function record(id: string, overrides: Partial<DrillRecord> = {}): DrillRecord { return { id, at:`2026-10-${id.padStart(2,"0")}T10:00:00Z`, plan:plan.config, key:plan.key, completed:true, simulated:false, trials:plan.targets.map((t) => ({target:t.id,firstTry:true,wrong:0})), ...overrides }; }
it("keeps input sources, random practice, unfinished checks and different forms out of comparisons", () => {
  const history = [record("1"), record("2",{simulated:true}), record("3",{plan:{...plan.config,mode:"practice"}}), record("4",{completed:false}), record("5",{key:"other-form"}), record("6")];
  const result = skillEvidence(history,false,"staff");
  expect(result.latest?.id).toBe("6"); expect(result.previous.map((r) => r.id)).toEqual(["1"]);
  expect(skillEvidence(history,true,"staff").latest?.id).toBe("2");
});
it("sorts by recorded time rather than storage order and never mixes course and drill references", () => {
  const bassPlan=chapterPlan(courseChapters[2]);
  const bass = record("7", {key:bassPlan.key,plan:bassPlan.config,trials:bassPlan.targets.map((t)=>({target:t.id,firstTry:true,wrong:0}))});
  expect(skillScope(bass)).toBe("bass");
  expect(skillEvidence([bass,record("6"),record("1")],false,"staff").previous).toEqual([]);
  expect(skillEvidence([],false,"staff").latest).toBeNull();
  expect(skillScope({...bass,plan:{...bass.plan,kind:"notes"}})).toBeNull();
});
it("distinguishes missing history from unreadable or malformed storage without writing over it", () => {
  expect(readSkillData({getItem:()=>null})).toMatchObject({ok:true,drills:[]});
  expect(readSkillData({getItem:()=>"{"})).toEqual({ok:false});
  expect(readSkillData({getItem:()=>"{}"})).toEqual({ok:false});
  expect(readSkillData({getItem:()=>{throw Error("Denied");}})).toEqual({ok:false});
});
it("rejects one invalid drill inside an otherwise valid array instead of showing partial evidence", () => {
  const raw = JSON.stringify([record("1"), { ...record("2"), simulated: "false" }]);
  const storage = { getItem: (key: string) => key === "mimi-kopi.drill-history.v1" ? raw : null };
  expect(readSkillData(storage)).toEqual({ ok: false });
  expect(storage.getItem("mimi-kopi.drill-history.v1")).toBe(raw);
});
it("rejects malformed durable chapter data instead of treating it as no completion", () => {
  expect(readSkillData({ getItem: (key: string) => key === "mimi-kopi.learning.v1" ? JSON.stringify({ bass: { realAt: "invalid-test-date" } }) : null })).toEqual({ ok: false });
});
it("rejects invalid legacy lesson data without silently normalising it", () => {
  const raw = JSON.stringify({ "old-lesson": { version: 1, pianoRuns: "many", screenRuns: 0 } });
  expect(readSkillData({ getItem: (key: string) => key === "mimi-kopi.lessons" ? raw : null })).toEqual({ ok: false });
});
