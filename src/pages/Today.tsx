import { useState } from "react";
import AppIcon from "../components/AppIcon";
import PracticeArtwork from "../components/PracticeArtwork";
import MidiConnection from "../components/MidiConnection";
import type { Lesson } from "../features/lessons/lessons";
import { courseChapters, learningStatus } from "../features/lessons/course";
import { readSkillData } from "../features/lessons/skills";
import { readExercises } from "../features/lessons/exercises";
import { dailyLearning, completedToday } from "../features/lessons/dailyLearning";
import { independentTrial, type LearningLaunchOptions } from "../features/lessons/learningPath";
import type { Locale, MessageKey } from "../i18n/messages";
import { inDesktopApp } from "../lib/backend";
import "../styles/daily.css";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
  onPractice: (lesson: Lesson | null) => void;
  onFreePlay: () => void;
  onEditor: () => void;
  onSound: () => void;
  onLearn?: (stepId?: string, options?: LearningLaunchOptions) => void;
  onSkills?: () => void;
}

export default function Today({ t, locale, onPractice, onFreePlay, onEditor, onSound, onLearn, onSkills }: Props) {
  const [data, setData] = useState(() => ({ path: readSkillData(), exercises: readExercises() }));
  const [count, setCount] = useState(3);
  const now = new Date();
  const { path, exercises } = data;
  const suggestion = path.ok && exercises.ok ? dailyLearning(path.learning, path.drills, exercises.data.records, now) : null;
  const done = path.ok ? courseChapters.filter((c) => learningStatus(c, path.learning, path.drills) === "completed").length : null;
  const activity = exercises.ok ? completedToday(exercises.data.records, now) : null;
  const start = () => {
    if (!suggestion) return;
    if (onLearn) onLearn(suggestion.step.id, { mode: suggestion.mode, count });
    else onPractice(null);
  };
  const date = (at: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  const evidence = suggestion?.evidence;
  const answered = evidence?.trials.filter((q) => q.finished).length ?? 0;
  const firstTry = evidence?.trials.filter((q) => evidence.mode === "check" ? independentTrial(q, evidence.kind) : q.finished && q.wrong === 0).length ?? 0;

  return <div className={`today daily-page${inDesktopApp() ? " has-midi" : ""}`}>
    <header className="today-heading"><h1 className="title">{t("dailyTitle")}</h1></header>
    {inDesktopApp() && <MidiConnection t={t} onOpenSound={onSound} />}
    {suggestion ? <section className="today-hero daily-hero" aria-labelledby="today-next">
      <div className="today-hero-copy">
        <span className="eyebrow">{t("dailySuggested")}</span>
        <h2 id="today-next">{t(suggestion.step.title)}</h2>
        <p className="daily-reason">{suggestion.evidence ? t(suggestion.reason).replace("{days}", String(suggestion.days ?? 0)) : t(suggestion.step.goal)}</p>
        {suggestion.step.exercise ? <fieldset className="daily-size"><legend>{t("dailySize")}</legend>{[3, 6].map((size) => <label key={size}><input type="radio" name="daily-size" checked={count === size} onChange={() => setCount(size)} /><span>{t(size === 3 ? "dailyShort" : "dailyFull")}</span></label>)}</fieldset>
          : <span className="daily-round-label">{t("dailyChapterRound")}</span>}
        {suggestion.evidence && <span className="daily-source">{t(suggestion.evidence.simulated ? "pathSim" : "pathReal")} · {t(suggestion.evidence.mode === "learn" ? "exLearn" : "exCheck")}</span>}<div className="today-hero-actions"><button className="btn primary big" onClick={start}>{t(suggestion.step.chapter ? "pathContinue" : "dailyStart")}<AppIcon name="arrow" /></button><button className="btn text" onClick={() => onLearn ? onLearn() : onPractice(null)}>{t("dailyMap")}</button></div>
        {evidence && <details className="daily-evidence"><summary>{t("dailyLatest")}</summary><p>{date(evidence.at)} · {t(evidence.simulated ? "pathSim" : "pathReal")} · {t(evidence.mode === "learn" ? "exLearn" : "exCheck")}</p><p>{answered ? t("dailyLastResult").replace("{correct}", String(firstTry)).replace("{total}", String(answered)) : t("exNoInput")}</p></details>}
      </div><div className="daily-instrument"><PracticeArtwork /></div>
    </section> : <section className="card"><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={() => setData({ path: readSkillData(), exercises: readExercises() })}>{t("pathRetry")}</button></section>}
    <div className="daily-below">
      <section className="daily-options" aria-labelledby="daily-options-title"><h2 id="daily-options-title">{t("dailyChoose")}</h2>
        <button onClick={onFreePlay}><AppIcon name="piano" /><span><strong>{t("dailyFree")}</strong></span><AppIcon name="chevron" /></button>
        <button onClick={onEditor}><AppIcon name="score" /><span><strong>{t("dailyOwn")}</strong></span><AppIcon name="chevron" /></button>
        <button onClick={onSkills ?? (() => onPractice(null))}><AppIcon name="check" /><span><strong>{t("pathLinkSkills")}</strong></span><AppIcon name="chevron" /></button>
        <details className="daily-more"><summary>{t("dailyMore")}</summary><button className="btn text" onClick={() => onPractice(null)}>{t("dailyPracticeOpen")}</button></details>
      </section>
      <section className="today-progress daily-progress" aria-labelledby="today-results"><h2 id="today-results">{t("pathCompleted")} · {t("pathReal")}</h2>
        {done === null ? <p role="alert">{t("pathLoadError")}</p> : <><div className="today-progress-head"><strong>{done}</strong><span>/ {courseChapters.length}</span></div><div className="studio-completion" aria-hidden="true">{courseChapters.map((chapter) => <i key={chapter.id} className={path.ok && learningStatus(chapter,path.learning,path.drills)==="completed"?"done":""} />)}</div><div className="meter" role="progressbar" aria-label={t("pathCompleted")} aria-valuemin={0} aria-valuemax={courseChapters.length} aria-valuenow={done}><i style={{ width: `${done / courseChapters.length * 100}%` }} /></div></>}
        <details className="today-progress-note"><summary>{t("dailyResultMeaning")}</summary><p>{t("pathNoMastery")}</p><p>{t("dailyActivityNote")}</p></details>
        <div className="daily-activity"><h3>{t("dailyActivity")}</h3>{activity ? activity.real + activity.simulated === 0 ? <p>{t("dailyActivityEmpty")}</p> : <p>{t("pathReal")} <strong>{activity.real}</strong> · {t("pathSim")} <strong>{activity.simulated}</strong></p> : <p role="alert">{t("pathLoadError")}</p>}</div>
      </section>
    </div>
  </div>;
}
