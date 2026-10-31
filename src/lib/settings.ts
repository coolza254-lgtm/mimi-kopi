import type { Locale } from "../i18n/messages";

export type Theme = "light" | "dark";

export interface Settings {
  locale: Locale;
  theme: Theme;
  /** Look for a new version when the app starts (only reads GitHub Releases). */
  autoUpdate: boolean;
  uiSounds: boolean;
}

export const defaultSettings: Settings = { locale: "th", theme: "light", autoUpdate: true, uiSounds: true };

const KEY = "mimi-kopi.settings";

// Phase 0 keeps these UI settings in localStorage. They move to the
// SQLite app_settings table (spec §9.1) once persistence exists.
export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: parsed.locale === "en" || parsed.locale === "ja" || parsed.locale === "th" ? parsed.locale : defaultSettings.locale,
      theme: parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : defaultSettings.theme,
      autoUpdate: typeof parsed.autoUpdate === "boolean" ? parsed.autoUpdate : defaultSettings.autoUpdate,
      uiSounds: typeof parsed.uiSounds === "boolean" ? parsed.uiSounds : defaultSettings.uiSounds,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable or full; the app still works with defaults.
  }
}
