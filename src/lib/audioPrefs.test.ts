import { describe, expect, it } from "vitest";
import { defaultAudioPrefs, loadAudioPrefs, saveAudioPrefs } from "./audioPrefs";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("audio prefs", () => {
  it("merges partial changes", () => {
    const storage = memoryStorage();
    saveAudioPrefs({ outputDevice: "Headphones" }, storage);
    saveAudioPrefs({ soundFontPath: "C:\\Piano\\grand.sf2" }, storage);
    expect(loadAudioPrefs(storage)).toEqual({ outputDevice: "Headphones", soundFontPath: "C:\\Piano\\grand.sf2" });
    saveAudioPrefs({ soundFontPath: null }, storage);
    expect(loadAudioPrefs(storage).soundFontPath).toBeNull();
  });

  it("falls back to defaults for missing or bad data", () => {
    expect(loadAudioPrefs(memoryStorage())).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs({ getItem: () => "nope" })).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs({ getItem: () => JSON.stringify({ outputDevice: 3, soundFontPath: "  " }) })).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs(undefined)).toEqual(defaultAudioPrefs);
  });

  it("ignores storage write failures", () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    expect(() => saveAudioPrefs({ outputDevice: "x" }, broken)).not.toThrow();
  });
});
