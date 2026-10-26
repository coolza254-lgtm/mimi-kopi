import { describe, expect, it } from "vitest";
import { locales } from "../../i18n/messages";
import { lessonGuide, lessonReview } from "./coaching";
import { lessons, type Lesson } from "./lessons";

describe("lesson coaching", () => {
  it("gives every foundation lesson a hand setup, focus and song connection in all languages", () => {
    for (const lesson of lessons) {
      const guide = lessonGuide(lesson);
      expect(guide.setup, lesson.id).not.toBe("setupSong");
      for (const locale of Object.values(locales)) {
        for (const key of [guide.setup, guide.focus, guide.transfer]) expect(locale[key].trim(), `${lesson.id}: ${key}`).not.toBe("");
      }
    }
    expect(lessonGuide(lessons.find((lesson) => lesson.id === "hands-together")!).setup).toBe("setupBothHands");
  });

  it("guides user-authored song passages without assuming an octave or hand position", () => {
    const song: Lesson = { ...lessons[0], id: "song-private-phrase", unit: "song", steps: [[36, 65]] };
    expect(lessonGuide(song)).toEqual({ setup: "setupSong", focus: "focusSong", transfer: "transferSong" });
  });

  it("gives the original phrase a separate setup for each hand and then combines the familiar positions", () => {
    const phrase = lessons.filter((lesson) => lesson.unit === "phrases");
    expect(phrase.map((lesson) => lessonGuide(lesson).setup)).toEqual([
      "setupPhraseMelody", "setupPhraseBass", "setupPhraseHands",
    ]);
    for (const lesson of phrase) {
      expect(lessonGuide(lesson)).toMatchObject({ focus: "focusPhrase", transfer: "transferPhrase" });
    }
  });

  it("never treats high simulation accuracy or absent results as evidence of piano readiness", () => {
    expect(lessonReview({ simulated: true, accuracy: 1 }).title).toBe("reviewSimulatedTitle");
    expect(lessonReview({ simulated: true, accuracy: 1 }).repeatFirst).toBe(true);
    expect(lessonReview({ simulated: false, accuracy: null }).repeatFirst).toBe(true);
  });

  it("suggests smaller steps for frequent wrong notes and recall only when note accuracy supports it", () => {
    expect(lessonReview({ simulated: false, accuracy: 0.84 }).title).toBe("reviewSlowTitle");
    expect(lessonReview({ simulated: false, accuracy: 0.85 }).title).toBe("reviewRefineTitle");
    expect(lessonReview({ simulated: false, accuracy: 0.94 }).repeatFirst).toBe(true);
    expect(lessonReview({ simulated: false, accuracy: 0.95 })).toMatchObject({ title: "reviewReadyTitle", repeatFirst: false });
  });
});
