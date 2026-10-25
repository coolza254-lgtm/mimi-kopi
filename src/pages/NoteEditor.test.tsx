// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiEvent } from "../lib/backend";
import { newSong } from "../features/score/score";
import NoteEditor from "./NoteEditor";

const { listeners, simulate } = vi.hoisted(() => ({
  listeners: new Set<(event: MidiEvent) => void>(),
  simulate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/backend", () => ({
  inDesktopApp: () => true,
  backend: {
    onMidiEvent: async (handler: (event: MidiEvent) => void) => {
      listeners.add(handler);
      return () => { listeners.delete(handler); };
    },
    midiSimulate: simulate,
  },
}));
vi.mock("./Practice", () => ({ LessonPlayer: () => <div>Playing lesson</div> }));

const event = { kind: "noteOn", pitch: 60, velocity: 80, simulated: false } as MidiEvent;
const saved = () => JSON.parse(localStorage.getItem("mimi-kopi.songs")!);
const send = async () => { await act(async () => { listeners.forEach((handler) => handler(event)); }); };
const mount = async () => {
  await act(async () => { render(<StrictMode><NoteEditor t={(key) => key} locale="en" /></StrictMode>); });
};

beforeEach(() => {
  localStorage.clear();
  listeners.clear();
  simulate.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("note editor MIDI lifecycle", () => {
  it("records once in StrictMode and never edits the song while practising", async () => {
    await mount();
    await send();
    expect(saved()[0].notes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /practiceThis/ }));
    expect(screen.getByText("Playing lesson")).toBeTruthy();
    const before = localStorage.getItem("mimi-kopi.songs");
    await send();
    expect(localStorage.getItem("mimi-kopi.songs")).toBe(before);
  });

  it("does not transcribe live playing over playback", async () => {
    await mount();
    await send();
    fireEvent.click(screen.getByRole("button", { name: /playListen/ }));
    const before = localStorage.getItem("mimi-kopi.songs");
    await send();
    expect(localStorage.getItem("mimi-kopi.songs")).toBe(before);
  });

  it("releases sounding notes if the final animation frame runs before delayed timers", async () => {
    vi.useFakeTimers();
    const frames = vi.fn<(callback: FrameRequestCallback) => number>(() => 1);
    vi.stubGlobal("requestAnimationFrame", frames);
    await mount();
    await send();
    fireEvent.click(screen.getByRole("button", { name: /playListen/ }));
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(simulate).toHaveBeenCalledWith([0x90, 60, 80]);
    const frame = frames.mock.calls[0][0];
    vi.spyOn(performance, "now").mockReturnValue(100_000);
    await act(async () => { frame(100_000); });
    expect(simulate).toHaveBeenLastCalledWith([0x80, 60, 0]);
  });

  it("clears the undo history when creating a new song", async () => {
    await mount();
    await send();
    fireEvent.click(screen.getByRole("button", { name: "songNew" }));
    expect((screen.getByRole("button", { name: /toolUndo/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(saved()).toHaveLength(2);
    expect(saved()[1].notes).toHaveLength(0);
  });

  it("clamps the selected range after the final empty measure is removed", async () => {
    const song = { ...newSong("s", "test", new Date()), measures: 2 };
    localStorage.setItem("mimi-kopi.songs", JSON.stringify([song]));
    await mount();
    fireEvent.change(screen.getByLabelText("playFrom"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /removeMeasure/ }));
    expect((screen.getByLabelText("playFrom") as HTMLSelectElement).value).toBe("0");
    expect((screen.getByLabelText("playTo") as HTMLSelectElement).value).toBe("0");
  });

  it("removes the MIDI listener on unmount", async () => {
    await mount();
    expect(listeners.size).toBe(1);
    await act(async () => cleanup());
    expect(listeners.size).toBe(0);
  });
});
