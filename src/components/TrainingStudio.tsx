import { useState } from "react";
import type { MessageKey } from "../i18n/messages";
import AppIcon from "./AppIcon";
import MiniStaff from "./MiniStaff";

const tracks = [
  { id: "reading", title: "trainingReading", goal: "trainingReadingGoal", icon: "score", lesson: "treble", prefix: "trainingRead" },
  { id: "ear", title: "trainingEar", goal: "trainingEarGoal", icon: "sound", lesson: "direction", prefix: "trainingEar" },
  { id: "chords", title: "trainingChords", goal: "trainingChordsGoal", icon: "piano", lesson: "chords", prefix: "trainingChord" },
] as const;
export default function TrainingStudio({ t, onLearn, onEditor }: {
  t: (key: MessageKey) => string; onLearn: (id: string) => void; onEditor: () => void;
}) {
  const [track, setTrack] = useState(0);
  const [step, setStep] = useState(0);
  const [chord, setChord] = useState(0);
  const examples = [{name:"C",pitches:[60,64,67]}, {name:"Cm",pitches:[60,63,67]}, {name:"Am/C",pitches:[60,64,69]}];
  const selected = tracks[track];
  const practiceStep = selected.id === "reading" ? ["treble", "treble", "rhythm", "phrase", "bass"][step]
    : selected.id === "ear" && step >= 2 ? "melody" : selected.lesson;
  const title = (n: number) => t(`${selected.prefix}${n + 1}` as MessageKey);
  return <section className="training-studio" aria-label={t("trainingTitle")}>
    <header className="training-heading"><span className="eyebrow">{t("trainingBrand")}</span><h1>{t("trainingTitle")}</h1><p>{t("trainingIntro")}</p></header>
    <div className="training-tracks" role="group" aria-label={t("trainingSteps")}>
      {tracks.map((item, i) => <button key={item.id} type="button" aria-pressed={track === i} onClick={() => { setTrack(i); setStep(0); }}>
        <span className="training-track-icon"><AppIcon name={item.icon} /></span><span className="training-track-number">0{i + 1}</span>
        <strong>{t(item.title)}</strong><span>{t(item.goal)}</span>
      </button>)}
    </div>
    <div className="training-workbench">
      <div className="training-step-list" role="group" aria-label={t("trainingSteps")}>
        {Array.from({ length: 5 }, (_, i) => <button key={`${selected.id}-${i}`} type="button" aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}><span>{i + 1}</span>{title(i)}</button>)}
      </div>
      <article className="training-guide" aria-live="polite">
        <span className="eyebrow">{t(selected.title)} · {step + 1} / 5</span>
        <h2>{title(step)}</h2><p>{t(`${selected.prefix}${step + 1}Body` as MessageKey)}</p>
        {selected.id === "chords" && <div className="training-example"><div role="group" aria-label={t("trainingExample")}>{examples.map((item,i) => <button className="btn" key={item.name} aria-pressed={chord===i} onClick={() => setChord(i)}>{item.name}</button>)}</div><MiniStaff pitches={examples[chord].pitches} label={examples[chord].name} flats={chord === 1} /></div>}
        <div className="training-guide-actions"><button className="btn primary big" onClick={() => selected.id === "ear" && step >= 3 ? onEditor() : onLearn(practiceStep)}>{t(selected.id === "ear" && step >= 3 ? "trainingEditor" : "trainingOpen")} <AppIcon name="arrow" /></button>
          <div><button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("trainingPrevious")}</button><button className="btn" disabled={step === 4} onClick={() => setStep(step + 1)}>{t("trainingNext")}</button></div></div>
      </article>
    </div>
    <p className="training-principle">{t("trainingRemember")}</p>
  </section>;
}
