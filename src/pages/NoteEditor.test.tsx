// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MidiEvent } from "../lib/backend";
import type { Lesson } from "../features/lessons/lessons";
import type { LessonRecord, RunResult } from "../features/lessons/progress";
import { newSong } from "../features/score/score";
import NoteEditor from "./NoteEditor";

const { listeners, simulate, saveDialog, writeFile, renderPlayer } = vi.hoisted(() => ({
  listeners: new Set<(event: MidiEvent) => void>(),
  simulate: vi.fn().mockResolvedValue(undefined),
  saveDialog: vi.fn(),
  writeFile: vi.fn(),
  renderPlayer: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: saveDialog }));
vi.mock("../lib/backend", () => ({
  inDesktopApp: () => true,
  backend: {
    onMidiEvent: async (handler: (event: MidiEvent) => void) => {
      listeners.add(handler);
      return () => { listeners.delete(handler); };
    },
    midiSimulate: simulate,
    songFileWrite: writeFile,
  },
}));
vi.mock("./Practice", () => ({ LessonPlayer: (props: unknown) => { renderPlayer(props); return <div>Playing lesson</div>; } }));

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
  saveDialog.mockReset().mockResolvedValue("C:\\backup.json");
  writeFile.mockReset().mockResolvedValue(undefined);
  renderPlayer.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("note editor storage recovery", () => {
  const player = () => renderPlayer.mock.lastCall![0] as {
    lesson: Lesson;
    record: LessonRecord;
    historyAvailable: boolean;
    onFinish: (lesson: Lesson, result: RunResult) => boolean;
  };

  it("keeps corrupt practice history untouched even if storage becomes readable during the round", async () => {
    localStorage.setItem("mimi-kopi.lessons", "damaged history");
    await mount();
    await send();
    fireEvent.click(screen.getByRole("button", { name: /practiceThis/ }));
    expect(player().historyAvailable).toBe(false);
    const repaired = JSON.stringify({ previous: { version: 1, pianoRuns: 2, screenRuns: 0, bestAccuracy: 1, bestTimeMs: 12, lastPlayedAt: null } });
    localStorage.setItem("mimi-kopi.lessons", repaired);
    let result = true;
    await act(async () => { result = player().onFinish(player().lesson, { accuracy: 1, durationMs: 12, simulated: true }); });
    expect(result).toBe(false);
    expect(localStorage.getItem("mimi-kopi.lessons")).toBe(repaired);
    expect(player().record.screenRuns).toBe(0);
  });

  it("updates the practice record only after persistence succeeds", async () => {
    await mount();
    await send();
    fireEvent.click(screen.getByRole("button", { name: /practiceThis/ }));
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
    let result = true;
    await act(async () => { result = player().onFinish(player().lesson, { accuracy: 1, durationMs: 12, simulated: true }); });
    expect(result).toBe(false);
    expect(player().record.screenRuns).toBe(0);
    expect(localStorage.getItem("mimi-kopi.lessons")).toBeNull();
    writes.mockRestore();
    await act(async () => { result = player().onFinish(player().lesson, { accuracy: 1, durationMs: 12, simulated: true }); });
    expect(result).toBe(true);
    expect(player().record.screenRuns).toBe(1);
  });

  it("does not mount an editable replacement for damaged data and backs up the exact original", async () => {
    const raw = '[{"id":"song","notes":[';
    localStorage.setItem("mimi-kopi.songs", raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("songStorageReadError");
    expect(screen.queryByLabelText("songTitle")).toBeNull();
    expect(listeners.size).toBe(0);
    expect(writes).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "songStorageRecovery" })); });
    expect(writeFile).toHaveBeenCalledWith("C:\\backup.json", raw);
    expect(localStorage.getItem("mimi-kopi.songs")).toBe(raw);
    const restored = newSong("restored", "My restored song", new Date());
    localStorage.setItem("mimi-kopi.songs", JSON.stringify([restored]));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "songStorageRetryLoad" })); });
    expect((screen.getByLabelText("songTitle") as HTMLInputElement).value).toBe("My restored song");
    expect(listeners.size).toBe(1);
  });

  it("can retry an unavailable storage read without writing an empty song", async () => {
    const reads = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Unavailable"); });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await mount();
    expect(screen.getByRole("alert").textContent).toContain("songStorageReadError");
    expect(screen.queryByRole("button", { name: "songStorageRecovery" })).toBeNull();
    expect(writes).not.toHaveBeenCalled();
    reads.mockRestore();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "songStorageRetryLoad" })); });
    expect(screen.getByLabelText("songTitle")).toBeTruthy();
  });

  it("keeps edits in memory after a failed save, exports them, and saves the same work on retry", async () => {
    const original = newSong("original", "My song", new Date());
    const raw = JSON.stringify([original]);
    localStorage.setItem("mimi-kopi.songs", raw);
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
    await mount();
    await send();
    expect(screen.getByRole("alert").textContent).toContain("songStorageSaveError");
    expect(localStorage.getItem("mimi-kopi.songs")).toBe(raw);
    const exports = screen.getAllByRole("button", { name: "songExport" });
    await act(async () => { fireEvent.click(exports[0]); });
    expect(JSON.parse(writeFile.mock.calls[0][1]).song.notes).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toContain("songStorageSaveError");
    writes.mockRestore();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "songStorageRetrySave" })); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saved()[0].notes).toHaveLength(1);
  });

  it("preserves raw data that becomes damaged after opening while retaining new edits for export", async () => {
    await mount();
    localStorage.setItem("mimi-kopi.songs", "damaged after opening");
    await send();
    expect(localStorage.getItem("mimi-kopi.songs")).toBe("damaged after opening");
    expect(screen.getByRole("alert").textContent).toContain("songStorageSaveError");
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "songExport" })[0]); });
    expect(JSON.parse(writeFile.mock.calls[0][1]).song.notes).toHaveLength(1);
    expect(localStorage.getItem("mimi-kopi.songs")).toBe("damaged after opening");
  });

  it("preserves the raw library when its recovery file cannot be written", async () => {
    const raw = "damaged original";
    localStorage.setItem("mimi-kopi.songs", raw);
    writeFile.mockRejectedValueOnce(new Error("Disk full"));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "songStorageRecovery" })); });
    expect(screen.getByText("songStorageRecoveryFailed")).toBeTruthy();
    expect(localStorage.getItem("mimi-kopi.songs")).toBe(raw);
    expect(screen.queryByLabelText("songTitle")).toBeNull();
  });
});

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

  it("normalizes tempo input before saving so the song remains editable after reopening", async () => {
    await mount();
    fireEvent.change(screen.getByLabelText("songTempo"), { target: { value: "80.5" } });
    expect(saved()[0].tempo).toBe(81);
    await act(async () => cleanup());
    await mount();
    expect(screen.getByLabelText("songTempo")).toHaveProperty("value", "81");
    expect(screen.queryByText("editorLoadError")).toBeNull();
  });
});
