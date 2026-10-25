// Remembers the chosen output device, piano sound, volume and tone so they
// come back when the app starts. Like the UI settings, this moves to SQLite
// (spec §9.1) later.

export type Touch = "natural" | "light" | "heavy" | "fixed";

export interface TonePrefs {
  /** How key pressure maps to loudness; "fixed" plays every note equally. */
  touch: Touch;
  /** Level for "fixed" touch, 1–127. */
  fixedVelocity: number;
  /** 0–100. */
  reverb: number;
  /** 0–100; 100 is the instrument as recorded. */
  brightness: number;
}

export interface AudioPrefs {
  /** Output device name; null means the Windows default. */
  outputDevice: string | null;
  soundFontPath: string | null;
  /** 0–100. */
  master: number;
  piano: number;
  tone: TonePrefs;
}

export const defaultTone: TonePrefs = { touch: "natural", fixedVelocity: 90, reverb: 0, brightness: 100 };

export const defaultAudioPrefs: AudioPrefs = {
  outputDevice: null,
  soundFontPath: null,
  master: 80,
  piano: 80,
  tone: defaultTone,
};

/** Starting points for the free piano page. */
export const tonePresets: { id: "practice" | "hall" | "soft"; tone: Omit<TonePrefs, "touch" | "fixedVelocity"> }[] = [
  { id: "practice", tone: { reverb: 0, brightness: 100 } },
  { id: "hall", tone: { reverb: 45, brightness: 90 } },
  { id: "soft", tone: { reverb: 25, brightness: 35 } },
];

const KEY = "mimi-kopi.audio";
const touches: readonly Touch[] = ["natural", "light", "heavy", "fixed"];

const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);
const within = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;

function readTone(value: unknown): TonePrefs {
  const t = (value ?? {}) as Record<string, unknown>;
  return {
    touch: touches.includes(t.touch as Touch) ? (t.touch as Touch) : defaultTone.touch,
    fixedVelocity: within(t.fixedVelocity, 1, 127, defaultTone.fixedVelocity),
    reverb: within(t.reverb, 0, 100, defaultTone.reverb),
    brightness: within(t.brightness, 0, 100, defaultTone.brightness),
  };
}

export function loadAudioPrefs(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): AudioPrefs {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaultAudioPrefs;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      outputDevice: text(parsed.outputDevice),
      soundFontPath: text(parsed.soundFontPath),
      master: within(parsed.master, 0, 100, defaultAudioPrefs.master),
      piano: within(parsed.piano, 0, 100, defaultAudioPrefs.piano),
      tone: readTone(parsed.tone),
    };
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
