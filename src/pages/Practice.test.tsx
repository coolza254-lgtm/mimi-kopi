// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../features/lessons/lessons";
import { recordFor, recordRun } from "../features/lessons/progress";
import { en } from "../i18n/messages";
import type { MidiEvent } from "../lib/backend";
import Practice, { LessonPlayer } from "./Practice";

const { listeners, resetListeners, simulate } = vi.hoisted(() => ({
  listeners: new Set<(event: MidiEvent) => void>(),
  resetListeners: new Set<() => void>(),
  simulate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/backend", () => ({
  inDesktopApp: () => true,
  backend: {
    midiStatus: async () => ({ connected: null, wanted: null, error: null, capabilities: {} }),
    onMidiStatus: async () => () => undefined,
    onMidiEvent: async (handler: (event: MidiEvent) => void) => {
      const subscription = (event: MidiEvent) => handler(event);
      listeners.add(subscription);
      return () => { listeners.delete(subscription); };
    },
    onMidiReset: async (handler: () => void) => {
      const subscription = () => handler();
      resetListeners.add(subscription);
      return () => { resetListeners.delete(subscription); };
    },
    midiSimulate: simulate,
  },
}));

const lesson = { ...lessons[2], steps: [[60], [62]], fingers: [[1], [2]] };
let timestamp = 0;
const send = async (pitch: number, simulated = false, kind: MidiEvent["kind"] = "noteOn") => {
  await act(async () => {
    listeners.forEach((handler) => handler({ kind, pitch, simulated, timestampUs: ++timestamp * 1000 } as MidiEvent));
  });
};
const mount = async () => {
  const onFinish = vi.fn().mockReturnValue(true);
  await act(async () => {
    render(<StrictMode><LessonPlayer lesson={lesson} record={recordFor({}, lesson)} next={null} t={(key) => en[key]} locale="en" onFinish={onFinish} onBack={vi.fn()} onOpen={vi.fn()} /></StrictMode>);
  });
  return onFinish;
};

