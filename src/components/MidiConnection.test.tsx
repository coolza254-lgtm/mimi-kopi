// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../i18n/messages";
import type { MidiStatus } from "../lib/backend";
import MidiConnection from "./MidiConnection";

const { desktop, readStatus, listenStatus, listeners } = vi.hoisted(() => ({
  desktop: vi.fn(() => true),
  readStatus: vi.fn<() => Promise<MidiStatus>>(),
  listenStatus: vi.fn<(handler: (status: MidiStatus) => void) => Promise<() => void>>(),
  listeners: new Set<(status: MidiStatus) => void>(),
}));

vi.mock("../lib/backend", () => ({
  inDesktopApp: desktop,
  backend: { midiStatus: readStatus, onMidiStatus: listenStatus },
}));

const disconnected: MidiStatus = {
  connected: null,
  wanted: null,
  error: null,
  capabilities: { noteOnOff: "not_yet_tested", velocity: "not_yet_tested", sustainCc64: "not_yet_tested", polyphony: "not_yet_tested" },
};
const connected: MidiStatus = { ...disconnected, connected: "Digital Piano", wanted: "Digital Piano" };
const t = (key: keyof typeof en) => en[key];
const update = (status: MidiStatus) => act(() => listeners.forEach((handler) => handler(status)));
const mount = async (onOpenSound?: () => void) => {
  let result!: ReturnType<typeof render>;
  await act(async () => { result = render(<MidiConnection t={t} onOpenSound={onOpenSound} />); });
  return result;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  desktop.mockReset().mockReturnValue(true);
  readStatus.mockReset().mockResolvedValue(disconnected);
  listenStatus.mockReset().mockImplementation(async (handler) => {
    const subscription = (status: MidiStatus) => handler(status);
    listeners.add(subscription);
    return () => { listeners.delete(subscription); };
  });
  listeners.clear();
});
afterEach(() => cleanup());

describe("MIDI connection guidance", () => {
  it("identifies a browser as simulation without calling native MIDI APIs", async () => {
    desktop.mockReturnValue(false);
    await mount(vi.fn());
    expect(screen.getByText(en.midiConnectionSimulated)).toBeTruthy();
    expect(screen.getByText(en.midiConnectionBrowserHint)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(readStatus).not.toHaveBeenCalled();
    expect(listenStatus).not.toHaveBeenCalled();
  });

  it("keeps an unknown state honest and offers the actual Sound & MIDI action", async () => {
    readStatus.mockReturnValue(new Promise(() => undefined));
    const onOpenSound = vi.fn();
    await mount(onOpenSound);
    expect(screen.getByText(en.midiConnectionChecking)).toBeTruthy();
    expect(screen.queryByText(en.midiConnectionConnected)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.midiConnectionOpen }));
    expect(onOpenSound).toHaveBeenCalledTimes(1);
  });

  it("shows setup guidance for a disconnected piano even without a navigation callback", async () => {
    await mount();
    expect(screen.getByText(en.midiConnectionDisconnected)).toBeTruthy();
    expect(screen.getByText(en.midiConnectionHelp)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows only the connected device, then follows real disconnect, reconnect and error events", async () => {
    readStatus.mockResolvedValue({ ...connected, capabilities: {
      noteOnOff: "supported", velocity: "supported", sustainCc64: "supported", polyphony: "supported",
    } });
    const { container } = await mount(vi.fn());
    expect(screen.getByText("Digital Piano")).toBeTruthy();
    expect(screen.getByText(en.midiConnectionConnected)).toBeTruthy();
    expect(screen.queryByText(en.capVelocity)).toBeNull();
    expect(screen.queryByText(en.midiConnectionHelp)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    update({ ...disconnected, wanted: "Digital Piano" });
    expect(screen.getByText(en.midiConnectionWaiting)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.midiConnectionOpen })).toBeTruthy();
    update({ ...disconnected, error: "Device unavailable" });
    expect(container.querySelector(".midi-connection.error")).toBeTruthy();
    expect(screen.getByText(en.midiConnectionError)).toBeTruthy();
    update(connected);
    expect(screen.getByText("Digital Piano")).toBeTruthy();
  });

  it("shows a read failure without claiming disconnection and can recover from a live status event", async () => {
    readStatus.mockRejectedValue(new Error("IPC unavailable"));
    await mount();
    expect(screen.getByText(en.midiConnectionError)).toBeTruthy();
    expect(screen.queryByText(en.midiConnectionDisconnected)).toBeNull();
    update(connected);
    expect(screen.getByText(en.midiConnectionConnected)).toBeTruthy();
  });

  it("does not let an older initial snapshot or its failure overwrite a newer live status", async () => {
    const snapshot = deferred<MidiStatus>();
    readStatus.mockReturnValue(snapshot.promise);
    await mount();
    update(connected);
    await act(async () => snapshot.resolve(disconnected));
    expect(screen.getByText("Digital Piano")).toBeTruthy();
    cleanup();
    const failedSnapshot = deferred<MidiStatus>();
    readStatus.mockReturnValue(failedSnapshot.promise);
    await mount();
    update(connected);
    await act(async () => failedSnapshot.reject(new Error("Late failure")));
    expect(screen.getByText("Digital Piano")).toBeTruthy();
    expect(screen.queryByText(en.midiConnectionError)).toBeNull();
  });

  it("handles subscription failure and guides the user to check their connection", async () => {
    listenStatus.mockRejectedValue(new Error("Could not listen"));
    await mount(vi.fn());
    expect(screen.getByText(en.midiConnectionError)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.midiConnectionOpen })).toBeTruthy();
    expect(readStatus).not.toHaveBeenCalled();
  });

  it("cleans up both late StrictMode subscriptions and ignores events after disposal", async () => {
    const registrations: ReturnType<typeof deferred<() => void>>[] = [];
    const callbacks: ((status: MidiStatus) => void)[] = [];
    listenStatus.mockImplementation((handler) => {
      callbacks.push(handler);
      const pending = deferred<() => void>();
      registrations.push(pending);
      return pending.promise;
    });
    const { unmount } = render(<StrictMode><MidiConnection t={t} /></StrictMode>);
    expect(registrations).toHaveLength(2);
    unmount();
    const stops = registrations.map(() => vi.fn());
    await act(async () => {
      registrations.forEach((pending, index) => pending.resolve(stops[index]));
      callbacks.forEach((callback) => callback(connected));
    });
    for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1);
    expect(readStatus).not.toHaveBeenCalled();
  });

  it("retains one active subscription in StrictMode and removes it on unmount", async () => {
    await act(async () => { render(<StrictMode><MidiConnection t={t} /></StrictMode>); });
    expect(listeners.size).toBe(1);
    expect(readStatus).toHaveBeenCalledTimes(1);
    await act(async () => cleanup());
    expect(listeners.size).toBe(0);
  });
});
