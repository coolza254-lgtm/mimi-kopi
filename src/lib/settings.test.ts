import { describe, expect, it } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "./settings";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("settings", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    saveSettings({ locale: "ja", theme: "dark", autoUpdate: false }, storage);
    expect(loadSettings(storage)).toEqual({ locale: "ja", theme: "dark", autoUpdate: false });
  });

  it("falls back to defaults for missing, invalid or unreadable data", () => {
    expect(loadSettings(memoryStorage())).toEqual(defaultSettings);
    expect(loadSettings({ getItem: () => "{not json" })).toEqual(defaultSettings);
    expect(loadSettings({ getItem: () => JSON.stringify({ locale: "fr", theme: "blue", autoUpdate: "yes" }) })).toEqual(defaultSettings);
    expect(loadSettings({ getItem: () => { throw new Error("blocked"); } })).toEqual(defaultSettings);
    expect(loadSettings(undefined)).toEqual(defaultSettings);
  });

  it("keeps older saved settings and turns update checks on for them", () => {
    expect(loadSettings({ getItem: () => JSON.stringify({ locale: "en", theme: "dark" }) })).toEqual({
      locale: "en",
      theme: "dark",
      autoUpdate: true,
    });
  });

  it("ignores storage write failures", () => {
    expect(() => saveSettings(defaultSettings, { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });
});