beforeEach(() => {
  localStorage.clear();
  listeners.clear();
  resetListeners.clear();
  simulate.mockClear();
  timestamp = 0;
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("guided lesson experience", () => {
  it("allows warming up before Start without scoring notes and saves a completed run once in StrictMode", async () => {
    const onFinish = await mount();
    await send(61);
    await send(60);
    await send(62);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: en.lessonSetup })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    expect(screen.getByRole("heading", { name: "Step 1 / 2" })).toBe(document.activeElement);
    await send(60);
    await send(62);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(lesson, { accuracy: 1, durationMs: 1, simulated: false });
    expect(screen.getByText(en.reviewReadyTitle)).toBeTruthy();
    await send(62);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
    await act(async () => cleanup());
    expect(listeners.size).toBe(0);
    expect(resetListeners.size).toBe(0);
  });

  it("can hide answer hints while keeping the staff accessible and the scoring unchanged", async () => {
    const onFinish = await mount();
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    const key = screen.getByRole("button", { name: "C4" });
    expect(key.className).toContain("target");
    fireEvent.click(screen.getByRole("checkbox", { name: en.lessonHints }));
    expect(key.className).not.toContain("target");
    expect(key.textContent).toBe("");
    expect(screen.getByText(en.lessonReadPrompt)).toBeTruthy();
    expect(screen.getByRole("img", { name: `${en.pressNow}: C4` })).toBeTruthy();
    await send(60);
    await send(62);
    expect(onFinish).toHaveBeenCalledWith(lesson, { accuracy: 1, durationMs: 1, simulated: false });
  });

  it("labels simulated practice honestly and recommends trying a real piano without awarding stars", async () => {
    const onFinish = await mount();
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    await send(60, true);
    await send(62);
    expect(onFinish).toHaveBeenCalledWith(lesson, expect.objectContaining({ simulated: true }));
    expect(screen.getByText(en.resultSimulated)).toBeTruthy();
    expect(screen.getByText(en.reviewSimulatedTitle)).toBeTruthy();
    expect(screen.queryByRole("img", { name: /stars/ })).toBeNull();
  });

  it("discards held chord notes after a MIDI reset so a reconnect must play the complete chord", async () => {
    const chordLesson = { ...lesson, steps: [[60, 64]], fingers: [[1, 3]] };
    const onFinish = vi.fn();
    await act(async () => {
      render(<LessonPlayer lesson={chordLesson} record={recordFor({}, chordLesson)} next={null} t={(key) => en[key]} locale="en" onFinish={onFinish} onBack={vi.fn()} onOpen={vi.fn()} />);
    });
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    await send(60);
    act(() => resetListeners.forEach((handler) => handler()));
    await send(64);
    expect(onFinish).not.toHaveBeenCalled();
    await send(60);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("keeps every lesson available and describes completion without claiming mastery", async () => {
    await act(async () => render(<Practice t={(key) => en[key]} locale="en" />));
    fireEvent.click(screen.getByRole("button", { name: en.drillLegacyOpen }));
    for (const entry of lessons) {
      expect((screen.getByRole("button", { name: new RegExp(entry.title.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }) as HTMLButtonElement).disabled).toBe(false);
    }
    expect(screen.getAllByText(en.overallLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(en.practiceBridgeTitle)).toBeTruthy();
  });

  it("compares a retry with the best recorded before that run", async () => {
    await act(async () => render(<Practice t={(key) => en[key]} locale="en" initialLesson={lessons[0]} />));
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    for (const step of lessons[0].steps) {
      for (const pitch of step) await send(pitch);
      for (const pitch of step) await send(pitch, false, "noteOff");
    }
    expect(screen.getByText(en.newBest)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.restart }));
    await send(61);
    for (const step of lessons[0].steps) {
      for (const pitch of step) await send(pitch);
      for (const pitch of step) await send(pitch, false, "noteOff");
    }
    expect(screen.queryByText(en.newBest)).toBeNull();
    expect(screen.getByText(en.previousBest)).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("keeps the finished result available but reports a storage failure honestly", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
    await act(async () => render(<Practice t={(key) => en[key]} locale="en" initialLesson={lessons[0]} />));
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    for (const step of lessons[0].steps) {
      for (const pitch of step) await send(pitch);
      for (const pitch of step) await send(pitch, false, "noteOff");
    }
    expect(screen.getByText(en.resultSaveFailed).getAttribute("role")).toBe("status");
    expect(screen.queryByText(en.resultNote)).toBeNull();
    expect(screen.queryByText(en.newBest)).toBeNull();
    expect(screen.getByText("100%")).toBeTruthy();
  });
  it("preserves unreadable legacy history without showing a new best or an empty progress map", async () => {
    const raw = '{"earlier-result":{"version":"broken"}}';
    localStorage.setItem("mimi-kopi.lessons", raw);
    await act(async () => render(<Practice t={(key) => en[key]} locale="en" initialLesson={lessons[0]} />));
    expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    expect(screen.queryByRole("alert")).toBeNull();
    for (const step of lessons[0].steps) {
      for (const pitch of step) await send(pitch);
      for (const pitch of step) await send(pitch, false, "noteOff");
    }
    expect(screen.getByText(en.resultSaveFailed)).toBeTruthy();
    expect(screen.queryByText(en.newBest)).toBeNull();
    expect(localStorage.getItem("mimi-kopi.lessons")).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.allLessons) }));
    expect(screen.getByRole("alert").textContent).toBe(en.pathLoadError);
    expect(screen.queryByText(en.overallLabel)).toBeNull();
    localStorage.setItem("mimi-kopi.lessons", "{}");
    fireEvent.click(screen.getByRole("button", { name: en.pathRetry }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(en.overallLabel).length).toBeGreaterThan(0);
  });
  it("requires reloading an unreadable history before saving over a later repaired store", async () => {
    localStorage.setItem("mimi-kopi.lessons", "broken");
    await act(async () => render(<Practice t={(key) => en[key]} locale="en" initialLesson={lessons[0]} />));
    const repaired = JSON.stringify(recordRun({}, lessons[1], { accuracy: 0.8, durationMs: 1000, simulated: false }, new Date("2026-10-26T10:00:00Z")));
    localStorage.setItem("mimi-kopi.lessons", repaired);
    fireEvent.click(screen.getByRole("button", { name: en.lessonStart }));
    for (const step of lessons[0].steps) {
      for (const pitch of step) await send(pitch);
      for (const pitch of step) await send(pitch, false, "noteOff");
    }
    expect(localStorage.getItem("mimi-kopi.lessons")).toBe(repaired);
    expect(screen.getByText(en.resultSaveFailed)).toBeTruthy();
    expect(screen.queryByText(en.newBest)).toBeNull();
  });
});
