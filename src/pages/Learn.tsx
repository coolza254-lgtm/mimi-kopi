import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordFingerGuide from "../components/ChordFingerGuide";
import PianoKeyboard from "../components/PianoKeyboard";
import ReadingStaff from "../components/ReadingStaff";
import LearningPath from "../components/LearningPath";
import Exercises from "./Exercises";
import type { ExerciseKind } from "../features/lessons/exercises";
import { chapterPlan, chapterTargets, saveChapterCompletion, type CourseChapter } from "../features/lessons/course";
import type { DrillRecord } from "../features/lessons/drillHistory";
import type { DrillTarget } from "../features/lessons/drills";
import { noteName } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";
import PracticePrograms from "./PracticePrograms";
import "../styles/learn.css";

interface Props { t: (key: MessageKey) => string; locale: Locale; onFocusChange?: (focus: boolean) => void; onOpenSound?: () => void; onSkills?:()=>void; onPractice?:()=>void }
export default function Learn({ t, locale, onFocusChange, onOpenSound, onSkills, onPractice }: Props) {
  const [exercise,setExercise]=useState<ExerciseKind|null>(null);
  const [chapter, setChapter] = useState<CourseChapter | null>(null);
  const [step, setStep] = useState(0);
  const [solved, setSolved] = useState(false);
  const [assessment, setAssessment] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = useCallback((record: DrillRecord) => !!chapter && saveChapterCompletion(chapter, record), [chapter]);
  const course = useMemo(() => chapter ? { plan: chapterPlan(chapter), title: t(chapter.title), onComplete: complete } : undefined, [chapter, complete, t]);
  const targets = useMemo(() => chapter ? chapterTargets(chapter) : [], [chapter]);
  useEffect(() => { if (assessment || exercise) return; onFocusChange?.(!!chapter); return () => onFocusChange?.(false); }, [chapter, assessment, exercise, onFocusChange]);
  const solve = useCallback(() => setSolved(true), []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [chapter, step, assessment]);
  const back = () => { setAssessment(false); setChapter(null); };
  if(exercise)return <Exercises key={exercise} initialKind={exercise} t={t} onBack={()=>setExercise(null)} onFocusChange={onFocusChange} />;
  if (assessment && course) return <PracticePrograms t={t} locale={locale} course={course} onLegacy={back} onFocusChange={onFocusChange} onOpenSound={onOpenSound} />;
  if (chapter) {
    const target = targets[step];
    const last = step === chapter.steps.length - 1;
    return <div className="learn-lesson">
      <header className="learn-top"><button className="btn text" onClick={back}>{t("learnBack")}</button><span>{step + 1} / {chapter.steps.length}</span></header>
      <div className="learn-step-meter" aria-hidden="true">{chapter.steps.map((_, i) => <i key={i} className={i <= step ? "reached" : ""} />)}</div>
      <section className="learn-explanation"><span className="eyebrow">{t(chapter.title)}</span><h1 className="title" ref={heading} tabIndex={-1}>{t("learnTry").replace("{note}", target.name ?? noteName(target.pitches[0]))}</h1><p>{t(chapter.steps[step])}</p></section>
      <LearningExample key={`${chapter.id}:${step}`} chapter={chapter} target={target} t={t} onSolved={solve} />
      <footer className="learn-actions"><button className="btn text" disabled={step === 0} onClick={() => { setStep(step - 1); setSolved(false); }}>{t("learnPrevious")}</button>
        <div><span className="small muted">{!solved && t("learnContinueHint")}</span><button className="btn primary" disabled={!solved} onClick={() => { if (last) setAssessment(true); else { setStep(step + 1); setSolved(false); } }}>{t(last ? "learnAssessment" : "learnNext")}</button></div>
      </footer>
    </div>;
  }
  return <LearningPath t={t} onChapter={(item)=>{setStep(0);setSolved(false);setChapter(item);}} onExercise={setExercise} onSkills={onSkills??(()=>{})} onPractice={onPractice??(()=>{})} />;
}

function LearningExample({ chapter, target, t, onSolved }: { chapter: CourseChapter; target: DrillTarget; t: Props["t"]; onSolved: () => void }) {
  const desktop = inDesktopApp();
  const [held, setHeld] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"good" | "wrong" | null>(null);
  const [issue, setIssue] = useState(false);
  const keys = useRef(new Set<number>());
  const screenKeys = useRef(new Set<number>());
  const active = useRef(true);
  const handle = useCallback((pitch: number, down: boolean) => {
    if (down) keys.current.add(pitch); else keys.current.delete(pitch);
    setHeld([...keys.current]);
    if (down && !target.pitches.includes(pitch)) { setFeedback("wrong"); return; }
    if (keys.current.size === target.pitches.length && target.pitches.every((p) => keys.current.has(p))) { setFeedback("good"); onSolved(); }
  }, [target, onSolved]);
  const send = useCallback((pitch: number, down: boolean) => {
    if (down) screenKeys.current.add(pitch); else screenKeys.current.delete(pitch);
    handle(pitch, down);
    if (desktop) void backend.midiSimulate(down ? [0x90, pitch, 84] : [0x80, pitch, 0]).catch(() => { if (active.current) setIssue(true); });
  }, [desktop, handle]);
  useEffect(() => {
    active.current = true;
    const clear = () => {
      screenKeys.current.forEach((p) => { if (desktop) void backend.midiSimulate([0x80, p, 0]).catch(() => undefined); });
      screenKeys.current.clear(); keys.current.clear();
      if (active.current) setHeld([]);
    };
    const receive = (e: MidiEvent) => { if (active.current && !e.simulated && e.pitch !== null && (e.kind === "noteOn" || e.kind === "noteOff")) handle(e.pitch, e.kind === "noteOn"); };
    const subs = desktop ? [backend.onMidiEvent(receive), backend.onMidiReset(clear)] : [];
    subs.forEach((p) => void p.catch(() => { if (active.current) setIssue(true); }));
    window.addEventListener("blur", clear);
    return () => { active.current = false; window.removeEventListener("blur", clear); clear(); subs.forEach((p) => void p.then((stop) => stop(), () => undefined)); };
  }, [desktop, handle]);
  return <section className="learn-example">
    {chapter.kind === "staff" && <ReadingStaff pitch={target.pitches[0]} label={noteName(target.pitches[0])} />}
    {chapter.kind === "chords" && <><span className="small muted">{t("learnScreen")} · {t("drillLatch")}</span><ChordFingerGuide target={target} t={t} keyboard={{ held, onPress: (p) => send(p, true), onRelease: (p) => send(p, false) }} /></>}
    <div className="learn-example-feedback" role="status">{feedback && t(feedback === "good" ? "learnGood" : "learnAgain")}</div>
    {chapter.kind !== "chords" && <><span className="small muted">{t("learnScreen")}</span><PianoKeyboard low={chapter.id === "bass" ? 48 : 60} high={chapter.id === "bass" ? 60 : 72} targets={target.pitches} held={held} onPress={(p) => send(p, true)} onRelease={(p) => send(p, false)} /></>}
    {issue && <p className="small" role="alert">{t("exAudioError")}</p>}
  </section>;
}
