// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MidiEvent } from "../lib/backend";
import { newSong } from "../features/score/score";
import FallingPractice from "./FallingPractice";
const { listeners, resets, arm, stop, dispose, play } = vi.hoisted(() => ({
  listeners: new Set<(e: MidiEvent) => void>(),
  resets: new Set<() => void>(),
  arm: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
  play: vi.fn(),
}));
vi.mock("../lib/backend", () => ({
  inDesktopApp: () => true,
  backend: {
    midiSimulate: vi.fn().mockResolvedValue(undefined),
    onMidiEvent: async (cb: (e: MidiEvent) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onMidiReset: async (cb: () => void) => {
      resets.add(cb);
      return () => resets.delete(cb);
    },
  },
}));
vi.mock("../lib/rollAudio", () => ({
  RollAudio: class {
    arm = arm;
    stop = stop;
    dispose = dispose;
    note = play;
  },
}));
const song = {
  ...newSong("s", "A practice passage", new Date()),
  tempo: 60,
  notes: [
    { id: "a", pitch: 60, start: 0, dur: 0.4, hand: "R" as const },
    { id: "b", pitch: 62, start: 0.8, dur: 0.4, hand: "R" as const },
  ],
};
const frames = new Map<number, FrameRequestCallback>();
let time = 0,
  id = 0;
const complete = vi.fn().mockReturnValue(true),
  focus = vi.fn();
async function mount(source = song) {
  await act(async () => {
    render(
      <FallingPractice
        song={source}
        hands="both"
        from={0}
        to={0}
        speed={1}
        t={(k) => k}
        onBack={() => undefined}
        onComplete={complete}
        onFocusChange={focus}
      />,
    );
  });
}
async function tick(seconds: number) {
  for (let n = 0; n < Math.round(seconds * 20); n++)
    await act(async () => {
      time += 50;
      const batch = [...frames];
      frames.clear();
      batch.forEach(([, cb]) => cb(time));
    });
}
async function start() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /rollStart/ }));
  });
}
beforeEach(() => {
  frames.clear();
  time = 0;
  id = 0;
  listeners.clear();
  resets.clear();
  vi.clearAllMocks();
  arm.mockResolvedValue(undefined);
  complete.mockReturnValue(true);
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (n: number) => frames.delete(n));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("completes screen practice once, labels it simulated, and keeps the keyboard mounted", async () => {
  await mount();
  await start();
  await tick(3.1);
  const c = screen.getByRole("button", { name: "C4" });
  fireEvent.keyDown(c, { key: "Enter" });
  fireEvent.keyUp(c, { key: "Enter" });
  await tick(0.25);
  expect(screen.getByRole("button", { name: "C4" })).toBe(c);
  const d = screen.getByRole("button", { name: "D4" });
  fireEvent.keyDown(d, { key: "Enter" });
  fireEvent.keyUp(d, { key: "Enter" });
  await tick(0.3);
  expect(screen.getByText("rollDone")).toBeTruthy();
  expect(complete).toHaveBeenCalledExactlyOnceWith(true, { from: 0, to: 0 });
  expect(screen.getByText("rollSimulated", { exact: true })).toBeTruthy();
  await tick(1);
  expect(complete).toHaveBeenCalledTimes(1);
});
it("ignores guide echoes and never records listening as a piano run", async () => {
  await mount();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "rollListen" }));
  });
  await start();
  await act(async () => {
    listeners.forEach((cb) =>
      cb({
        kind: "noteOn",
        pitch: 60,
        velocity: 80,
        simulated: true,
      } as MidiEvent),
    );
  });
  await tick(3.5);
  expect(screen.getByText("rollHeard")).toBeTruthy();
  expect(complete).not.toHaveBeenCalled();
  expect(play).toHaveBeenCalledWith(60, true);
});
it("pauses on blur and MIDI reset, releases owned audio and cleans subscriptions", async () => {
  await mount();
  await start();
  await tick(1);
  fireEvent(window, new Event("blur"));
  expect(screen.getByText("rollPaused")).toBeTruthy();
  expect(stop).toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /rollResume/ }));
  });
  await act(async () => {
    resets.forEach((cb) => cb());
  });
  expect(screen.getByText("rollPaused")).toBeTruthy();
  cleanup();
  await act(async () => {});
  expect(listeners.size).toBe(0);
  expect(resets.size).toBe(0);
  expect(dispose).toHaveBeenCalled();
});
it("cannot convert a mixed simulated and physical run into real piano evidence", async () => {
  await mount();
  await start();
  await tick(3.1);
  await act(async () => {
    listeners.forEach((cb) =>
      cb({
        kind: "noteOn",
        pitch: 60,
        velocity: 80,
        simulated: false,
      } as MidiEvent),
    );
  });
  await tick(0.25);
  const d = screen.getByRole("button", { name: "D4" });
  fireEvent.keyDown(d, { key: "Enter" });
  fireEvent.keyUp(d, { key: "Enter" });
  await tick(0.3);
  expect(complete).toHaveBeenCalledExactlyOnceWith(true, { from: 0, to: 0 });
});

it("records a completed physical-input run without a simulated answer", async () => {
  await mount();
  await start();
  await tick(3.1);
  await act(async () => {
    listeners.forEach((cb) =>
      cb({
        kind: "noteOn",
        pitch: 60,
        velocity: 80,
        simulated: false,
      } as MidiEvent),
    );
  });
  await tick(0.25);
  await act(async () => {
    listeners.forEach((cb) =>
      cb({
        kind: "noteOn",
        pitch: 62,
        velocity: 80,
        simulated: false,
      } as MidiEvent),
    );
  });
  await tick(0.3);
  expect(complete).toHaveBeenCalledExactlyOnceWith(false, { from: 0, to: 0 });
});
it("retains a finished result when saving fails and retries only on request", async () => {
  complete.mockReturnValueOnce(false).mockReturnValue(true);
  await mount();
  await start();
  await tick(3.1);
  let key = screen.getByRole("button", { name: "C4" });
  fireEvent.keyDown(key, { key: "Enter" });
  fireEvent.keyUp(key, { key: "Enter" });
  await tick(0.25);
  key = screen.getByRole("button", { name: "D4" });
  fireEvent.keyDown(key, { key: "Enter" });
  fireEvent.keyUp(key, { key: "Enter" });
  await tick(0.3);
  expect(screen.getByText("rollSaveError")).toBeTruthy();
  expect(complete).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "rollRetrySave" }));
  expect(complete).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("rollSaveError")).toBeNull();
});

it("does not start after an audio unlock resolves while the window is blurred", async () => {
  let finish: () => void = () => undefined;
  arm.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await start();
  fireEvent(window, new Event("blur"));
  await act(async () => {
    finish();
  });
  expect(screen.getByRole("button", { name: /rollStart/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "rollPause" })).toBeNull();
});

it("records the edited practice range rather than the editor default", async () => {
  await mount({
    ...song,
    notes: [{ id: "later", pitch: 60, start: 16, dur: 1, hand: "R" }],
  });
  await act(async () => {
    fireEvent.change(screen.getByRole("combobox", { name: "playTo" }), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "playFrom" }), {
      target: { value: "1" },
    });
  });
  await start();
  await tick(3.1);
  const key = screen.getByRole("button", { name: "C4" });
  fireEvent.keyDown(key, { key: "Enter" });
  fireEvent.keyUp(key, { key: "Enter" });
  await tick(0.3);
  expect(complete).toHaveBeenCalledExactlyOnceWith(true, { from: 1, to: 1 });
});
