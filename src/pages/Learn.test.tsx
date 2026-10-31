// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chapterPlan, courseChapters } from "../features/lessons/course";
import { loadDrillHistory } from "../features/lessons/drillHistory";
import { noteName } from "../features/midi/notes";
import { en } from "../i18n/messages";
import Learn from "./Learn";
import type { MidiEvent } from "../lib/backend";

const { desktop, listeners, resets, simulate } = vi.hoisted(() => ({ desktop: vi.fn(() => false), listeners: new Set<(e: MidiEvent) => void>(), resets: new Set<() => void>(), simulate: vi.fn(async () => {}) }));
vi.mock("../lib/backend", () => ({ inDesktopApp: desktop, backend: {
  onMidiEvent: async (cb: (e: MidiEvent) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  onMidiReset: async (cb: () => void) => { resets.add(cb); return () => { resets.delete(cb); }; },
  onMidiStatus: async () => () => {}, midiStatus: async () => ({connected:"Piano",wanted:"Piano",error:null}), midiSimulate: simulate,
} }));
beforeEach(() => { localStorage.clear(); desktop.mockReturnValue(false); listeners.clear(); resets.clear(); simulate.mockClear(); vi.useFakeTimers(); vi.spyOn(window,"scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const t = (key: keyof typeof en) => en[key];
function openChapter(title:string){fireEvent.click(within(screen.getByRole("list",{name:en.pathTitle})).getByRole("button",{name:new RegExp(title)}));fireEvent.click(screen.getByRole("button",{name:`${en.learnOpen} · ${title}`}));}
function press(pitch: number) { const key = screen.getByLabelText(noteName(pitch), { exact:true, selector:"button" }); fireEvent.keyDown(key,{key:"Enter"}); fireEvent.keyUp(key,{key:"Enter"}); }

it("teaches one step at a time, gates progress on trying the right key and requires all assessment questions before completion", () => {
  const focus = vi.fn();
  render(<Learn t={t} locale="en" onFocusChange={focus} />);
  openChapter(en.learnKeyboard);
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  press(62); expect(screen.getByRole("status").textContent).toContain("You played D4 · Expected C4");
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText("1 / 5")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:en.answerRetry}));
  for (const [i,pitch] of [60,62,64,65,67].entries()) {
    press(pitch);
    expect(screen.getByRole("button",{name:i === 4 ? en.learnAssessment : en.learnNext})).toHaveProperty("disabled",false);
    act(() => vi.advanceTimersByTime(900));
  }
  expect(loadDrillHistory()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button",{name:en.drillBegin}));
  expect(focus).toHaveBeenLastCalledWith(true);
  for (const target of chapterPlan(courseChapters[0]).targets) { press(target.pitches[0]); act(() => vi.advanceTimersByTime(450)); }
  expect(loadDrillHistory()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:en.learnBack}));
  expect(screen.getByText(en.learnSimComplete)).toBeTruthy();
  expect(screen.queryByText(en.learnComplete)).toBeNull();
  expect(focus).toHaveBeenLastCalledWith(false);
});
it("does not award completion when leaving a teaching step", () => {
  render(<Learn t={t} locale="en" />);
  openChapter(en.learnBass);
  expect(screen.getByRole("img",{name:"C3"})).toBeTruthy();
  press(48); fireEvent.click(screen.getByRole("button",{name:en.learnBack}));
  expect(screen.getAllByText(en.learnNew)).toHaveLength(8);
  expect(loadDrillHistory()).toHaveLength(0);
});
it("opens a requested chapter directly and falls back safely for an unknown step", () => {
  const view = render(<Learn t={t} locale="en" initialStep="bass" />);
  expect(screen.getByRole("img", { name: "C3" })).toBeTruthy();
  expect(screen.queryByRole("list", { name: en.pathTitle })).toBeNull();
  expect(localStorage.getItem("mimi-kopi.learning.v1")).toBeNull();
  view.unmount();
  render(<Learn t={t} locale="en" initialStep="missing-step" />);
  expect(screen.getByRole("list", { name: en.pathTitle })).toBeTruthy();
});
it("opens a requested exercise with its intended mode and round length", () => {
  render(<Learn t={t} locale="en" initialStep="phrase" initialExercise={{ mode: "check", count: 3 }} />);
  expect((screen.getByRole("combobox", { name: en.pathScope }) as HTMLSelectElement).value).toBe("phrase");
  expect((screen.getByRole("combobox", { name: en.exMode }) as HTMLSelectElement).value).toBe("check");
  expect((screen.getByRole("combobox", { name: en.exCount }) as HTMLSelectElement).value).toBe("3");
});
it("retries unreadable path history after it is recovered without overwriting it", () => {
  localStorage.setItem("mimi-kopi.drill-history.v1", "broken-test-history");
  render(<Learn t={t} locale="en" />);
  expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
  expect(localStorage.getItem("mimi-kopi.drill-history.v1")).toBe("broken-test-history");
  localStorage.setItem("mimi-kopi.drill-history.v1", "[]");
  fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("list", { name: en.pathTitle })).toBeTruthy();
});
it("passes the selected bass chapter as a focused practice intent", () => {
  const practice = vi.fn();
  render(<Learn t={t} locale="en" onPractice={practice} />);
  fireEvent.click(within(screen.getByRole("list", { name: en.pathTitle })).getByRole("button", { name: new RegExp(en.learnBass) }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.pathPractice}`) }));
  expect(practice).toHaveBeenCalledWith({ kind: "chapter", chapterId: "bass" });
});
it("can practise the chapter being explained without marking its assessment complete", () => {
  const practice = vi.fn();
  render(<Learn t={t} locale="en" initialStep="bass" onPractice={practice} />);
  fireEvent.click(screen.getByRole("button", { name: en.pathPractice }));
  expect(practice).toHaveBeenCalledWith({ kind: "chapter", chapterId: "bass" });
  expect(loadDrillHistory()).toHaveLength(0);
  expect(localStorage.getItem("mimi-kopi.learning.v1")).toBeNull();
});
it("uses one playable keyboard for the chord infographic and supports latched simulated chords", () => {
  render(<Learn t={t} locale="en" />);
  openChapter(en.learnChords);
  expect(screen.getAllByRole("group", { name:"Piano keyboard" })).toHaveLength(1);
  press(58); press(60); press(64); press(67);
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  fireEvent.click(screen.getByRole("button",{name:en.answerRetry}));
  [60,64,67].forEach(press);
  expect(screen.getByRole("status").textContent).toContain(en.answerReleaseNext);
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.blur(window);
  expect(screen.getByLabelText("C4", {selector:"button"}).getAttribute("aria-pressed")).toBe("false");
  press(60);
  expect(screen.getByLabelText("C4", {selector:"button"}).getAttribute("aria-pressed")).toBe("true");
  [64,67,60,64,67].forEach(press);
  act(() => vi.advanceTimersByTime(900));
  expect(screen.getByRole("heading",{name:"Try G/B"})).toBeTruthy();
  expect(loadDrillHistory()).toHaveLength(0);
});
it("accepts native chords only when all notes are held and cleans up after reset and unmount", async () => {
  desktop.mockReturnValue(true);
  const app = render(<Learn t={t} locale="en" />);
  openChapter(en.learnChords);
  await act(async () => {});
  const feed = (pitch: number, kind: "noteOn"|"noteOff") => act(() => { listeners.forEach((cb) => cb({pitch,kind,simulated:false} as MidiEvent)); });
  feed(60,"noteOn"); feed(64,"noteOn");
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  act(() => { resets.forEach((cb) => cb()); });
  feed(67,"noteOn"); expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  feed(60,"noteOn"); feed(64,"noteOn");
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  feed(60,"noteOff"); feed(64,"noteOff"); feed(67,"noteOff");
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",false);
  app.unmount(); await act(async () => {}); expect(listeners.size).toBe(0); expect(resets.size).toBe(0);
});
it("cancels teaching auto advance on blur and never advances until the answered keys are released", () => {
 render(<Learn t={t} locale="en" initialStep="keyboard" />);
 const key=screen.getByLabelText("C4",{exact:true,selector:"button"});
 fireEvent.keyDown(key,{key:"Enter"});
 act(()=>vi.advanceTimersByTime(1800));expect(screen.getByText("1 / 5")).toBeTruthy();
 fireEvent.keyUp(key,{key:"Enter"});
 fireEvent.blur(window);
 act(()=>vi.advanceTimersByTime(1800));expect(screen.getByText("1 / 5")).toBeTruthy();
 press(60);act(()=>vi.advanceTimersByTime(900));expect(screen.getByText("2 / 5")).toBeTruthy();
 expect(loadDrillHistory()).toHaveLength(0);
});
it("requires a fresh teaching answer after reviewing a wrong held MIDI key and cancels on hidden", async () => {
 desktop.mockReturnValue(true);
 render(<Learn t={t} locale="en" initialStep="keyboard" />);await act(async()=>{});
 const feed=(pitch:number,kind:"noteOn"|"noteOff")=>act(()=>listeners.forEach((cb)=>cb({pitch,kind,simulated:false} as MidiEvent)));
 feed(62,"noteOn");fireEvent.click(screen.getByRole("button",{name:en.answerRetry}));
 feed(60,"noteOn");expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
 feed(62,"noteOff");feed(60,"noteOff");feed(60,"noteOn");feed(60,"noteOff");
 expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",false);
 vi.spyOn(document,"hidden","get").mockReturnValue(true);fireEvent(document,new Event("visibilitychange"));
 act(()=>vi.advanceTimersByTime(1800));expect(screen.getByText("1 / 5")).toBeTruthy();
});
