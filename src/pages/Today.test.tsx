// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "../i18n/messages";
import Today from "./Today";
const t = (key: keyof typeof en) => en[key];
beforeEach(() => localStorage.clear());
afterEach(cleanup);
function setup() {
  const actions = { onPractice: vi.fn(), onLearn: vi.fn(), onFreePlay: vi.fn(), onEditor: vi.fn(), onSound: vi.fn(), onSkills: vi.fn() };
  render(<Today t={t} locale="en" {...actions} />);
  return actions;
}
it("opens the suggested chapter directly and leaves exploration optional", () => {
  const actions = setup();
  fireEvent.click(screen.getByRole("button", { name: en.pathContinue }));
  expect(actions.onLearn).toHaveBeenLastCalledWith("keyboard", { mode: "learn", count: 3 });
  fireEvent.click(screen.getByRole("button", { name: en.dailyMap }));
  expect(actions.onLearn).toHaveBeenLastCalledWith();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  expect(screen.getByText(en.pathNoMastery)).toBeTruthy();
});
it("passes the chosen round size to the next listening exercise without fake daily progress", () => {
  localStorage.setItem("mimi-kopi.learning.v1", JSON.stringify({ keyboard: { simulatedAt: "2026-10-28T10:00:00Z" } }));
  const actions = setup();
  fireEvent.click(screen.getByRole("radio", { name: en.dailyFull }));
  fireEvent.click(screen.getByRole("button", { name: en.dailyStart }));
  expect(actions.onLearn).toHaveBeenCalledWith("direction", { mode: "learn", count: 6 });
  expect(screen.getByText(en.dailyActivityEmpty)).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
});
it("keeps personal playing, skills and practice tools reachable", () => {
  const actions = setup();
  fireEvent.click(screen.getByRole("button", { name: en.dailyFree }));
  fireEvent.click(screen.getByRole("button", { name: en.dailyOwn }));
  fireEvent.click(screen.getByRole("button", { name: en.pathLinkSkills }));
  fireEvent.click(screen.getByText(en.dailyMore));
  fireEvent.click(screen.getByRole("button", { name: en.dailyPracticeOpen }));
  expect(actions.onFreePlay).toHaveBeenCalledTimes(1);
  expect(actions.onEditor).toHaveBeenCalledTimes(1);
  expect(actions.onSkills).toHaveBeenCalledTimes(1);
  expect(actions.onPractice).toHaveBeenCalledWith(null);
});
it("distinguishes unreadable data and retries without erasing it", () => {
  localStorage.setItem("mimi-kopi.drill-history.v1", "broken");
  setup();
  expect(screen.queryByRole("button", { name: en.pathContinue })).toBeNull();
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
  expect(localStorage.getItem("mimi-kopi.drill-history.v1")).toBe("broken");
  localStorage.setItem("mimi-kopi.drill-history.v1", "[]");
  fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
  expect(screen.getByRole("button", { name: en.pathContinue })).toBeTruthy();
});