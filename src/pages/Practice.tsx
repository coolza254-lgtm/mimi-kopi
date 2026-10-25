import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import MiniStaff from "../components/MiniStaff";
import PianoKeyboard from "../components/PianoKeyboard";
import { lessonRange, lessons, units, type Hand, type Lesson } from "../features/lessons/lessons";
import {
  loadProgress,
  nextLesson,
  played,
  recordFor,
  recordRun,
  saveProgress,
  stars,
  starsFor,
  type LessonRecord,
  type Progress,
} from "../features/lessons/progress";
import { playNote, startRun, summarize, type NoteInput } from "../features/lessons/waitMode";
import { chordName } from "../features/midi/chords";
import { initialMidiView, midiReducer, simulatedEvent } from "../features/midi/midiState";
import { noteName, solfege } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
}

const handLabel: Record<Hand, MessageKey> = { right: "handRight", left: "handLeft", both: "handBoth" };
const VELOCITY = 90;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export default function Practice({ t, locale }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  const finish = useCallback((done: Lesson, result: Parameters<typeof recordRun>[2]) => {
    setProgress((p) => {
      const next = recordRun(p, done, result, new Date());
      saveProgress(next);
      return next;
    });
  }, []);

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
      />
    );
  }
  return <LessonMap t={t} locale={locale} progress={progress} onOpen={setLesson} />;
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
  const recommended = nextLesson(lessons, progress);
  const done = lessons.filter((l) => recordFor(progress, l).pianoRuns > 0).length;
  let number = 0;

  return (
    <div className="practice">
      <header className="page-head">
        <div>
          <h1 className="title">{t("practiceTitle")}</h1>
          <p className="muted">{t("practiceIntro")}</p>
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
            <span className="eyebrow">{played(recordFor(progress, recommended)) ? t("heroContinue") : t("heroNext")}</span>
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

      {units.map((unit, u) => (
        <section key={unit.id} className="unit" aria-labelledby={`unit-${unit.id}`}>
          <div className="unit-head">
            <span className="unit-index" aria-hidden="true">
              {u + 1}
            </span>
            <div>
              <h2 id={`unit-${unit.id}`}>{unit.title[locale]}</h2>
              <p className="muted small">{unit.blurb[locale]}</p>
            </div>
          </div>
          <ol className="lesson-list">
            {lessons
              .filter((l) => l.unit === unit.id)
              .map((l) => {
                number++;
                const record = recordFor(progress, l);
                const isNext = recommended?.id === l.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`lesson-tile${isNext ? " next" : ""}${record.pianoRuns > 0 ? " passed" : ""}`}
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
      ))}
      <p className="muted small">{t("progressNote")}</p>
    </div>
  );
}

interface PlayerProps extends Props {
  lesson: Lesson;
  record: LessonRecord;
  next: Lesson | null;
  onFinish: (lesson: Lesson, result: { accuracy: number | null; durationMs: number | null; simulated: boolean }) => void;
  onOpen: (lesson: Lesson) => void;
  onBack: () => void;
}

export function LessonPlayer({ lesson, record, next, t, locale, onFinish, onOpen, onBack }: PlayerProps) {
  const desktop = inDesktopApp();
  const [run, setRun] = useState(startRun);
  const [view, dispatch] = useReducer(midiReducer, initialMidiView);
  const [before] = useState(record);
  const screenHeld = useRef(new Set<number>());
  const unit = units.find((u) => u.id === lesson.unit);
  const range = lessonRange(lesson);

  const feed = useCallback(
    (e: MidiEvent) => {
      dispatch({ type: "event", event: e });
      if ((e.kind === "noteOn" || e.kind === "noteOff") && e.pitch !== null) {
        const input: NoteInput = { kind: e.kind, pitch: e.pitch, timeMs: e.timestampUs / 1000, simulated: e.simulated };
        setRun((r) => playNote(lesson.steps, r, input));
      }
    },
    [lesson],
  );

  useEffect(() => {
    if (!desktop) return;
    const subscriptions = [backend.onMidiEvent(feed), backend.onMidiReset(() => dispatch({ type: "reset" }))];
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
    return () => window.removeEventListener("blur", onBlur);
  }, [sendKey]);

  const finished = run.finishedAtMs !== null;
  const result = summarize(run);

  // Save each finished run once.
  const saved = useRef<number | null>(null);
  useEffect(() => {
    if (run.finishedAtMs === null || saved.current === run.finishedAtMs) return;
    saved.current = run.finishedAtMs;
    onFinish(lesson, { ...result, simulated: run.simulated });
  }, [run.finishedAtMs, run.simulated, result, lesson, onFinish]);

  const target = finished ? [] : lesson.steps[run.step];
  const fingers = finished ? undefined : lesson.fingers?.[run.step];
  const labels: Record<number, string> = {};
  target.forEach((p, i) => {
    labels[p] = fingers ? String(fingers[i]) : noteName(p);
  });
  // Beginners learn chords by name; the inversion ("G/B") would only confuse.
  const shortChord = (pitches: readonly number[]) => chordName(pitches)?.split("/")[0] ?? null;
  const chord = shortChord(target);
  const upcoming = finished ? [] : lesson.steps.slice(run.step + 1, run.step + 4);
  const pressedOfChord = target.filter((p) => run.pressed.includes(p) && view.held.includes(p)).length;
  const restart = () => {
    saved.current = null;
    setRun(startRun());
  };

  const earned = run.simulated || result.accuracy === null ? 0 : starsFor(result.accuracy);
  const newBest =
    !run.simulated && result.accuracy !== null && (before.bestAccuracy === null || result.accuracy > before.bestAccuracy);

  return (
    <div className="lesson">
      <header className="lesson-top">
        <button type="button" className="btn" onClick={onBack}>
          ‹ {t("allLessons")}
        </button>
        <div className="lesson-heading">
          <span className="eyebrow">{unit?.title[locale]}</span>
          <h1 className="title">{lesson.title[locale]}</h1>
        </div>
        <div className="chips">
          <span className="badge">{t(handLabel[lesson.hand])}</span>
          <span className="badge">{t("waitModeBadge")}</span>
        </div>
      </header>
      <p className="muted lesson-goal">{lesson.goal[locale]}</p>

      {!finished ? (
        <section className="card now-card" aria-labelledby="lesson-now">
          <div className="card-head">
            <h2 id="lesson-now">
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
              <div className="now-big">{chord ?? target.map(noteName).join(" + ")}</div>
              <div className="now-sub">
                {target.map((p, i) => (
                  <span key={p} className="note-chip">
                    {noteName(p)} · {solfege(p, locale)}
                    {fingers && <b className="finger">{t("finger")} {fingers[i]}</b>}
                  </span>
                ))}
              </div>
              {target.length > 1 && (
                <p className="small muted">
                  {t("holdTogether")} {pressedOfChord} / {target.length}
                </p>
              )}
              <p className={`feedback${run.lastWrong !== null ? " wrong" : ""}`}>
                {run.lastWrong !== null
                  ? `${t("tryAgain")} ${t("youPressed")} ${noteName(run.lastWrong)}`
                  : run.step === 0
                    ? t("firstStepHint")
                    : t("keepGoing")}
              </p>
            </div>
          </div>
          {upcoming.length > 0 && (
            <div className="upcoming">
              <span className="small muted">{t("upNext")}</span>
              {upcoming.map((s, i) => (
                <span key={i} className="badge quiet">
                  {shortChord(s) ?? s.map(noteName).join("+")}
                </span>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="card done-card" aria-labelledby="lesson-done">
          {!run.simulated && <Stars count={earned} label={starsLabel(t, earned)} />}
          <h2 id="lesson-done">{run.simulated ? t("resultTitle") : earned === 3 ? t("doneGreat") : t("doneGood")}</h2>
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
          <p className="muted small">{run.simulated ? t("resultSimulated") : t("resultNote")}</p>
          <div className="actions center">
            <button type="button" className="btn" onClick={restart}>
              {t("restart")}
            </button>
            {next && (
              <button type="button" className="btn primary" onClick={() => onOpen(next)}>
                {t("nextLesson")} ›
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card" aria-label={t("keyboardTitle")}>
        <PianoKeyboard
          held={view.held}
          targets={target}
          labels={labels}
          low={range.low}
          high={range.high}
          onPress={(p) => sendKey(p, true)}
          onRelease={(p) => sendKey(p, false)}
        />
        <p className="muted small">{desktop ? t("lessonKeyboardHint") : t("browserNotice")}</p>
      </section>
    </div>
  );
}
