// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "../i18n/messages";
import type { MidiEvent } from "../lib/backend";
import PlaySongs from "./PlaySongs";

const { desktop, send, listeners, resets } = vi.hoisted(() => ({ desktop: vi.fn(() => false), send: vi.fn(async () => {}), listeners: new Set<(e: MidiEvent) => void>(), resets: new Set<() => void>() }));
vi.mock("../lib/backend", () => ({ inDesktopApp: desktop, backend: {
  midiSimulate: send,
  onMidiEvent: async (cb: (e: MidiEvent) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  onMidiReset: async (cb: () => void) => { resets.add(cb); return () => { resets.delete(cb); }; },
} }));
let clock = 0;
let animation: FrameRequestCallback | null = null;
beforeEach(() => {
  desktop.mockReturnValue(false); send.mockClear(); listeners.clear(); resets.clear(); clock = 0; animation = null;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { animation = cb; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { animation = null; }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const tick = (ms: number) => { clock += ms; act(() => { animation?.(clock); }); };
const t = (key: keyof typeof en) => en[key];
const open = () => fireEvent.click(screen.getAllByRole("button", { name: en.songsOpen })[0]);

it("shows the catalog, enters focus, pauses on blur, resumes without resetting and exits cleanly", () => {
  const focus = vi.fn();
  render(<PlaySongs t={t} locale="en" onFocusChange={focus} />);
  expect(screen.getAllByRole("button", { name: en.songsOpen })).toHaveLength(3);
  open(); expect(focus).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText(en.songsHands), { target: { value: "both" } });
  expect(document.querySelector(".falling-bar.hand-left")).not.toBeNull();
  expect(document.querySelector(".falling-bar.hand-right")).not.toBeNull();
  fireEvent.change(screen.getByLabelText(en.songsHands), { target: { value: "right" } });
  expect(document.querySelector(".falling-bar.hand-left")).toBeNull();
  expect(screen.getByText(en.songsBrowser)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: en.songsStart }));
  tick(5000);
  expect(Number(screen.getByRole("progressbar").getAttribute("value"))).toBeCloseTo(1);
  fireEvent.blur(window);
  expect(screen.getByRole("button", { name: en.songsResume })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: en.songsResume }));
  tick(1000);
  expect(Number(screen.getByRole("progressbar").getAttribute("value"))).toBeCloseTo(2);
  fireEvent.click(screen.getByRole("button", { name: en.songsBack }));
  expect(focus).toHaveBeenLastCalledWith(false);
  expect(send).not.toHaveBeenCalled();
});
it("releases guide notes and screen notes on pause, reset and unmount, and unsubscribes native events", async () => {
  desktop.mockReturnValue(true);
  const app = render(<PlaySongs t={t} locale="en" />);
  open(); await act(async () => {});
  fireEvent.click(screen.getByRole("checkbox", { name: en.songsGuide }));
  fireEvent.click(screen.getByRole("button", { name: en.songsStart }));
  tick(4000);
  expect(send).toHaveBeenCalledWith([0x90, 60, 84]);
  fireEvent.click(screen.getByRole("button", { name: en.songsPause }));
  expect(send).toHaveBeenCalledWith([0x80, 60, 0]);
  fireEvent.keyDown(screen.getByLabelText("D4", { exact: true }), { key: "Enter" });
  expect(send).toHaveBeenCalledWith([0x90, 62, 84]);
  act(() => { resets.forEach((cb) => cb()); });
  expect(send).toHaveBeenCalledWith([0x80, 62, 0]);
  app.unmount(); await act(async () => {});
  expect(listeners.size).toBe(0); expect(resets.size).toBe(0); expect(animation).toBeNull();
});
it("finishes at the actual song end and restarts with a lead-in", () => {
  render(<PlaySongs t={t} locale="en" />); open();
  fireEvent.click(screen.getByRole("button", { name: en.songsStart })); tick(100000);
  expect(screen.getByText(en.songsFinished)).toBeTruthy();
  const progress = screen.getByRole("progressbar");
  expect(progress.getAttribute("value")).toBe(progress.getAttribute("max"));
  fireEvent.click(screen.getAllByRole("button", { name: en.songsRestart })[0]);
  expect(progress.getAttribute("value")).toBe("0");
  expect(screen.getByRole("button", { name: en.songsPause })).toBeTruthy();
});
