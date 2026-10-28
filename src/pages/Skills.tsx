import { useState } from "react";
import ExerciseEvidence from "../components/ExerciseEvidence";
import { courseChapters, learningStatus } from "../features/lessons/course";
import { weakTargets } from "../features/lessons/drillHistory";
import { lessons } from "../features/lessons/lessons";
import { recordFor } from "../features/lessons/progress";
import { readSkillData, skillEvidence, skillScope } from "../features/lessons/skills";
import type { Locale, MessageKey } from "../i18n/messages";
import "../styles/path.css";

interface Props { t: (key: MessageKey) => string; locale: Locale; onPractice: () => void }
export const scopeMessage = (scope: string | null): MessageKey => ({ keyboard:"pathNarrow", treble:"pathTrebleRange", bass:"pathBassRange", chords:"pathChordThree", "range-1":"pathNarrow", "range-2":"pathMiddle", "range-3":"pathWide", "chords-1":"pathChordTwo", "chords-2":"pathChordThree", "chords-3":"pathChordFour" } as Record<string, MessageKey>)[scope ?? ""] ?? "pathNoData";
export default function Skills({ t, locale, onPractice }: Props) {
  const [data, setData] = useState(readSkillData);
  const [simulated, setSimulated] = useState(false);
  if (!data.ok) return <section className="path-page"><h1 className="title">{t("navSkills")}</h1><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={() => setData(readSkillData())}>{t("pathRetry")}</button></section>;
  const source = t(simulated ? "pathSim" : "pathReal");
  const done = courseChapters.filter((c) => {
    const status = learningStatus(c, data.learning, data.drills);
    return simulated ? !!data.learning[c.id]?.simulatedAt || data.drills.some((r) => r.simulated && r.completed && r.key === `learn-v1:${c.id}:12`) : status === "completed";
  }).length;
  return <div className="path-page">
    <header><span className="eyebrow">{t("pathEvidence")}</span><h1 className="title">{t("navSkills")}</h1></header>
    <div className="path-source" role="group" aria-label={t("pathFrom")}>{[false, true].map((value) => <button key={String(value)} className="btn" aria-pressed={simulated === value} onClick={() => setSimulated(value)}>{t(value ? "pathSim" : "pathReal")}</button>)}</div>
    <section className="path-progress"><div><span>{t("pathCompleted")} · {source}</span><strong>{done} / {courseChapters.length}</strong></div><p className="small muted">{t("pathNoMastery")}</p></section>
    <div className="skill-grid">{(["notes", "staff", "chords"] as const).map((kind) => {
      const { latest, previous } = skillEvidence(data.drills, simulated, kind);
      return <section className="skill-card" key={kind}><h2>{t(kind === "notes" ? "pathNotes" : kind === "staff" ? "pathStaff" : "pathChords")}</h2>
        {latest ? <><span className="eyebrow">{t("pathFamiliar")}</span><div className="skill-value">{latest.trials.filter((q) => q.firstTry).length}<span> / {latest.trials.length}</span></div><span className="small muted">{t("pathFirst")} · {source}</span><dl className="rows"><dt>{t("pathScope")}</dt><dd>{t(scopeMessage(skillScope(latest)))}</dd><dt>{t("pathDate")}</dt><dd>{new Date(latest.at).toLocaleString(locale)}</dd><dt>{t("pathWrong")}</dt><dd>{latest.trials.reduce((sum, q) => sum + q.wrong, 0)}</dd></dl>
          <details><summary>{t("pathEvidence")}</summary><p className="small muted">{t("pathSame")}</p><table className="skill-table"><thead><tr><th>{t("pathDate")}</th><th>{t("pathFirst")}</th></tr></thead><tbody>{[...previous, latest].map((r) => <tr key={r.id}><td>{new Date(r.at).toLocaleDateString(locale)}</td><td>{r.trials.filter((q) => q.firstTry).length} / {r.trials.length}</td></tr>)}</tbody></table><p className="small">{weakTargets(latest).map((w) => `${w.id} × ${w.wrong}`).join(" · ")}</p></details>
        </> : <p className="skill-empty">{t("pathNoData")}</p>}
      </section>;
    })}</div>
    <ExerciseEvidence t={t} locale={locale} simulated={simulated} />
    <button className="btn primary" onClick={onPractice}>{t("pathPractice")}</button><p className="small muted">{t("pathHistory")} · {t("pathNotMeasured")}</p>
    <details><summary>{t("pathOld")}</summary>{lessons.filter((l) => { const r = recordFor(data.legacy, l); return simulated ? r.screenRuns > 0 : r.pianoRuns > 0; }).map((l) => { const r = recordFor(data.legacy, l); return <p key={l.id}>{l.title[locale]} · {source} · {simulated ? r.screenRuns : r.pianoRuns} {t("pathRound")}</p>; })}</details>
  </div>;
}
