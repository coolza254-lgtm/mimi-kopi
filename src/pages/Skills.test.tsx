// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createDrillPlan } from "../features/lessons/drills";
import { en } from "../i18n/messages";
import Skills from "./Skills";
beforeEach(() => localStorage.clear()); afterEach(cleanup);
it("does not present screen practice or chapter completion as a real piano skill", () => {
  const plan = createDrillPlan({kind:"notes",count:12,level:1,mode:"check"},0);
  localStorage.setItem("mimi-kopi.drill-history.v1",JSON.stringify([{id:"screen",at:"2026-10-28T10:00:00Z",plan:plan.config,key:plan.key,completed:true,simulated:true,trials:plan.targets.map((q) => ({target:q.id,firstTry:true,wrong:0}))}]));
  render(<Skills t={(key) => en[key]} locale="en" onPractice={() => {}} />);
  expect(screen.getAllByText(en.pathNoData)).toHaveLength(3);
  fireEvent.click(screen.getByRole("button",{name:en.pathSim}));
  expect(screen.getByText(en.pathFamiliar)).toBeTruthy();
  expect(screen.getByText(en.pathNoMastery)).toBeTruthy();
});
it("shows a read error and preserves corrupt data instead of displaying zero progress", () => {
  localStorage.setItem("mimi-kopi.learning.v1","broken");
  render(<Skills t={(key) => en[key]} locale="en" onPractice={() => {}} />);
  expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
  expect(localStorage.getItem("mimi-kopi.learning.v1")).toBe("broken");
});
