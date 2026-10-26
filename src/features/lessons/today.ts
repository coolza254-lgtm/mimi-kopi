import type { Lesson } from "./lessons";
import { recordFor, stars, type Progress } from "./progress";

/** Cumulative results for the current curriculum versions, not daily activity. */
export function todayRecommendation(all: readonly Lesson[], progress: Progress) {
  const records = all.map((lesson) => recordFor(progress, lesson));
  const unfinished = all.find((lesson) => {
    const record = recordFor(progress, lesson);
    return record.pianoRuns === 0 || (record.bestAccuracy ?? 0) < 0.85;
  }) ?? null;
  // Once every lesson is finished, review the lowest real-piano accuracy.
  // Stable curriculum order resolves ties; screen scores never influence this.
  const review = all.reduce<Lesson | null>((best, lesson) => {
    if (!best) return lesson;
    const accuracy = recordFor(progress, lesson).bestAccuracy ?? 0;
    return accuracy < (recordFor(progress, best).bestAccuracy ?? 0) ? lesson : best;
  }, null);
  return {
    lesson: unfinished ?? review,
    review: unfinished ? recordFor(progress, unfinished).pianoRuns > 0 : review !== null,
    completed: records.filter((r) => r.pianoRuns > 0).length,
    totalStars: records.reduce((sum, r) => sum + stars(r), 0),
    pianoRuns: records.reduce((sum, r) => sum + r.pianoRuns, 0),
    screenRuns: records.reduce((sum, r) => sum + r.screenRuns, 0),
  };
}
