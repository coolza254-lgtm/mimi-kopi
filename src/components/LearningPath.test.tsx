// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "../i18n/messages";
import { learningPath, pathSections } from "../features/lessons/learningPath";
import { EXERCISE_KEY, questionBank } from "../features/lessons/exercises";
import LearningPath from "./LearningPath";

const t = (key: keyof typeof en) => en[key];
const actions = () => ({ onChapter: vi.fn(), onExercise: vi.fn(), onSkills: vi.fn(), onPractice: vi.fn(), onBrowse: vi.fn() });
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("groups every existing step once and lets the learner explore without awarding completion", () => {
  const callbacks = actions();
  const writes = vi.spyOn(Storage.prototype, "setItem");
  render(<LearningPath t={t} {...callbacks} />);
  const path = screen.getByRole("list", { name: en.pathTitle });
  expect(pathSections.flatMap((section) => [...section.steps])).toEqual(learningPath.map((step) => step.id));
  expect(within(path).getAllByRole("button")).toHaveLength(8);
  expect(within(path).getAllByRole("heading", { level: 2 })).toHaveLength(4);
  fireEvent.click(within(path).getByRole("button", { name: new RegExp(en.learnBass) }));
  fireEvent.click(screen.getByRole("button", { name: `${en.learnOpen} · ${en.learnBass}` }));
  expect(callbacks.onChapter).toHaveBeenCalledWith(expect.objectContaining({ id: "bass" }));
  fireEvent.click(screen.getByRole("button", { name: en.pathPractice }));
  expect(callbacks.onPractice).toHaveBeenCalledWith({ kind: "chapter", chapterId: "bass" });
  expect(writes).not.toHaveBeenCalled();
});

it("keeps simulated and piano evidence separate while suggesting the next step", () => {
  localStorage.setItem("mimi-kopi.learning.v1", JSON.stringify({ keyboard: { simulatedAt: "2026-10-28T10:00:00Z" } }));
  const callbacks = actions();
  render(<LearningPath t={t} {...callbacks} />);
  const evidence = screen.getByLabelText(en.journeyProgress);
  expect(within(evidence).getByText(en.pathReal).textContent).toContain("0");
  expect(within(evidence).getByText(en.pathSim).textContent).toContain("1");
  const path = screen.getByRole("list", { name: en.pathTitle });
  expect(within(path).getByRole("button", { name: new RegExp(en.exDirection) }).getAttribute("aria-current")).toBe("step");
  expect(within(path).getByText(en.learnSimComplete)).toBeTruthy();
  expect(within(path).queryByText(en.learnComplete)).toBeNull();
});

it("resumes a recorded weak exercise with the existing recommendation mode", () => {
  const question = questionBank("direction")[0].id;
  const record = { id: "test", at: new Date(Date.now() - 1000).toISOString(), kind: "direction", mode: "check", count: 3, completed: true, simulated: true, pauses: 0, trials: Array.from({ length: 3 }, () => ({ question, wrong: 1, plays: 1, helped: false, unseen: false, finished: true })) };
  const original = JSON.stringify({ version: 1, records: [record], seen: {} });
  localStorage.setItem(EXERCISE_KEY, original);
  const callbacks = actions();
  render(<LearningPath t={t} {...callbacks} />);
  fireEvent.click(screen.getByRole("button", { name: en.pathContinue }));
  expect(callbacks.onExercise).toHaveBeenCalledWith("direction", { mode: "learn", count: 6 });
  expect(localStorage.getItem(EXERCISE_KEY)).toBe(original);
});

it("preserves damaged history and reloads the journey only after recovery", () => {
  localStorage.setItem(EXERCISE_KEY, "damaged history");
  render(<LearningPath t={t} {...actions()} />);
  expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
  expect(screen.queryByRole("list", { name: en.pathTitle })).toBeNull();
  expect(localStorage.getItem(EXERCISE_KEY)).toBe("damaged history");
  localStorage.setItem(EXERCISE_KEY, JSON.stringify({ version: 1, records: [], seen: {} }));
  fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
  expect(screen.getByRole("list", { name: en.pathTitle })).toBeTruthy();
});
