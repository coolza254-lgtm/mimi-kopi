import { describe, expect, it } from "vitest";
import { PIANO_HIGH, PIANO_LOW } from "../midi/notes";
import { lessonRange, lessons, units } from "./lessons";

describe("lesson content", () => {
  it("has unique ids and belongs to a known unit", () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const l of lessons) expect(units.map((u) => u.id)).toContain(l.unit);
  });

  it("has playable steps with matching finger numbers", () => {
    for (const l of lessons) {
      expect(l.steps.length, l.id).toBeGreaterThan(0);
      for (const step of l.steps) {
        expect(step.length, l.id).toBeGreaterThan(0);
        expect(new Set(step).size, `${l.id}: no repeated pitch in a step`).toBe(step.length);
        for (const p of step) expect(p >= PIANO_LOW && p <= PIANO_HIGH, `${l.id}: ${p}`).toBe(true);
      }
      if (l.fingers) {
        expect(l.fingers.length, l.id).toBe(l.steps.length);
        l.fingers.forEach((f, i) => {
          expect(f.length, `${l.id} step ${i}`).toBe(l.steps[i].length);
          for (const n of f) expect(n >= 1 && n <= 5, l.id).toBe(true);
        });
      }
    }
  });

  it("widens the keyboard to whole octaves only when needed", () => {
    expect(lessonRange(lessons.find((l) => l.id === "find-c-to-g")!)).toEqual({ low: 48, high: 84 });
    expect(lessonRange(lessons.find((l) => l.id === "hands-together")!)).toEqual({ low: 36, high: 84 });
  });
});
