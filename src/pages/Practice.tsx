import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import MiniStaff from "../components/MiniStaff";
import PracticePrograms from "./PracticePrograms";
import MidiConnection from "../components/MidiConnection";
import PianoKeyboard from "../components/PianoKeyboard";
import { lessonGuide, lessonReview } from "../features/lessons/coaching";
import { lessonRange, lessons, units, type Hand, type Lesson } from "../features/lessons/lessons";
import {
  loadProgress,
  played,
  recordFor,
  recordRun,
  saveProgress,
  stars,
  starsFor,
  type LessonRecord,
  type Progress,
} from "../features/lessons/progress";
import { todayRecommendation } from "../features/lessons/today";
import { playNote, startRun, summarize, type NoteInput } from "../features/lessons/waitMode";
import { chordName } from "../features/midi/chords";
import { initialMidiView, midiReducer, simulatedEvent } from "../features/midi/midiState";
import { noteName, solfege } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
  initialLesson?: Lesson | null;
  onOpenSound?: () => void;
  onFocusChange?: (focus: boolean) => void;
}

const handLabel: Record<Hand, MessageKey> = { right: "handRight", left: "handLeft", both: "handBoth" };
const VELOCITY = 90;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export default function Practice({ t, locale, initialLesson = null, onOpenSound, onFocusChange }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(initialLesson);
  const [programs, setPrograms] = useState(!initialLesson);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  useEffect(() => { window.scrollTo(0, 0); }, [lesson]);

  const finish = useCallback((done: Lesson, result: Parameters<typeof recordRun>[2]) => {
    const next = recordRun(progress, done, result, new Date());
    setProgress(next);
    return saveProgress(next);
  }, [progress]);

  if (!lesson && programs) return <PracticePrograms t={t} locale={locale} onOpenSound={onOpenSound} onFocusChange={onFocusChange} onLegacy={() => setPrograms(false)} />;
  if (lesson) {
    const index = lessons.indexOf(lesson);
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        record={recordFor(progress, lesson)}
        next={lessons[index + 1] ?? null}
        t={t}
        locale={locale}
        onFinish={finish}
        onOpen={setLesson}
        onBack={() => setLesson(null)}
        onOpenSound={onOpenSound}
        onFocusChange={onFocusChange}
      />
    );
  }
  return <><button type="button" className="btn text" onClick={() => setPrograms(true)}>{t("drillExit")}</button><LessonMap t={t} locale={locale} progress={progress} onOpen={setLesson} /></>;
}

function Stars({ count, label }: { count: number; label: string }) {
  return (
    <span className="stars" role="img" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={i <= count ? "on" : ""} aria-hidden="true">
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
        </svg>
      ))}
    </span>
  );
}

function starsLabel(t: Props["t"], count: number) {
  return t("starsLabel").replace("{count}", String(count));
}

function Status({ t, record }: { t: Props["t"]; record: LessonRecord }) {
  if (record.pianoRuns > 0) return <Stars count={stars(record)} label={starsLabel(t, stars(record))} />;
  if (played(record)) return <span className="badge">{t("statusScreenOnly")}</span>;
  return <span className="badge quiet">{t("statusNew")}</span>;
}

interface MapProps extends Props {
  progress: Progress;
  onOpen: (lesson: Lesson) => void;
}

