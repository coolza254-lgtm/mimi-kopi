// In-app updates (docs/decisions/0001-in-app-updates.md). The updater plugin
// reads latest.json from the newest GitHub Release and only installs packages
// signed with the key whose public half is in tauri.conf.json.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; percent: number | null }
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
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((received / total) * 100));
}

/** Downloads, verifies and installs, then restarts into the new version.
 * On Windows the installer closes the app itself before relaunch runs. */
export async function installUpdate(update: Update, onProgress: (percent: number | null) => void): Promise<void> {
  let total: number | undefined;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength;
    if (event.event === "Progress") received += event.data.chunkLength;
    onProgress(event.event === "Finished" ? 100 : progress(received, total));
  });
  await relaunch();
}
