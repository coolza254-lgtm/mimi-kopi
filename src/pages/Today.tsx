import { useState } from "react";
import AppIcon from "../components/AppIcon";
import PracticeArtwork from "../components/PracticeArtwork";
import MidiConnection from "../components/MidiConnection";
import { lessons, type Lesson } from "../features/lessons/lessons";
import { loadProgress } from "../features/lessons/progress";
import { todayRecommendation } from "../features/lessons/today";
import type { Locale, MessageKey } from "../i18n/messages";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
  onPractice: (lesson: Lesson | null) => void;
  onFreePlay: () => void;
  onEditor: () => void;
  onSound: () => void;
}

export default function Today({ t, locale, onPractice, onFreePlay, onEditor, onSound }: Props) {
  const [progress] = useState(() => loadProgress());
  const recommendation = todayRecommendation(lessons, progress);
  const recommended = recommendation.lesson;
  const plan: { title: MessageKey; body: MessageKey; minutes: number; action: () => void }[] = [
    { title: "todayWarmup", body: "todayWarmupBody", minutes: 5, action: onFreePlay },
    { title: "todayLesson", body: "todayLessonBody", minutes: 10, action: () => onPractice(recommended) },
    { title: "todaySong", body: "todaySongBody", minutes: 10, action: onEditor },
    { title: "todayReview", body: "todayReviewBody", minutes: 5, action: () => onPractice(null) },
  ];

  return <div className="today">
    <header className="today-heading">
      <span className="eyebrow">{t("appRomaji")} / {t("todayTitle")}</span>
      <h1 className="title">{t("todayGreeting")}</h1>
      <p>{t("todayIntro")}</p>
    </header>

    <MidiConnection t={t} onOpenSound={onSound} />

    {recommended && <section className="today-hero" aria-labelledby="today-next">
      <div className="today-hero-copy">
        <span className="eyebrow">{t(recommendation.review ? "todayReviewReason" : "todayNextReason")}</span>
        <h2 id="today-next">{recommended.title[locale]}</h2>
        <p>{recommended.goal[locale]}</p>
        <div className="today-hero-meta">
          <span className="badge">{t("waitModeBadge")}</span>
          <span className="small muted">{recommended.steps.length} {t("steps")}</span>
        </div>
        <div className="today-hero-actions">
          <button type="button" className="btn primary big" onClick={() => onPractice(recommended)}>{t("todayBegin")}<AppIcon name="arrow" /></button>
          <button type="button" className="btn text" onClick={() => onPractice(null)}>{t("todayLibrary")}</button>
        </div>
      </div>
      <PracticeArtwork />
    </section>}

    <div className="today-lower">
      <section aria-labelledby="today-plan">
        <div className="section-heading">
          <h2 id="today-plan">{t("todayPlan")}</h2>
          <AppIcon name="clock" />
        </div>
        <ol className="session-plan">
          {plan.map((step, index) => <li key={step.title}>
            <button type="button" className="session-step" onClick={step.action}>
              <span className="session-step-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="session-step-copy"><strong>{t(step.title)}</strong><small>{t(step.body)}</small></span>
              <span className="session-step-time">{t("todayMinutes").replace("{count}", String(step.minutes))}</span>
              <AppIcon name="chevron" />
            </button>
          </li>)}
        </ol>
        <details className="session-note">
          <summary>{t("todayPlanCaption")}</summary>
          <p>{t("todayPlanHint")}</p>
        </details>
      </section>

      <section className="today-progress" aria-labelledby="today-results">
        <h2 id="today-results">{t("todayResults")}</h2>
        <div className="today-progress-head"><strong>{recommendation.completed}</strong><span>/ {lessons.length}</span></div>
        <div className="meter" role="progressbar" aria-label={t("overallLabel")} aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={recommendation.completed}>
          <i style={{ width: `${recommendation.completed / lessons.length * 100}%` }} />
        </div>
        <p className="today-progress-label">{t("overallLabel")}</p>
        <dl className="rows">
          <dt>{t("todayPianoRuns")}</dt><dd>{recommendation.pianoRuns}</dd>
          <dt>{t("todayScreenRuns")}</dt><dd>{recommendation.screenRuns}</dd>
        </dl>
        {recommendation.pianoRuns === 0 && <p className="today-progress-empty">{t("todayProgressEmpty")}</p>}
        <p className="today-progress-note">{t("todayResultsHint")}</p>
      </section>
    </div>

    <section className="song-bridge" aria-labelledby="song-bridge-title">
      <div><h2 id="song-bridge-title">{t("todaySongBridgeTitle")}</h2><p>{t("todaySongBridgeBody")}</p></div>
      <button type="button" className="btn" onClick={onEditor}>{t("todaySongBridgeAction")}<AppIcon name="arrow" /></button>
    </section>
  </div>;
}
