import { describe, expect, it } from "vitest";
import { isBlackKey, noteName, PIANO_HIGH, PIANO_LOW, solfege, staffStep } from "./notes";

describe("noteName", () => {
  it("uses middle C = C4", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(69)).toBe("A4");
  });

  it("covers the ends of an 88-key piano", () => {
    expect(noteName(PIANO_LOW)).toBe("A0");
    expect(noteName(PIANO_HIGH)).toBe("C8");
  });
});

describe("isBlackKey", () => {
  it("matches the piano pattern", () => {
    const octave = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey);
    expect(octave).toEqual([false, true, false, true, false, false, true, false, true, false, true, false]);
  });

  it("has 52 white keys on an 88-key piano", () => {
    let whites = 0;
    for (let p = PIANO_LOW; p <= PIANO_HIGH; p++) if (!isBlackKey(p)) whites++;
    expect(whites).toBe(52);
  });
});

describe("solfege and staff steps", () => {
  it("names notes do-re-mi in Thai and Japanese", () => {
    expect(solfege(60, "th")).toBe("โด");
    expect(solfege(67, "ja")).toBe("ソ");
    expect(solfege(61, "th")).toBe("โด♯");
    expect(solfege(71, "en")).toBe("B");
  });

  it("counts staff steps from white keys", () => {
    expect(staffStep(60)).toBe(28);
    expect(staffStep(64)).toBe(30);
    expect(staffStep(72)).toBe(35);
    expect(staffStep(61)).toBe(28);
    expect(staffStep(43)).toBe(18);
  });
});
