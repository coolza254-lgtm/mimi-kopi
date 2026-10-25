import { invoke, isTauri } from "@tauri-apps/api/core";

export type CapabilityStatus = "supported" | "not_supported" | "not_yet_tested";

/** Mirrors `AppInfo` in src-tauri/src/lib.rs. */
export interface AppInfo {
  version: string;
  phase: number;
  hardwareVerified: boolean;
  capabilities: {
    noteOnOff: CapabilityStatus;
    velocity: CapabilityStatus;
    sustainCc64: CapabilityStatus;
    polyphony: CapabilityStatus;
  };
}

/** Returns null when the UI runs in a plain browser (e.g. `npm run dev`). */
export async function fetchAppInfo(): Promise<AppInfo | null> {
  if (!isTauri()) return null;
  return invoke<AppInfo>("app_info");
}
