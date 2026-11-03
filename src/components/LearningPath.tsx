import { useState } from "react";
import AppIcon, { type IconName } from "./AppIcon";
import PracticeArtwork from "./PracticeArtwork";
import { courseChapters, type CourseChapter } from "../features/lessons/course";
import { readSkillData } from "../features/lessons/skills";
import { readExercises, type ExerciseKind } from "../features/lessons/exercises";
import { learningPath, pathSections, pathStepStatus, type PathStep, type LearningLaunchOptions } from "../features/lessons/learningPath";
import { dailyLearning } from "../features/lessons/dailyLearning";
import type { PracticeIntent } from "../features/lessons/practiceNavigation";
import type { MessageKey } from "../i18n/messages";
import "../styles/path.css";
import "../styles/journey.css";

interface Props {
  t: (key: MessageKey) => string;
  onChapter: (chapter: CourseChapter) => void;
  onExercise: (kind: ExerciseKind, options?: LearningLaunchOptions) => void;
  onSkills: () => void;
  onPractice: (intent: PracticeIntent) => void;
  onBrowse?: () => void;
}
const icons: Record<string, IconName> = { keyboard: "piano", direction: "sound", rhythm: "clock", treble: "score", phrase: "score", melody: "sound", bass: "score", chords: "piano" };

