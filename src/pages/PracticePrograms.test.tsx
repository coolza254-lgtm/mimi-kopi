// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { createDrillPlan, type DrillConfig } from "../features/lessons/drills";
import { chapterPlan, courseChapters } from "../features/lessons/course";
import { loadDrillHistory } from "../features/lessons/drillHistory";
import { noteName } from "../features/midi/notes";
import { en } from "../i18n/messages";
import PracticePrograms from "./PracticePrograms";
import ChordFingerGuide from "../components/ChordFingerGuide";
import { chordTargets } from "../features/lessons/drills";
import type { MidiEvent } from "../lib/backend";

const { desktop, listeners, resets } = vi.hoisted(() => ({ desktop: vi.fn(() => false), listeners: new Set<(event: MidiEvent) => void>(), resets: new Set<() => void>() }));
vi.mock("../lib/backend", () => ({ inDesktopApp: desktop, backend: {
  onMidiEvent: async (handler: (event: MidiEvent) => void) => { listeners.add(handler); return () => { listeners.delete(handler); }; },
  onMidiReset: async (handler: () => void) => { resets.add(handler); return () => { resets.delete(handler); }; },
  onMidiStatus: async () => () => undefined,
  midiStatus: async () => ({ connected: "Digital Piano", wanted: "Digital Piano", error: null }),
} }));
beforeEach(() => {
  localStorage.clear();
  desktop.mockReturnValue(false); listeners.clear(); resets.clear();
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const t = (key: keyof typeof en) => en[key];
const config: DrillConfig = { kind: "staff", level: 1, count: 12, mode: "check" };
function mount() {
  render(<StrictMode><PracticePrograms t={t} locale="en" onLegacy={vi.fn()} /></StrictMode>);
  fireEvent.change(screen.getByLabelText(en.drillAmount), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText(en.drillMode), { target: { value: "check" } });
  fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
}
function key(pitch: number) {
  const button = screen.getByLabelText(noteName(pitch), { exact: true });
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.keyUp(button, { key: "Enter" });
}
describe("focused practice programs", () => {
  it("accepts latched simulated chords and waits for every key to be released before the next question", () => {
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.drillChords) }));
    fireEvent.change(screen.getByLabelText(en.drillAmount), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(en.drillMode), { target: { value: "check" } });
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    const plan = createDrillPlan({ ...config, kind:"chords" }, 0);
    plan.targets[0].pitches.forEach(key);
    expect(screen.getByRole("status").textContent).toContain(en.drillCorrect);
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByRole("status").textContent).toContain(en.drillRelease);
    plan.targets[0].pitches.forEach(key);
    plan.targets[1].pitches.forEach(key);
    expect(screen.getByRole("status").textContent).toContain(en.drillCorrect);
    fireEvent.click(screen.getByRole("button", {name:en.drillPause}));
    fireEvent.click(screen.getByRole("button", {name:en.drillEnd}));
    expect(loadDrillHistory()[0]).toMatchObject({ simulated:true, completed:false });
    expect(loadDrillHistory()[0].trials).toHaveLength(2);
  });
  it("shows one five-line question with no visible note or key-name answers, then saves one simulated round", () => {
    mount();
    const plan = createDrillPlan(config, 0);
    expect(document.querySelectorAll(".reading-lines line")).toHaveLength(5);
    expect(document.querySelector(".drill-big")).toBeNull();
    for (const p of [60, 62, 64, 65, 67]) expect(screen.getByLabelText(noteName(p), { exact: true }).textContent).toBe("");
    const wrong = plan.targets[0].pitches[0] === 60 ? 62 : 60;
    key(wrong);
    expect(screen.getByRole("status").textContent).toContain(en.drillWrong);
    expect(loadDrillHistory()).toHaveLength(0);
    for (const target of plan.targets) {
      key(target.pitches[0]);
      act(() => vi.advanceTimersByTime(450));
    }
    expect(screen.getByRole("heading", { name: en.drillResults })).toBeTruthy();
    const records = loadDrillHistory();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ completed: true, simulated: true, plan: config });
    expect(records[0].trials.filter((trial) => trial.firstTry)).toHaveLength(11);
    expect(screen.getByText("92%")).toBeTruthy();
  });
  it("pauses with Escape and does not score warming up or duplicate a completed answer after pausing feedback", () => {
    mount();
    const target = createDrillPlan(config, 0).targets[0].pitches[0];
    key(target);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("heading", { name: en.drillPaused })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole("button", { name: en.drillResume }));
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByText(/2 \/ 12/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.drillPause }));
    fireEvent.click(screen.getByRole("button", { name: en.drillEnd }));
    expect(loadDrillHistory()).toHaveLength(1);
    expect(loadDrillHistory()[0].trials).toHaveLength(1);
    expect(loadDrillHistory()[0].completed).toBe(false);
  });
  it("reports failed storage without claiming the results were saved", () => {
    mount();
    key(createDrillPlan(config, 0).targets[0].pitches[0]);
    act(() => vi.advanceTimersByTime(450));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
    fireEvent.click(screen.getByRole("button", { name: en.drillPause }));
    fireEvent.click(screen.getByRole("button", { name: en.drillEnd }));
    expect(screen.getByRole("alert").textContent).toBe(en.resultSaveFailed);
    expect(loadDrillHistory()).toHaveLength(0);
  });
  it.each(["broken", "[{}]"])("reports unreadable history and preserves it when another round ends (case %#)", (raw) => {
    localStorage.setItem("mimi-kopi.drill-history.v1", raw);
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
    expect(screen.queryByText(en.drillEmpty)).toBeNull();
    fireEvent.change(screen.getByLabelText(en.drillAmount), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(en.drillMode), { target: { value: "check" } });
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    expect(screen.queryByRole("alert")).toBeNull();
    key(createDrillPlan(config, 0).targets[0].pitches[0]);
    act(() => vi.advanceTimersByTime(450));
    fireEvent.click(screen.getByRole("button", { name: en.drillPause }));
    fireEvent.click(screen.getByRole("button", { name: en.drillEnd }));
    expect(screen.getByText(en.resultSaveFailed)).toBeTruthy();
    expect(screen.getByText(en.pathLoadError)).toBeTruthy();
    expect(localStorage.getItem("mimi-kopi.drill-history.v1")).toBe(raw);
  });
  it("can reload history after the store becomes readable", () => {
    localStorage.setItem("mimi-kopi.drill-history.v1", "broken");
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    localStorage.setItem("mimi-kopi.drill-history.v1", "[]");
    fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(en.drillEmpty)).toBeTruthy();
  });
  it("opens the requested practice settings including a custom round length", () => {
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} initialConfig={{ kind: "chords", level: 2, count: 18, mode: "practice" }} />);
    expect(screen.getByRole("button", { name: new RegExp(en.drillChords) }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText(en.drillLevel)).toHaveProperty("value", "2");
    expect(screen.getByLabelText(en.drillMode)).toHaveProperty("value", "practice");
    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "18");
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    expect(screen.getByText("1 / 18")).toBeTruthy();
  });
  it("keeps chapter-specific practice separate from assessments and never awards chapter completion", () => {
    const chapter = courseChapters[2], assessment = chapterPlan(chapter), onComplete = vi.fn(() => true);
    const plan = { ...assessment, key: "learn-practice-v1:bass:12", config: { ...assessment.config, mode: "practice" as const } };
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} initialConfig={{ kind: "chords" }} course={{ plan, title: en.learnBass, purpose: "practice", onComplete }} />);
    expect(screen.getByRole("heading", { name: `${en.learnBass} · ${en.drillPractice}` })).toBeTruthy();
    expect(screen.queryByText(en.learnCheckHint)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    for (const target of plan.targets) { key(target.pitches[0]); act(() => vi.advanceTimersByTime(450)); }
    expect(onComplete).not.toHaveBeenCalled();
    expect(localStorage.getItem("mimi-kopi.learning.v1")).toBeNull();
    expect(loadDrillHistory()[0]).toMatchObject({ completed: true, simulated: true, key: plan.key, plan: { kind: "staff", mode: "practice" } });
    expect(screen.getByText(en.drillPracticeResult)).toBeTruthy();
    cleanup();
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} />);
    expect(document.querySelector(".program-history li")?.textContent).toContain(en.learnBass);
    expect(document.querySelector(".program-history li")?.textContent).not.toContain(en.drillLow);
  });
  it("hides the app navigation only inside an active program and restores it after ending", () => {
    localStorage.setItem("mimi-kopi.settings", JSON.stringify({ locale: "en", theme: "dark", autoUpdate: false }));
    render(<App />);
    fireEvent.click(within(screen.getByRole("navigation", { name: en.navSectionPractice })).getByRole("button", { name: en.navPractice }));
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    expect(document.querySelector(".shell")?.getAttribute("data-focus")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: en.drillPause }));
    fireEvent.click(screen.getByRole("button", { name: en.drillEnd }));
    expect(document.querySelector(".shell")?.getAttribute("data-focus")).toBe("false");
  });
  it("keeps finger guidance aligned with the exact chord voicing", () => {
    const view = render(<ChordFingerGuide target={chordTargets[0]} t={t} />);
    expect(screen.getByRole("img", { name: "C4: 1, E4: 3, G4: 5" })).toBeTruthy();
    view.rerender(<ChordFingerGuide key="G" target={chordTargets[1]} t={t} />);
    fireEvent.click(screen.getByRole("button", { name: /2.*Index.*D4/ }));
    expect(document.querySelectorAll(".finger-white.lit")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "B3: 1, D4: 2, G4: 5" })).toBeTruthy();
  });
  it("allows a custom round length to be entered without clamping each keystroke", () => {
    render(<PracticePrograms t={t} locale="en" onLegacy={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(en.drillAmount), { target: { value: "custom" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "6" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "60" } });
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("60");
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    expect(screen.getByText("1 / 60")).toBeTruthy();
  });
  it("receives native MIDI once, clears a partial chord after reset and removes listeners", async () => {
    desktop.mockReturnValue(true);
    const view = render(<StrictMode><PracticePrograms t={t} locale="en" onLegacy={vi.fn()} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.drillChords) }));
    fireEvent.change(screen.getByLabelText(en.drillAmount), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(en.drillMode), { target: { value: "check" } });
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    await act(async () => undefined);
    expect(listeners.size).toBe(1);
    const target = createDrillPlan({ ...config, kind: "chords" }, 0).targets[0];
    const send = (pitch: number) => act(() => listeners.forEach((f) => f({ kind: "noteOn", pitch, timestampUs: 1, simulated: false } as MidiEvent)));
    send(target.pitches[0]);
    act(() => resets.forEach((reset) => reset()));
    expect(screen.getByText(en.drillDeviceReset)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.drillResume }));
    for (const pitch of target.pitches.slice(1)) send(pitch);
    expect(screen.getByRole("status").textContent).not.toContain(en.drillCorrect);
    send(target.pitches[0]);
    expect(screen.getByRole("status").textContent).toContain(en.drillCorrect);
    act(() => vi.advanceTimersByTime(450));
    fireEvent.click(screen.getByRole("button", { name: en.drillPause }));
    fireEvent.click(screen.getByRole("button", { name: en.drillEnd }));
    expect(loadDrillHistory()[0]).toMatchObject({ simulated: false, completed: false });
    expect(loadDrillHistory()[0].trials).toHaveLength(1);
    await act(async () => view.unmount());
    expect(listeners.size).toBe(0); expect(resets.size).toBe(0);
  });
});
