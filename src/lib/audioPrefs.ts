// Remembers the chosen output device and SoundFont so they come back when the
// app starts. Like the UI settings, this moves to SQLite (spec §9.1) later.

export interface AudioPrefs {
  /** Output device name; null means the Windows default. */
  outputDevice: string | null;
  soundFontPath: string | null;
}

export const defaultAudioPrefs: AudioPrefs = { outputDevice: null, soundFontPath: null };

const KEY = "mimi-kopi.audio";

const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

export function loadAudioPrefs(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): AudioPrefs {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaultAudioPrefs;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { outputDevice: text(parsed.outputDevice), soundFontPath: text(parsed.soundFontPath) };
  } catch {
    return defaultAudioPrefs;
  }
}

export function saveAudioPrefs(
  change: Partial<AudioPrefs>,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...loadAudioPrefs(storage), ...change }));
  } catch {
    // Unavailable or full storage only means the choice is not remembered.
  }
}
