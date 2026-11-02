// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en, th, ja } from "../i18n/messages";
import TrainingStudio from "./TrainingStudio";
afterEach(cleanup);
it("routes to real learning and resets the guide when changing focus", () => {
  const onLearn = vi.fn(), onEditor = vi.fn();
  render(<TrainingStudio t={(k) => en[k]} onLearn={onLearn} onEditor={onEditor} />);
  fireEvent.click(screen.getByRole("button", { name: en.trainingOpen }));
  expect(onLearn).toHaveBeenLastCalledWith("treble");
  fireEvent.click(screen.getByRole("button", { name: /Separate rhythm/ }));
  fireEvent.click(screen.getByRole("button", { name: en.trainingOpen }));
  expect(onLearn).toHaveBeenLastCalledWith("rhythm");
  fireEvent.click(screen.getByRole("button", { name: /Transcribe by ear/ }));
  fireEvent.click(screen.getByRole("button", { name: /Write a little/ }));
  fireEvent.click(screen.getByRole("button", { name: en.trainingEditor }));
  expect(onEditor).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: /Chords & changes/ }));
  expect(screen.getByRole("heading", { name: en.trainingChord1 })).toBeTruthy();
  expect(screen.getByRole("button", { name: en.trainingPrevious }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: en.trainingOpen }));
  expect(onLearn).toHaveBeenLastCalledWith("chords");
  fireEvent.click(screen.getByRole("button", { name: "Cm" }));
  expect(screen.getByRole("img", { name: "Cm" }).textContent).toContain("♭");
});
it("shows guidance one step at a time without inventing a completion score", () => {
  render(<TrainingStudio t={(k) => en[k]} onLearn={vi.fn()} onEditor={vi.fn()} />);
  for(let i=0;i<4;i++) fireEvent.click(screen.getByRole("button", { name: en.trainingNext }));
  expect(screen.getByText(en.trainingRead5Body)).toBeTruthy();
  expect(screen.getByRole("button", { name: en.trainingNext }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("progressbar")).toBeNull();
  for (const messages of [th,en,ja]) expect(messages.trainingChord5Body.length).toBeGreaterThan(50);
});
