import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import PianoKeyboard from "../components/PianoKeyboard";
import { lessons, LESSON_HIGH, LESSON_LOW, type Hand, type Lesson } from "../features/lessons/lessons";
import { playNote, startRun, summarize, type NoteInput } from "../features/lessons/waitMode";
import { initialMidiView, midiReducer, simulatedEvent } from "../features/midi/midiState";
import { noteName } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
}

const handLabel: Record<Hand, MessageKey> = { right: "handRight", left: "handLeft", both: "handBoth" };
const VELOCITY = 90;

export default function Practice({ t, locale }: Props) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  return lesson ? (
    <LessonPlayer key={lesson.id} lesson={lesson} t={t} locale={locale} onBack={() => setLesson(null)} />
  ) : (
    <>
      <h1 className="title">{t("practiceTitle")}</h1>
      <p className="muted">{t("practiceIntro")}</p>
      <div className="cards">
        {lessons.map((l) => (
          <section key={l.id} className="card" aria-labelledby={`lesson-${l.id}`}>
            <div className="card-head">
              <h2 id={`lesson-${l.id}`}>{l.title[locale]}</h2>
              <span className="badge">{t(handLabel[l.hand])}</span>
            </div>
            <p className="muted">{l.goal[locale]}</p>
            <p className="small muted">
              {l.steps.length} {t("steps")}
            </p>
            <button type="button" className="btn primary" onClick={() => setLesson(l)}>
              {t("start")}
            </button>
          </section>
        ))}
      </div>
    </>
  );
}

interface PlayerProps extends Props {
  lesson: Lesson;
  onBack: () => void;
}

function LessonPlayer({ lesson, t, locale, onBack }: PlayerProps) {
  const desktop = inDesktopApp();
  const [run, setRun] = useState(startRun);
  const [view, dispatch] = useReducer(midiReducer, initialMidiView);
  const screenHeld = useRef(new Set<number>());

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
  const target = finished ? [] : lesson.steps[run.step];
  const result = summarize(run);
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <>
      <div className="card-head">
        <h1 className="title">{lesson.title[locale]}</h1>
        <button type="button" className="btn" onClick={onBack}>
          {t("back")}
        </button>
      </div>
      <p className="muted">{lesson.goal[locale]}</p>

      <section className="card" aria-labelledby="lesson-now">
        <div className="card-head">
          <h2 id="lesson-now">
            {finished ? t("resultTitle") : `${t("step")} ${run.step + 1} / ${lesson.steps.length}`}
          </h2>
          <span className="badge">{t("waitModeBadge")}</span>
        </div>
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={run.step}>
          <i style={{ width: `${(run.step / lesson.steps.length) * 100}%` }} />
        </div>
        {!finished && (
          <p className="target-line" aria-live="polite">
            {t("pressNow")}: <strong>{target.map(noteName).join(" + ")}</strong>
            {run.lastWrong !== null && (
              <span className="badge wrong">
                {t("wrongNote")}: {noteName(run.lastWrong)}
              </span>
            )}
          </p>
        )}
        {finished && (
          <dl className="rows">
            <dt>{t("resultSteps")}</dt>
            <dd>
              {lesson.steps.length} / {lesson.steps.length}
            </dd>
            <dt>{t("resultWrong")}</dt>
            <dd>{run.wrongPresses}</dd>
            <dt>{t("resultAccuracy")}</dt>
            <dd>{result.accuracy === null ? "—" : percent(result.accuracy)}</dd>
            <dt>{t("resultTime")}</dt>
            <dd>{result.durationMs === null ? "—" : `${(result.durationMs / 1000).toFixed(1)} s`}</dd>
          </dl>
        )}
        {finished && <p className="muted small">{run.simulated ? t("resultSimulated") : t("resultNote")}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={() => setRun(startRun())}>
            {t("restart")}
          </button>
        </div>
      </section>

      <section className="card" aria-label={t("keyboardTitle")}>
        <PianoKeyboard
          held={view.held}
          targets={target}
          low={LESSON_LOW}
          high={LESSON_HIGH}
          onPress={(p) => sendKey(p, true)}
          onRelease={(p) => sendKey(p, false)}
        />
        <p className="muted small">{desktop ? t("lessonKeyboardHint") : t("browserNotice")}</p>
      </section>
    </>
  );
}
