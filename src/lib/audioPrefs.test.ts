import { describe, expect, it } from "vitest";
import { defaultAudioPrefs, defaultTone, loadAudioPrefs, saveAudioPrefs } from "./audioPrefs";

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
    expect(loadAudioPrefs(storage)).toEqual({
      ...defaultAudioPrefs,
      outputDevice: "Headphones",
      soundFontPath: "C:\\Piano\\grand.sf2",
    });
    saveAudioPrefs({ soundFontPath: null }, storage);
    expect(loadAudioPrefs(storage).soundFontPath).toBeNull();
  });

  it("remembers volume and tone", () => {
    const storage = memoryStorage();
    const tone = { touch: "fixed" as const, fixedVelocity: 70, reverb: 40, brightness: 60 };
    saveAudioPrefs({ master: 55, tone }, storage);
    expect(loadAudioPrefs(storage)).toMatchObject({ master: 55, piano: 80, tone });
  });

  it("falls back to defaults for missing or bad data", () => {
    expect(loadAudioPrefs(memoryStorage())).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs({ getItem: () => "nope" })).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs({ getItem: () => JSON.stringify({ outputDevice: 3, soundFontPath: "  " }) })).toEqual(defaultAudioPrefs);
    expect(loadAudioPrefs(undefined)).toEqual(defaultAudioPrefs);
  });

  it("clamps numbers and rejects unknown touch modes", () => {
    const raw = JSON.stringify({ master: 300, piano: "loud", tone: { touch: "feather", fixedVelocity: 0, reverb: -5, brightness: 12.6 } });
    const prefs = loadAudioPrefs({ getItem: () => raw });
    expect(prefs.master).toBe(100);
    expect(prefs.piano).toBe(defaultAudioPrefs.piano);
    expect(prefs.tone).toEqual({ touch: defaultTone.touch, fixedVelocity: 1, reverb: 0, brightness: 13 });
  });

  it("ignores storage write failures", () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    expect(() => saveAudioPrefs({ outputDevice: "x" }, broken)).not.toThrow();
  });
});
