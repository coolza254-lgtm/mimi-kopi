import type { MessageKey } from "../../i18n/messages";
import type { Lesson, UnitId } from "./lessons";
import type { RunResult } from "./progress";

interface LessonGuide {
  setup: MessageKey;
  focus: MessageKey;
  transfer: MessageKey;
}

const setups: Record<string, MessageKey> = {
  "landmark-c": "setupLandmarkC",
  "find-d-f-b": "setupBlackKeys",
  "find-c-to-g": "setupRightFive",
  "five-finger-right": "setupRightFive",
  "melody-right": "setupRightFive",
  "scale-c-right": "setupScaleC",
  "five-finger-left": "setupLeftFive",
  "melody-left": "setupLeftFive",
  "bass-fifths-left": "setupFifths",
  "chords-c-g": "setupChords",
  "chords-c-g-am-f": "setupChords",
  "hands-together": "setupBothHands",
  "phrase-melody": "setupPhraseMelody",
  "phrase-bass": "setupPhraseBass",
  "phrase-hands": "setupPhraseHands",
};

const focus: Record<UnitId, MessageKey> = {
  keyboard: "focusKeyboard",
  right: "focusMelody",
  left: "focusLeft",
  chords: "focusChords",
  phrases: "focusPhrase",
  song: "focusSong",
};

const transfer: Record<UnitId, MessageKey> = {
  keyboard: "transferKeyboard",
  right: "transferMelody",
  left: "transferLeft",
  chords: "transferChords",
  phrases: "transferPhrase",
  song: "transferSong",
};

/** Coaching changes presentation only; lesson steps, versions and scores stay intact. */
export function lessonGuide(lesson: Lesson): LessonGuide {
  return {
    setup: setups[lesson.id] ?? "setupSong",
    focus: focus[lesson.unit],
    transfer: transfer[lesson.unit],
  };
}

export interface LessonReview {
  title: MessageKey;
  body: MessageKey;
  repeatFirst: boolean;
}

/** Suggestions use note accuracy only. Wait-mode duration never affects advice. */
export function lessonReview(result: Pick<RunResult, "accuracy" | "simulated">): LessonReview {
  if (result.simulated || result.accuracy === null) {
    return { title: "reviewSimulatedTitle", body: "reviewSimulatedBody", repeatFirst: true };
  }
  if (result.accuracy < 0.85) {
    return { title: "reviewSlowTitle", body: "reviewSlowBody", repeatFirst: true };
  }
  if (result.accuracy < 0.95) {
    return { title: "reviewRefineTitle", body: "reviewRefineBody", repeatFirst: true };
  }
  return { title: "reviewReadyTitle", body: "reviewReadyBody", repeatFirst: false };
}
