import { useState } from "react";
import { lessons, type Lesson } from "../features/lessons/lessons";
import { loadProgress } from "../features/lessons/progress";
import { todayRecommendation } from "../features/lessons/today";
import type { AppInfo } from "../lib/backend";
import type { Locale, MessageKey } from "../i18n/messages";

interface Props {
  t: (key: MessageKey) => string;
  info: AppInfo | null;
  locale: Locale;
  onPractice: (lesson: Lesson | null) => void;
  onFreePlay: () => void;
  onEditor: () => void;
  onSound: () => void;
}

export default function Today({ t, info, locale, onPractice, onFreePlay, onEditor, onSound }: Props) {
  const [progress] = useState(() => loadProgress());
  const recommendation = todayRecommendation(lessons, progress);
  const recommended = recommendation.lesson;
  const plan: { title: MessageKey; body: MessageKey; minutes: number; action: () => void }[] = [
    { title: "todayWarmup", body: "todayWarmupBody", minutes: 5, action: onFreePlay },
    { title: "todayLesson", body: "todayLessonBody", minutes: 10, action: () => onPractice(recommended) },
    { title: "todaySong", body: "todaySongBody", minutes: 10, action: onEditor },
    { title: "todayReview", body: "todayReviewBody", minutes: 5, action: () => onPractice(null) },
  ];
  return (
    <div className="practice">
      <header className="page-head">
        <div>
          <h1 className="title">{t("todayTitle")}</h1>
          <p className="muted">{t("todayIntro")}</p>
        </div>
        <button className="btn" type="button" onClick={onSound}>{t("soundTitle")}</button>
      </header>

      {recommended && <section className="card hero" aria-labelledby="today-next">
        <div>
          <span className="eyebrow">{t(recommendation.review ? "todayReviewReason" : "todayNextReason")}</span>
          <h2 id="today-next">{recommended.title[locale]}</h2>
          <p className="muted">{recommended.goal[locale]}</p>
          <span className="badge">{t("waitModeBadge")}</span>
        </div>
        <button type="button" className="btn primary big" onClick={() => onPractice(recommended)}>{t("start")}</button>
      </section>}

      <section aria-labelledby="today-plan">
        <h2 id="today-plan">{t("todayPlan")}</h2>
        <p className="muted small">{t("todayPlanHint")}</p>
        <div className="cards">
          {plan.map((step) => <section className="card" key={step.title}>
            <span className="badge">{t("todayMinutes").replace("{count}", String(step.minutes))}</span>
            <h3>{t(step.title)}</h3>
            <p className="muted">{t(step.body)}</p>
            <button className="btn" type="button" onClick={step.action}>{t("start")} · {t(step.title)}</button>
          </section>)}
        </div>
      </section>

      <div className="cards">
        <section className="card" aria-labelledby="today-results">
          <h2 id="today-results">{t("todayResults")}</h2>
          <p className="muted small">{t("todayResultsHint")}</p>
          <dl className="rows">
            <dt>{t("overallLabel")}</dt><dd>{recommendation.completed} / {lessons.length}</dd>
            <dt>{t("todayStars")}</dt><dd>{recommendation.totalStars} / {lessons.length * 3}</dd>
            <dt>{t("todayPianoRuns")}</dt><dd>{recommendation.pianoRuns}</dd>
            <dt>{t("todayScreenRuns")}</dt><dd>{recommendation.screenRuns}</dd>
          </dl>
          <button className="btn" type="button" onClick={() => onPractice(null)}>{t("practiceTitle")}</button>
        </section>
        <section className="card" aria-labelledby="phase">
          <h2 id="phase">{t("phaseTitle")}</h2>
          <p className="muted">{t("phaseBody")}</p>
          <dl className="rows">
            <dt>{t("version")}</dt>
            <dd>{info?.version ?? "—"}</dd>
            <dt>{t("runtime")}</dt>
            <dd>{info ? t("runtimeDesktop") : t("runtimeBrowser")}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
