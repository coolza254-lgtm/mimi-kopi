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
  press(62); expect(screen.getByRole("status").textContent).toBe(en.learnAgain);
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  for (const [i,pitch] of [60,62,64,65,67].entries()) {
    press(pitch);
    fireEvent.click(screen.getByRole("button",{name:i === 4 ? en.learnAssessment : en.learnNext}));
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
it("uses one playable keyboard for the chord infographic and supports latched simulated chords", () => {
  render(<Learn t={t} locale="en" />);
  openChapter(en.learnChords);
  expect(screen.getAllByRole("group", { name:"Piano keyboard" })).toHaveLength(1);
  press(58); press(60); press(64); press(67);
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",true);
  press(58);
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",false);
  fireEvent.blur(window);
  expect(screen.getByLabelText("C4", {selector:"button"}).getAttribute("aria-pressed")).toBe("false");
  press(60);
  expect(screen.getByLabelText("C4", {selector:"button"}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:en.learnNext}));
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
  expect(screen.getByRole("button",{name:en.learnNext})).toHaveProperty("disabled",false);
  app.unmount(); await act(async () => {}); expect(listeners.size).toBe(0); expect(resets.size).toBe(0);
});