function LessonMap({ t, locale, progress, onOpen }: MapProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const recommendation = todayRecommendation(lessons, progress);
  const recommended = recommendation.lesson;
  const done = recommendation.completed;
  let number = 0;

  return (
    <div className="practice">
      <header className="page-head">
        <div>
          <span className="eyebrow">{t("practiceEyebrow")}</span>
          <h1 className="title" ref={heading} tabIndex={-1}>{t("practiceTitle")}</h1>
        </div>
        <div className="overall" aria-label={t("overallLabel")}>
          <span className="overall-count">
            {done}
            <small> / {lessons.length}</small>
          </span>
          <span className="small muted">{t("overallLabel")}</span>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${(done / lessons.length) * 100}%` }} />
          </div>
        </div>
      </header>

      {recommended ? (
        <section className="card hero" aria-labelledby="hero-title">
          <div>
            <span className="eyebrow">
              {recommendation.review ? t("practiceReviewRecommended") : played(recordFor(progress, recommended)) ? t("heroContinue") : t("heroNext")}
            </span>
            <h2 id="hero-title">{recommended.title[locale]}</h2>
            <p className="muted">{recommended.goal[locale]}</p>
            <div className="chips">
              <span className="badge">{t(handLabel[recommended.hand])}</span>
              <span className="badge">
                {recommended.steps.length} {t("steps")}
              </span>
              <span className="badge">{t("waitModeBadge")}</span>
            </div>
          </div>
          <button type="button" className="btn primary big" onClick={() => onOpen(recommended)}>
            {t("start")}
          </button>
        </section>
      ) : (
        <section className="card hero done" aria-live="polite">
          <div>
            <span className="eyebrow">{t("allDoneEyebrow")}</span>
            <h2>{t("allDoneTitle")}</h2>
            <p className="muted">{t("allDoneBody")}</p>
          </div>
        </section>
      )}

      <div className="curriculum-layout">
        <aside className="curriculum-overview" aria-labelledby="curriculum-title">
          <span className="eyebrow">{t("practiceLessonCount").replace("{count}", String(lessons.length))}</span>
          <h2 id="curriculum-title">{t("practiceJourneyTitle")}</h2>
          <p className="muted small">{t("practiceJourneyBody")}</p>
          <p className="small lesson-path-note">{t("waitModeBadge")}</p>
        </aside>
        <div>
      {units.map((unit, u) => {
        const unitLessons = lessons.filter((l) => l.unit === unit.id);
        const completed = unitLessons.filter((l) => recordFor(progress, l).pianoRuns > 0).length;
        return (
        <section key={unit.id} className="unit curriculum-stage" aria-labelledby={`unit-${unit.id}`}>
          <div className="unit-head">
            <span className="unit-index" aria-hidden="true">
              {u + 1}
            </span>
            <div>
              <div className="curriculum-stage-top">
                <h2 id={`unit-${unit.id}`}>{unit.title[locale]}</h2>
                <span className="small muted curriculum-stage-count">
                  {t("practiceUnitComplete").replace("{done}", String(completed)).replace("{total}", String(unitLessons.length))}
                </span>
              </div>
              <p className="muted small">{unit.blurb[locale]}</p>
            </div>
          </div>
          <ol className="lesson-list">
            {unitLessons.map((l) => {
                number++;
                const record = recordFor(progress, l);
                const isNext = recommended?.id === l.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`lesson-tile${isNext ? " next" : ""}${record.pianoRuns > 0 ? " completed" : ""}`}
                      onClick={() => onOpen(l)}
                    >
                      <span className="tile-number" aria-hidden="true">
                        {number}
                      </span>
                      <span className="tile-body">
                        <strong>{l.title[locale]}</strong>
                        <span className="small muted">
                          {t(handLabel[l.hand])} · {l.steps.length} {t("steps")}
                          {record.bestAccuracy !== null && ` · ${t("bestShort")} ${percent(record.bestAccuracy)}`}
                        </span>
                      </span>
                      <Status t={t} record={record} />
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      );})}
        </div>
      </div>
      <section className="lesson-path-note" aria-labelledby="lesson-bridge-title">
        <h2 id="lesson-bridge-title">{t("practiceBridgeTitle")}</h2>
        <p className="muted">{t("practiceBridgeBody")}</p>
      </section>
      <p className="muted small">{t("progressNote")}</p>
    </div>
  );
}

interface PlayerProps extends Props {
  lesson: Lesson;
  record: LessonRecord;
  next: Lesson | null;
  onFinish: (lesson: Lesson, result: { accuracy: number | null; durationMs: number | null; simulated: boolean }) => boolean;
  onOpen: (lesson: Lesson) => void;
  onBack: () => void;
}

export function LessonPlayer({ lesson, record, next, t, locale, onFinish, onOpen, onBack, onOpenSound, onFocusChange }: PlayerProps) {
  const desktop = inDesktopApp();
  const [started, setStarted] = useState(false);
  const active = useRef(false);
  const [showHints, setShowHints] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const [run, setRun] = useState(startRun);
  const [view, dispatch] = useReducer(midiReducer, initialMidiView);
  const [before, setBefore] = useState(record);
  const screenHeld = useRef(new Set<number>());
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const titleHeading = useRef<HTMLHeadingElement>(null);
  const unit = units.find((u) => u.id === lesson.unit);
  const range = lessonRange(lesson);
  const guide = lessonGuide(lesson);

  useEffect(() => { titleHeading.current?.focus({ preventScroll: true }); }, []);

  const feed = useCallback(
    (e: MidiEvent) => {
      dispatch({ type: "event", event: e });
      if (active.current && (e.kind === "noteOn" || e.kind === "noteOff") && e.pitch !== null) {
        const input: NoteInput = { kind: e.kind, pitch: e.pitch, timeMs: e.timestampUs / 1000, simulated: e.simulated };
        setRun((r) => playNote(lesson.steps, r, input));
      }
    },
    [lesson],
  );

  useEffect(() => {
    if (!desktop) return;
    const subscriptions = [backend.onMidiEvent(feed), backend.onMidiReset(() => {
      dispatch({ type: "reset" });
      setRun((r) => ({ ...r, held: [], pressed: [] }));
    })];
    return () => subscriptions.forEach((p) => void p.then((unlisten) => unlisten()));
  }, [desktop, feed]);

  const sendKey = useCallback(
    (pitch: number, down: boolean) => {
      if (down) screenHeld.current.add(pitch);
      else screenHeld.current.delete(pitch);
      if (desktop) void backend.midiSimulate(down ? [0x90, pitch, VELOCITY] : [0x80, pitch, 0]).catch(() => undefined);
      else feed(simulatedEvent(pitch, down, VELOCITY));
    },
    [desktop, feed],
  );

  useEffect(() => {
    const onBlur = () => [...screenHeld.current].forEach((p) => sendKey(p, false));
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      onBlur();
    };
  }, [sendKey]);

  const finished = run.finishedAtMs !== null;
  useEffect(() => {
    onFocusChange?.(started && !finished);
    return () => onFocusChange?.(false);
  }, [started, finished, onFocusChange]);
  const result = summarize(run);
  const review = lessonReview({ ...result, simulated: run.simulated });

  useEffect(() => {
    if (started) stageHeading.current?.focus();
  }, [started, finished]);

  // Save each finished run once.
  const saved = useRef<number | null>(null);
  useEffect(() => {
    if (run.finishedAtMs === null || saved.current === run.finishedAtMs) return;
    saved.current = run.finishedAtMs;
    setSaveFailed(!onFinish(lesson, { ...result, simulated: run.simulated }));
  }, [run.finishedAtMs, run.simulated, result, lesson, onFinish]);

  const target = finished ? [] : lesson.steps[run.step];
  const fingers = finished ? undefined : lesson.fingers?.[run.step];
  const labels: Record<number, string> = {};
  const hiddenLabels: Record<number, string> = {};
  for (let p = range.low; p <= range.high; p++) hiddenLabels[p] = "";
  target.forEach((p, i) => {
    labels[p] = fingers ? String(fingers[i]) : noteName(p);
  });
  // Beginners learn chords by name; the inversion ("G/B") would only confuse.
  const shortChord = (pitches: readonly number[]) => chordName(pitches)?.split("/")[0] ?? null;
  const chord = shortChord(target);
  const upcoming = finished ? [] : lesson.steps.slice(run.step + 1, run.step + 4);
  const pressedOfChord = target.filter((p) => run.pressed.includes(p) && view.held.includes(p)).length;
  const restart = () => {
    [...screenHeld.current].forEach((p) => sendKey(p, false));
    saved.current = null;
    setSaveFailed(false);
    setBefore(record);
    setRun(startRun());
    active.current = true;
    setStarted(true);
  };

  const earned = run.simulated || result.accuracy === null ? 0 : starsFor(result.accuracy);
  const newBest =
    !run.simulated && result.accuracy !== null && (before.bestAccuracy === null || result.accuracy > before.bestAccuracy);

  return (
    <div className={`lesson${started && !finished ? " lesson-active" : ""}${!desktop ? " simulator" : ""}`}>
      <header className="lesson-top">
        <button type="button" className="btn" onClick={onBack}>
          ‹ {t(lesson.unit === "song" ? "back" : "allLessons")}
        </button>
        <div className="lesson-heading">
          <span className="eyebrow">{unit?.title[locale]}</span>
          <h1 className="title" ref={titleHeading} tabIndex={-1}>{lesson.title[locale]}</h1>
        </div>
        <div className="chips">
          <span className="badge">{t(handLabel[lesson.hand])}</span>
          <span className="badge">{t("waitModeBadge")}</span>
        </div>
      </header>
      <p className="muted lesson-goal">{lesson.goal[locale]}</p>

      <MidiConnection t={t} onOpenSound={onOpenSound} />

      {!finished && (
        <label className="lesson-reading-toggle">
          <input type="checkbox" checked={showHints} onChange={(e) => setShowHints(e.target.checked)} aria-labelledby="lesson-hints-label" aria-describedby="lesson-hints-help" />
          <span>
            <strong id="lesson-hints-label">{t("lessonHints")}</strong>
            <span id="lesson-hints-help" className="small muted">{t("lessonHintsHint")}</span>
          </span>
        </label>
      )}

      {!started ? (
        <section className="card lesson-brief" aria-labelledby="lesson-prepare">
          <span className="eyebrow">{t("lessonPrepare")}</span>
          <h2 id="lesson-prepare">{t("lessonSetup")}</h2>
          <p>{t(guide.setup)}</p>
          <div className="lesson-brief-grid">
            <div>
              <h3>{t("lessonFocus")}</h3>
              <p className="muted">{t(guide.focus)}</p>
            </div>
            <div>
              <h3>{t("lessonTransfer")}</h3>
              <p className="muted">{t(guide.transfer)}</p>
            </div>
          </div>
          <div className="lesson-ready-actions">
            <button type="button" className="btn primary big" onClick={restart}>{t("lessonStart")}</button>
            <p className="muted small">{t("lessonWarmupHint")}</p>
          </div>
        </section>
      ) : !finished ? (
        <section className="card now-card" aria-labelledby="lesson-now">
          <div className="card-head">
            <h2 id="lesson-now" ref={stageHeading} tabIndex={-1}>
              {t("step")} {run.step + 1} / {lesson.steps.length}
            </h2>
            <ol className="step-dots" aria-hidden="true">
              {lesson.steps.map((_, i) => (
                <li key={i} className={i < run.step ? "done" : i === run.step ? "current" : ""} />
              ))}
            </ol>
          </div>
          <div className="now-main">
            <MiniStaff pitches={target} label={`${t("pressNow")}: ${target.map(noteName).join(" + ")}`} />
            <div className="now-names" aria-live="polite">
              <span className="eyebrow">{t("pressNow")}</span>
              <div className={showHints ? "now-big" : "lesson-focus"}>
                {showHints ? chord ?? target.map(noteName).join(" + ") : t("lessonReadPrompt")}
              </div>
              {showHints && <div className="now-sub">
                {target.map((p, i) => (
                  <span key={p} className="note-chip">
                    {noteName(p)} · {solfege(p, locale)}
                    {fingers && <b className="finger">{t("finger")} {fingers[i]}</b>}
                  </span>
                ))}
              </div>}
              {target.length > 1 && (
                <p className="small muted">
                  {t("holdTogether")} {pressedOfChord} / {target.length}
                </p>
              )}
              <p className={`feedback${run.lastWrong !== null ? " wrong" : ""}`}>
                {run.lastWrong !== null
                  ? `${t("tryAgain")} ${t("youPressed")} ${noteName(run.lastWrong)}`
                  : run.step === 0
                    ? t(showHints ? "firstStepHint" : "lessonHintsHidden")
                    : t("keepGoing")}
              </p>
            </div>
          </div>
          {showHints && upcoming.length > 0 && (
            <div className="upcoming">
              <span className="small muted">{t("upNext")}</span>
              {upcoming.map((s, i) => (
                <span key={i} className="badge quiet">
                  {shortChord(s) ?? s.map(noteName).join("+")}
                </span>
              ))}
            </div>
          )}
          <p className="small muted lesson-focus">{t(guide.focus)}</p>
        </section>
      ) : (
        <section className="card done-card" aria-labelledby="lesson-done">
          {!run.simulated && <Stars count={earned} label={starsLabel(t, earned)} />}
          <h2 id="lesson-done" ref={stageHeading} tabIndex={-1}>{run.simulated ? t("resultTitle") : earned === 3 ? t("doneGreat") : t("doneGood")}</h2>
          {newBest && <span className="badge best">{t("newBest")}</span>}
          <dl className="done-stats">
            <div>
              <dt>{t("resultAccuracy")}</dt>
              <dd>{result.accuracy === null ? "—" : percent(result.accuracy)}</dd>
            </div>
            <div>
              <dt>{t("resultWrong")}</dt>
              <dd>{run.wrongPresses}</dd>
            </div>
            <div>
              <dt>{t("resultTime")}</dt>
              <dd>{result.durationMs === null ? "—" : seconds(result.durationMs)}</dd>
            </div>
            {before.bestAccuracy !== null && (
              <div>
                <dt>{t("previousBest")}</dt>
                <dd>{percent(before.bestAccuracy)}</dd>
              </div>
            )}
          </dl>
          {(run.simulated || !saveFailed) && <p className="muted small">{run.simulated ? t("resultSimulated") : t("resultNote")}</p>}
          {saveFailed && <p className="notice error" role="status">{t("resultSaveFailed")}</p>}
          <div className="lesson-reflection">
            <span className="eyebrow">{t("lessonReviewHeading")}</span>
            <h3>{t(review.title)}</h3>
            <p className="muted">{t(review.body)}</p>
          </div>
          <div className="actions center">
            <button type="button" className={`btn${review.repeatFirst || !next ? " primary" : ""}`} onClick={restart}>
              {t("restart")}
            </button>
            {next && (
              <button type="button" className={`btn${review.repeatFirst ? "" : " primary"}`} onClick={() => onOpen(next)}>
                {t("nextLesson")} ›
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card lesson-keyboard" aria-label={t("keyboardTitle")}>
        <PianoKeyboard
          held={view.held}
          targets={showHints ? target : []}
          labels={showHints ? labels : hiddenLabels}
          low={range.low}
          high={range.high}
          onPress={(p) => sendKey(p, true)}
          onRelease={(p) => sendKey(p, false)}
        />
        <p className="muted small">{desktop ? t(showHints ? "lessonKeyboardHint" : "lessonHintsHidden") : t("browserNotice")}</p>
      </section>
    </div>
  );
}
