import { useState } from "react";
import { courseChapters, type CourseChapter } from "../features/lessons/course";
import { readSkillData } from "../features/lessons/skills";
import { readExercises, type ExerciseKind } from "../features/lessons/exercises";
import { learningPath, nextPathStep, pathStepStatus } from "../features/lessons/learningPath";
import type { PracticeIntent } from "../features/lessons/practiceNavigation";
import type { MessageKey } from "../i18n/messages";
import "../styles/path.css";
import "../styles/learning-expression.css";

interface Props { t: (key: MessageKey) => string; onChapter: (chapter: CourseChapter) => void; onExercise: (kind: ExerciseKind) => void; onSkills: () => void; onPractice: (intent: PracticeIntent) => void }
export default function LearningPath({ t, onChapter, onExercise, onSkills, onPractice }: Props) {
  const [pathData, setPathData] = useState(readSkillData), [exerciseData, setExerciseData] = useState(readExercises);
  const progress = pathData.ok ? pathData.learning : {}, drills = pathData.ok ? pathData.drills : [];
  const exercises = exerciseData.ok ? exerciseData.data.records : [];
  const next = nextPathStep(progress, drills, exercises);
  const [selected, setSelected] = useState(next.id);
  const current = learningPath.find((s) => s.id === selected)!;
  const currentStatus = pathStepStatus(current, progress, drills, exercises);
  const detailLabel = current.id === next.id ? (currentStatus === "new" ? "pathNext" : "dailyReviewTopic") : "pathExplore";
  const retry = () => {
    const loaded = readSkillData(), loadedExercises = readExercises();
    setPathData(loaded); setExerciseData(loadedExercises);
    if (loaded.ok && loadedExercises.ok) setSelected(nextPathStep(loaded.learning, loaded.drills, loadedExercises.data.records).id);
  };
  if (!pathData.ok || !exerciseData.ok) return <div className="path-page learning-expression"><h1 className="title">{t("pathTitle")}</h1><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={retry}>{t("pathRetry")}</button><button className="btn" onClick={onSkills}>{t("pathLinkSkills")}</button></div>;
  const open = () => { if (current.chapter) onChapter(courseChapters.find((c) => c.id === current.chapter)!); else onExercise(current.exercise!); };
  return <div className="path-page learning-expression">
    <header className="learning-expression-head"><h1 className="title">{t("pathTitle")}</h1><p className="muted">{t("pathIntro")}</p></header>
    <div className="learning-route">
      <ol aria-label={t("pathTitle")}>{learningPath.map((item, i) => {
        const status = pathStepStatus(item, progress, drills, exercises);
        return <li className="route-node" data-step={item.id} data-status={status} key={item.id}>
          <button aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span className="route-number">{String(i + 1).padStart(2, "0")}</span>
            <span className="route-copy"><strong>{t(item.title)}</strong><small>{status === "new" ? t("learnNew") : t(status === "simulated" ? "learnSimComplete" : "learnComplete")}</small></span>
            <svg className="route-arrow" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7 5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </li>;
      })}</ol>
      <section className="route-detail" data-step={current.id} data-status={currentStatus} aria-label={t(current.title)}>
        <div className="route-detail-mast"><span className="eyebrow">{t(detailLabel)}</span><span className="route-chapter-number" aria-hidden="true">{String(learningPath.indexOf(current) + 1).padStart(2, "0")}</span></div>
        <RouteArtwork />
        <div className="route-detail-copy"><h2>{t(current.title)}</h2><p>{t(current.goal)}</p></div>
        <div className="route-actions"><button className="btn primary" aria-label={`${t("learnOpen")} · ${t(current.title)}`} onClick={open}>{t("pathStart")}<span aria-hidden="true">→</span></button>
          {current.chapter && <button className="btn" onClick={() => onPractice({ kind: "chapter", chapterId: current.chapter! })}>{t("pathPractice")}<span aria-hidden="true">→</span></button>}
          {current.chapter === "treble" && <button className="btn" onClick={() => onExercise("phrase")}>{t("pathApply")}<span aria-hidden="true">→</span></button>}
          <button className="btn text" onClick={onSkills}>{t("pathLinkSkills")}</button>
        </div>
        <div className="route-detail-notes"><details className="route-detail-note"><summary>{t("dailyResultMeaning")}</summary><p className="small muted">{t("pathNoMastery")}</p></details></div>
      </section>
    </div>
  </div>;
}

/** Decorative music objects, separate from the question and progress data. */
function RouteArtwork() {
  return <svg className="route-artwork" viewBox="0 0 400 152" aria-hidden="true" focusable="false">
    <ellipse className="route-art-orbit" cx="220" cy="78" rx="149" ry="51" transform="rotate(-12 220 78)" />
    <ellipse className="route-art-orbit second" cx="220" cy="78" rx="149" ry="51" transform="rotate(17 220 78)" />
    <g className="route-art-sheet" transform="translate(63 31) rotate(-8 90 46)">
      <rect className="route-art-sheet-shadow" x="6" y="7" width="187" height="100" rx="15" />
      <rect className="route-art-paper" width="187" height="100" rx="15" />
      <path className="route-art-staff" d="M18 31h150M18 42h150M18 53h150M18 64h150M18 75h150" />
      <path className="route-art-note" d="M51 63V28M99 52V17M148 41V6" />
      <ellipse className="route-art-notehead" cx="45" cy="65" rx="8" ry="6" transform="rotate(-22 45 65)" />
      <ellipse className="route-art-notehead" cx="93" cy="54" rx="8" ry="6" transform="rotate(-22 93 54)" />
      <ellipse className="route-art-notehead" cx="142" cy="43" rx="8" ry="6" transform="rotate(-22 142 43)" />
    </g>
    <g className="route-art-keyboard" transform="translate(225 77) rotate(9 51 25)">
      <rect className="route-art-key-shadow" x="5" y="7" width="108" height="58" rx="11" />
      <rect className="route-art-key-body" width="108" height="58" rx="11" />
      <path className="route-art-divider" d="M22 5v48M43 5v48M64 5v48M85 5v48" />
      <path className="route-art-black" d="M15 0h12v33H15ZM36 0h12v33H36ZM78 0h12v33H78Z" />
    </g>
    <circle className="route-art-spark" cx="321" cy="36" r="6" />
    <path className="route-art-spark-line" d="M32 54h12M38 48v12M305 122h9M309.5 117.5v9" />
  </svg>;
}