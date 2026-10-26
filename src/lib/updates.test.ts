import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { findUpdate, installUpdate, progress, type InstallProgress } from "./updates";

const { check, relaunch } = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));
const updateWith = (downloadAndInstall: (receive: (event: DownloadEvent) => void) => Promise<void>) => ({ downloadAndInstall }) as Update;
beforeEach(() => { check.mockReset(); relaunch.mockReset().mockResolvedValue(undefined); });

describe("update progress", () => {
  it("is unknown until the size is known", () => {
    for (const total of [undefined, 0, -1, NaN, Infinity]) expect(progress(500, total)).toBeNull();
    expect(progress(NaN, 1000)).toBeNull();
    expect(progress(Infinity, 1000)).toBeNull();
  });

  it("rounds and never passes 100", () => {
    expect(progress(1, 3)).toBe(33);
    expect(progress(4, 3)).toBe(100);
    expect(progress(-1, 3)).toBe(0);
  });

  it("reports actual bytes and waits for Finished before entering installation", async () => {
    const states: InstallProgress[] = [];
    const update = updateWith(async (receive) => {
      receive({ event: "Started", data: { contentLength: 1000 } });
      receive({ event: "Progress", data: { chunkLength: 400 } });
      receive({ event: "Progress", data: { chunkLength: 600 } });
      expect(states.at(-1)).toEqual({ phase: "downloading", percent: 100, receivedBytes: 1000, totalBytes: 1000 });
      receive({ event: "Finished" });
      expect(states.at(-1)?.phase).toBe("installing");
      expect(relaunch).not.toHaveBeenCalled();
    });
    await installUpdate(update, (state) => states.push(state));
    expect(states).toContainEqual({ phase: "downloading", percent: 40, receivedBytes: 400, totalBytes: 1000 });
    expect(states.at(-1)).toEqual({ phase: "restarting", percent: null, receivedBytes: 1000, totalBytes: 1000 });
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("stays indeterminate when the server omits Content-Length", async () => {
    const states: InstallProgress[] = [];
    await installUpdate(updateWith(async (receive) => {
      receive({ event: "Started", data: {} });
      receive({ event: "Progress", data: { chunkLength: 2048 } });
      receive({ event: "Finished" });
    }), (state) => states.push(state));
    expect(states.filter((state) => state.phase === "downloading").every((state) => state.percent === null && state.totalBytes === null)).toBe(true);
    expect(states).toContainEqual({ phase: "downloading", percent: null, receivedBytes: 2048, totalBytes: null });
  });

  it("never relaunches after a download or installation failure", async () => {
    for (const afterDownload of [false, true]) {
      const states: InstallProgress[] = [];
      const update = updateWith(async (receive) => {
        if (afterDownload) receive({ event: "Finished" });
        throw new Error("Update failed");
      });
      await expect(installUpdate(update, (state) => states.push(state))).rejects.toThrow("Update failed");
      expect(states.some((state) => state.phase === "restarting")).toBe(false);
      expect(relaunch).not.toHaveBeenCalled();
    }
  });
});

describe("finding updates", () => {
  it("preserves the actual release, no-update result and check failure", async () => {
    const update = { version: "test-version" };
    check.mockResolvedValueOnce(update).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Offline"));
    expect(await findUpdate()).toEqual({ kind: "available", update });
    expect(await findUpdate()).toEqual({ kind: "current" });
    expect(await findUpdate()).toEqual({ kind: "error", message: "Error: Offline" });
  });
});