export default function LearningPath({ t, onChapter, onExercise, onSkills, onPractice, onBrowse }: Props) {
  const [pathData, setPathData] = useState(readSkillData);
  const [exerciseData, setExerciseData] = useState(readExercises);
  const progress = pathData.ok ? pathData.learning : {};
  const drills = pathData.ok ? pathData.drills : [];
  const exercises = exerciseData.ok ? exerciseData.data.records : [];
  const suggestion = dailyLearning(progress, drills, exercises, new Date());
  const next = suggestion.step;
  const [selected, setSelected] = useState(next.id);
  const current = learningPath.find((item) => item.id === selected) ?? next;
  const statusOf = (item: PathStep) => pathStepStatus(item, progress, drills, exercises);
  const currentStatus = statusOf(current);
  const real = learningPath.filter((item) => statusOf(item) === "completed").length;
  const simulated = learningPath.filter((item) => statusOf(item) === "simulated").length;
  const detailLabel = current.id === next.id ? (currentStatus === "new" ? "pathNext" : "dailyReviewTopic") : "journeySelected";
  const open = (item: PathStep) => {
    if (item.chapter) onChapter(courseChapters.find((chapter) => chapter.id === item.chapter)!);
    else onExercise(item.exercise!, item.id === next.id ? { mode: suggestion.mode, count: 6 } : undefined);
  };
  const retry = () => {
    const loaded = readSkillData(), loadedExercises = readExercises();
    setPathData(loaded); setExerciseData(loadedExercises);
    if (loaded.ok && loadedExercises.ok) setSelected(dailyLearning(loaded.learning, loaded.drills, loadedExercises.data.records, new Date()).step.id);
  };
  if (!pathData.ok || !exerciseData.ok) return <div className="path-page journey-page"><h1 className="title">{t("pathTitle")}</h1><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={retry}>{t("pathRetry")}</button><button className="btn" onClick={onSkills}>{t("pathLinkSkills")}</button></div>;
  return <div className="path-page journey-page">
    <header className="journey-heading">
      <div><span className="eyebrow">{t("journeyEyebrow")}</span><h1 className="title">{t("pathTitle")}</h1><p>{t("pathIntro")}</p></div>
      {onBrowse && <button type="button" className="btn journey-browse" onClick={onBrowse}>{t("journeyBrowse")}<AppIcon name="arrow" /></button>}
    </header>
    <section className="journey-hero" aria-label={t("pathNext")}>
      <div className="journey-hero-copy"><span className="eyebrow">{t("pathNext")}</span><h2>{t(next.title)}</h2>{!["dailyStartReason", "dailyNextReason"].includes(suggestion.reason) && <p>{t(suggestion.reason)}</p>}<button type="button" className="btn primary big" onClick={() => open(next)}>{t("pathContinue")}<AppIcon name="arrow" /></button></div>
      <div className="journey-progress" aria-label={t("journeyProgress")}>
        <span>{t("journeyLessonCount").replace("{count}", String(learningPath.length))}</span>
        <div className="journey-segments" aria-hidden="true">{learningPath.map((item) => <i key={item.id} data-status={statusOf(item)} data-suggested={item.id === next.id} />)}</div>
        <div className="journey-evidence"><span>{t("pathReal")} <strong>{real}</strong></span><span>{t("pathSim")} <strong>{simulated}</strong></span></div>
      </div>
    </section>
    <div className="journey-layout">
      <ol className="journey-map" aria-label={t("pathTitle")}>{pathSections.map((section, sectionIndex) => <li className="journey-stage" key={section.title}>
        <header className="journey-stage-heading"><span>{String(sectionIndex + 1).padStart(2, "0")}</span><div><p>{t("journeySection").replace("{number}", String(sectionIndex + 1))}</p><h2>{t(section.title)}</h2><small>{t(section.goal)}</small></div></header>
        <ol className="journey-stage-steps" aria-label={t(section.title)}>{section.steps.map((id, i) => {
          const item = learningPath.find((step) => step.id === id)!;
          const status = statusOf(item);
          const suggested = item.id === next.id;
          return <li className="journey-node" key={id} data-status={status} data-suggested={suggested} data-selected={selected === id}>
            {i < section.steps.length - 1 && <svg className="journey-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M25 0 C25 55 75 45 75 100" /></svg>}
            <button type="button" className="journey-step" aria-pressed={selected === id} aria-current={suggested ? "step" : undefined} aria-controls="journey-detail" onClick={() => setSelected(id)}>
              <span className="journey-orb"><AppIcon name={status === "completed" ? "check" : icons[id]} /><span className="journey-step-number">{learningPath.indexOf(item) + 1}</span></span>
              <span className="journey-step-copy">{suggested && <span className="journey-here">{t("journeySuggested")}</span>}<strong>{t(item.title)}</strong><small>{t(status === "new" ? "learnNew" : status === "simulated" ? "learnSimComplete" : "learnComplete")}</small></span>
            </button>
          </li>;
        })}</ol>
      </li>)}</ol>
      <aside id="journey-detail" className="journey-detail" aria-label={t(current.title)}>
        <div className="journey-detail-top"><span className="eyebrow">{t(detailLabel)}</span><span>{String(learningPath.indexOf(current) + 1).padStart(2, "0")}</span></div>
        <div className="journey-art" aria-hidden="true"><PracticeArtwork /></div>
        <span className="journey-detail-status" data-status={currentStatus}>{t(currentStatus === "new" ? "journeyReady" : currentStatus === "simulated" ? "journeySimEvidence" : "journeyPianoEvidence")}</span>
        <h2>{t(current.title)}</h2><p>{t(current.goal)}</p><span className="journey-lesson-type">{t(current.chapter ? "journeyLessonType" : "journeyExerciseType")}</span>
        <div className="journey-actions"><button type="button" className="btn primary big" aria-label={`${t("learnOpen")} · ${t(current.title)}`} onClick={() => open(current)}>{t("pathStart")}<AppIcon name="arrow" /></button>
          {current.chapter && <button type="button" className="btn" onClick={() => onPractice({ kind: "chapter", chapterId: current.chapter! })}>{t("pathPractice")}<AppIcon name="arrow" /></button>}
          {current.chapter === "treble" && <button type="button" className="btn" onClick={() => onExercise("phrase")}>{t("pathApply")}<AppIcon name="arrow" /></button>}
          <button type="button" className="btn text" onClick={onSkills}>{t("pathLinkSkills")}</button>
        </div>
        <details className="journey-result-note"><summary>{t("dailyResultMeaning")}</summary><p>{t("pathNoMastery")}</p></details>
      </aside>
    </div>
  </div>;
}
