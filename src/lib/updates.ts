// In-app updates (docs/decisions/0001-in-app-updates.md). The updater plugin
// reads latest.json from the newest GitHub Release and only installs packages
// signed with the key whose public half is in tauri.conf.json.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface InstallProgress {
  phase: "downloading" | "installing" | "restarting";
  percent: number | null;
  receivedBytes: number;
  totalBytes: number | null;
}

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; version: string; progress: InstallProgress }
  | { kind: "error"; message: string };

export async function findUpdate(): Promise<UpdateState> {
  try {
    const update = await check();
    return update ? { kind: "available", update } : { kind: "current" };
  } catch (e) {
    return { kind: "error", message: String(e) };
  }
}

/** Percent of the download done, or null while the size is unknown. */
export function progress(received: number, total: number | undefined): number | null {
  if (!total || total <= 0 || !Number.isFinite(total) || !Number.isFinite(received)) return null;
  return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
}

/** Downloads, verifies and installs, then restarts into the new version.
 * On Windows the installer closes the app itself before relaunch runs. */
export async function installUpdate(update: Update, onProgress: (state: InstallProgress) => void): Promise<void> {
  let total: number | undefined;
  let received = 0;
  const report = (phase: InstallProgress["phase"]) => onProgress({
    phase,
    percent: phase === "downloading" ? progress(received, total) : null,
    receivedBytes: received,
    totalBytes: total ?? null,
  });
  report("downloading");
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      const length = event.data.contentLength;
      total = length && Number.isFinite(length) && length > 0 ? length : undefined;
      received = 0;
    }
    if (event.event === "Progress" && Number.isFinite(event.data.chunkLength) && event.data.chunkLength > 0) {
      received += event.data.chunkLength;
    }
    report(event.event === "Finished" ? "installing" : "downloading");
  });
  report("restarting");
  await relaunch();
}
