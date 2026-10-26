import { describe, expect, it } from "vitest";
import { locales } from "../../i18n/messages";
import { PIANO_HIGH, PIANO_LOW } from "../midi/notes";
import { lessonRange, lessons, units } from "./lessons";
import { loadProgress, recordFor, stars } from "./progress";
import { playNote, startRun, summarize } from "./waitMode";

const single = (...pitches: number[]) => pitches.map((pitch) => [pitch]);
const legacySteps = {
  "landmark-c": single(60, 48, 60, 72, 60),
  "find-d-f-b": single(62, 65, 71, 74, 77, 59, 50, 53),
  "find-c-to-g": single(60, 62, 64, 65, 67, 65, 64, 62, 60),
  "five-finger-right": single(60, 62, 64, 62, 60, 64, 65, 67, 65, 64, 62, 60),
  "melody-right": single(60, 64, 62, 65, 64, 67, 65, 62, 64, 60),
  "scale-c-right": single(60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60),
  "five-finger-left": single(48, 50, 52, 53, 55, 53, 52, 50, 48),
  "melody-left": single(55, 52, 53, 50, 52, 48, 50, 53, 52, 55),
  "bass-fifths-left": [[48, 55], [53, 60], [55, 62], [48, 55], [53, 60], [55, 62], [48, 55]],
  "chords-c-g": [[60, 64, 67], [59, 62, 67], [60, 64, 67], [59, 62, 67], [60, 64, 67]],
  "chords-c-g-am-f": [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65], [60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
  "hands-together": [[48, 60, 64, 67], [43, 59, 62, 67], [45, 57, 60, 64], [41, 57, 60, 65], [48, 60, 64, 67]],
};

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

  it("has complete lesson and unit descriptions in all supported languages", () => {
    for (const locale of Object.keys(locales) as (keyof typeof locales)[]) {
      for (const lesson of lessons) {
        expect(lesson.title[locale].trim(), `${lesson.id}: title in ${locale}`).not.toBe("");
        expect(lesson.goal[locale].trim(), `${lesson.id}: goal in ${locale}`).not.toBe("");
      }
      for (const unit of units) {
        expect(unit.title[locale].trim(), `${unit.id}: title in ${locale}`).not.toBe("");
        expect(unit.blurb[locale].trim(), `${unit.id}: blurb in ${locale}`).not.toBe("");
      }
    }
  });

  it("preserves the published twelve-lesson order, ids, versions and scored notes", () => {
    expect(lessons.slice(0, 12).map((lesson) => lesson.id)).toEqual(Object.keys(legacySteps));
    for (const [id, steps] of Object.entries(legacySteps)) {
      expect(lessons.find((lesson) => lesson.id === id)).toMatchObject({ version: 1, steps });
    }
  });

  it("preserves saved piano history and gives new phrase lessons a fresh record", () => {
    const saved = Object.fromEntries(Object.keys(legacySteps).map((id) => [id, {
      version: 1,
      pianoRuns: 2,
      screenRuns: 1,
      bestAccuracy: 0.97,
      bestTimeMs: 5000,
      lastPlayedAt: "2026-10-25T12:00:00.000Z",
    }]));
    const progress = loadProgress({ getItem: () => JSON.stringify(saved) });
    for (const lesson of lessons.slice(0, 12)) {
      expect(recordFor(progress, lesson)).toEqual(saved[lesson.id]);
      expect(stars(recordFor(progress, lesson))).toBe(3);
    }
    for (const lesson of lessons.filter((entry) => entry.unit === "phrases")) {
      expect(recordFor(progress, lesson)).toMatchObject({ version: 1, pianoRuns: 0, screenRuns: 0, bestAccuracy: null });
      expect(stars(recordFor(progress, lesson))).toBe(0);
    }
  });

  it("builds the two-hand phrase from the exact melody, bass and fingers already practised", () => {
    const phrase = lessons.filter((lesson) => lesson.unit === "phrases");
    expect(phrase.map((lesson) => lesson.id)).toEqual(["phrase-melody", "phrase-bass", "phrase-hands"]);
    expect(phrase.map((lesson) => lesson.hand)).toEqual(["right", "left", "both"]);
    const [melody, bass, both] = phrase;
    expect(both.steps.length).toBe(8);
    expect(both.steps.map((step) => step.slice(1))).toEqual(melody.steps);
    expect(both.steps.map((step) => step.slice(0, 1))).toEqual(bass.steps);
    expect(both.fingers!.map((fingers) => fingers.slice(1))).toEqual(melody.fingers);
    expect(both.fingers!.map((fingers) => fingers.slice(0, 1))).toEqual(bass.fingers);
    for (const [left, right] of both.steps) {
      expect(left >= 48 && left <= 55).toBe(true);
      expect(right >= 60 && right <= 67).toBe(true);
    }
  });

  it("can complete the original two-hand phrase with the release-and-repress method taught", () => {
    const lesson = lessons.find((entry) => entry.id === "phrase-hands")!;
    let run = startRun();
    let timeMs = 0;
    for (const [index, step] of lesson.steps.entries()) {
      run = playNote(lesson.steps, run, { kind: "noteOn", pitch: step[0], timeMs: timeMs++, simulated: false });
      expect(run.step).toBe(index);
      run = playNote(lesson.steps, run, { kind: "noteOn", pitch: step[1], timeMs: timeMs++, simulated: false });
      expect(run.step).toBe(index + 1);
      for (const pitch of step) run = playNote(lesson.steps, run, { kind: "noteOff", pitch, timeMs: timeMs++, simulated: false });
    }
    expect(run.finishedAtMs).not.toBeNull();
    expect(run.correctNotes).toBe(16);
    expect(run.wrongPresses).toBe(0);
    expect(summarize(run).accuracy).toBe(1);
  });

  it("widens the keyboard to whole octaves only when needed", () => {
    expect(lessonRange(lessons.find((l) => l.id === "find-c-to-g")!)).toEqual({ low: 48, high: 84 });
    expect(lessonRange(lessons.find((l) => l.id === "hands-together")!)).toEqual({ low: 36, high: 84 });
  });
});
