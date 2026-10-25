import { describe, expect, it } from "vitest";
import { chordName } from "./chords";

describe("chord names", () => {
  it("names root-position triads and sevenths", () => {
    expect(chordName([60, 64, 67])).toBe("C");
    expect(chordName([57, 60, 64])).toBe("Am");
    expect(chordName([55, 59, 62, 65])).toBe("G7");
    expect(chordName([59, 62, 65])).toBe("Bdim");
    expect(chordName([60, 62, 67])).toBe("Csus2");
  });

  it("ignores octave doubling and shows inversions with the bass", () => {
    expect(chordName([48, 60, 64, 67, 72])).toBe("C");
    expect(chordName([52, 55, 60])).toBe("C/E");
  });

  it("gives no name for fewer than three notes or unknown shapes", () => {
    expect(chordName([60, 64])).toBeNull();
    expect(chordName([60, 61, 62])).toBeNull();
  });
});
