// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiEvent } from "../lib/backend";
import FreePlay from "./FreePlay";

const { desktop, listeners, resetListeners, simulate, audioStatus, subscribeMidi, subscribeReset, setTone, setGain, useBasic } = vi.hoisted(() => ({
  desktop: vi.fn(),
  listeners: new Set<(event: MidiEvent) => void>(),
  resetListeners: new Set<() => void>(),
  simulate: vi.fn().mockResolvedValue(undefined),
  audioStatus: vi.fn(),
  subscribeMidi: vi.fn(),
  subscribeReset: vi.fn(),
  setTone: vi.fn(),
  setGain: vi.fn(),
  useBasic: vi.fn(),
}));

vi.mock("../lib/backend", () => ({
  inDesktopApp: desktop,
  backend: {
    audioStatus,
    onMidiEvent: subscribeMidi,
    onMidiReset: subscribeReset,
    midiSimulate: simulate,
    audioSetTone: setTone,
    audioSetGain: setGain,
    audioUseBasic: useBasic,
  },
}));

const mount = async () => {
  const openSound = vi.fn();
  await act(async () => { render(<StrictMode><FreePlay t={(key) => key} onOpenSound={openSound} /></StrictMode>); });
  simulate.mockReset().mockResolvedValue(undefined);
  return openSound;
};
const hold = () => {
  fireEvent.click(screen.getByRole("button", { name: "freePedal" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "C4" }), { key: " " });
};

beforeEach(() => {
  localStorage.clear();
  desktop.mockReturnValue(true);
  simulate.mockClear();
  listeners.clear();
  resetListeners.clear();
  audioStatus.mockReset().mockResolvedValue({ instrument: "basic", error: null });
  subscribeMidi.mockReset().mockImplementation(async (handler: (event: MidiEvent) => void) => {
    const listener = (event: MidiEvent) => handler(event);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  });
  subscribeReset.mockReset().mockImplementation(async (handler: () => void) => {
    resetListeners.add(handler);
    return () => { resetListeners.delete(handler); };
  });
  setTone.mockReset().mockResolvedValue(undefined);
  setGain.mockReset().mockResolvedValue(undefined);
  useBasic.mockReset().mockResolvedValue({ instrument: "basic", error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("free piano error recovery", () => {
  it("releases the pedal state when retrying a failed pedal-on command", async () => {
    await mount();
    simulate.mockRejectedValueOnce(new Error("Input unavailable"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freePedal" })); });
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("freeInputError");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(simulate).toHaveBeenLastCalledWith([0xb0, 64, 0]);
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an audio error only when needed and can retry or open Sound & MIDI", async () => {
    audioStatus.mockRejectedValue(new Error("Output unavailable"));
    const openSound = await mount();
    expect(screen.getByRole("alert").textContent).toContain("freeSoundError");
    fireEvent.click(screen.getByRole("button", { name: "midiConnectionOpen" }));
    expect(openSound).toHaveBeenCalledOnce();
    audioStatus.mockResolvedValue({ instrument: "basic", error: null });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries a failed sound selection without clearing the error just because status was readable", async () => {
    await mount();
    useBasic.mockRejectedValue(new Error("Cannot load sound"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "instrumentBasic" })); });
    expect(screen.getByRole("alert").textContent).toContain("freeSoundError");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(screen.getByRole("alert").textContent).toContain("freeSoundError");
    useBasic.mockResolvedValue({ instrument: "basic", error: null });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports settings persistence failure and retries the current settings", async () => {
    await mount();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "toneReset" })); });
    expect(screen.getByRole("alert").textContent).toContain("freePrefsError");
    write.mockRestore();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(JSON.parse(localStorage.getItem("mimi-kopi.audio")!).tone.touch).toBe("natural");
  });

  it("retries MIDI subscriptions after a rejected connection", async () => {
    subscribeMidi.mockRejectedValue(new Error("Cannot listen"));
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("freeInputError");
    subscribeMidi.mockImplementation(async () => vi.fn());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "freeRetry" })); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("handles rejected subscription and status promises after unmount", async () => {
    const rejectLater: ((reason: Error) => void)[] = [];
    audioStatus.mockImplementation(() => new Promise((_resolve, reject) => { rejectLater.push(reject); }));
    subscribeMidi.mockImplementation(() => new Promise((_resolve, reject) => { rejectLater.push(reject); }));
    subscribeReset.mockImplementation(() => new Promise((_resolve, reject) => { rejectLater.push(reject); }));
    await mount();
    expect(rejectLater).toHaveLength(6);
    await act(async () => cleanup());
    await act(async () => { rejectLater.forEach((reject) => reject(new Error("Disconnected"))); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("unsubscribes registrations whose promises resolve after unmount", async () => {
    const resolveLater: ((stop: () => void) => void)[] = [];
    subscribeMidi.mockImplementation(() => new Promise((resolve) => { resolveLater.push(resolve); }));
    subscribeReset.mockImplementation(() => new Promise((resolve) => { resolveLater.push(resolve); }));
    await mount();
    await act(async () => cleanup());
    const stops = resolveLater.map(() => vi.fn());
    await act(async () => { resolveLater.forEach((resolve, i) => resolve(stops[i])); });
    stops.forEach((stop) => expect(stop).toHaveBeenCalledOnce());
  });
});

describe("free piano input cleanup", () => {
  it("releases held screen notes and sustain on blur and resets the pedal button", async () => {
    await mount();
    hold();
    expect(simulate).toHaveBeenCalledWith([0xb0, 64, 127]);
    expect(simulate).toHaveBeenCalledWith([0x90, 60, 90]);
    fireEvent.blur(window);
    expect(simulate).toHaveBeenCalledWith([0x80, 60, 0]);
    expect(simulate).toHaveBeenLastCalledWith([0xb0, 64, 0]);
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "freePedal" }));
    expect(simulate).toHaveBeenLastCalledWith([0xb0, 64, 127]);
  });

  it("clears screen input on MIDI reset and removes its subscriptions on unmount", async () => {
    await mount();
    expect(listeners.size).toBe(1);
    expect(resetListeners.size).toBe(1);
    hold();
    await act(async () => { resetListeners.forEach((handler) => handler()); });
    expect(simulate).toHaveBeenCalledWith([0x80, 60, 0]);
    expect(simulate).toHaveBeenLastCalledWith([0xb0, 64, 0]);
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyUp(screen.getByRole("button", { name: "C4" }), { key: " " });
    hold();
    simulate.mockClear();
    await act(async () => cleanup());
    expect(simulate).toHaveBeenCalledWith([0x80, 60, 0]);
    expect(simulate).toHaveBeenLastCalledWith([0xb0, 64, 0]);
    expect(listeners.size).toBe(0);
    expect(resetListeners.size).toBe(0);
  });

  it("clears the simulated pedal and keys on blur without calling the native backend", async () => {
    desktop.mockReturnValue(false);
    await mount();
    hold();
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "C4" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.blur(window);
    expect(screen.getByRole("button", { name: "freePedal" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "C4" }).getAttribute("aria-pressed")).toBe("false");
    expect(simulate).not.toHaveBeenCalled();
  });
});
