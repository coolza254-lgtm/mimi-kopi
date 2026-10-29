import { useState } from "react";
import ExerciseEvidence from "../components/ExerciseEvidence";
import { noteName } from "../features/midi/notes";
import { chordTargets } from "../features/lessons/drills";
import { courseChapters, learningStatus } from "../features/lessons/course";
import { weakTargets } from "../features/lessons/drillHistory";
import { lessons } from "../features/lessons/lessons";
import { recordFor } from "../features/lessons/progress";
import { readSkillData, skillEvidence, skillScope } from "../features/lessons/skills";
import { skillPracticeIntent, type PracticeIntent } from "../features/lessons/practiceNavigation";
import type { Locale, MessageKey } from "../i18n/messages";
import "../styles/path.css";
import "../styles/learning-expression.css";

interface Props { t: (key: MessageKey) => string; locale: Locale; onPractice: (intent?: PracticeIntent) => void }
export const scopeMessage = (scope: string | null): MessageKey => ({ keyboard:"pathNarrow", treble:"pathTrebleRange", bass:"pathBassRange", chords:"pathChordThree", "range-1":"pathNarrow", "range-2":"pathMiddle", "range-3":"pathWide", "chords-1":"pathChordTwo", "chords-2":"pathChordThree", "chords-3":"pathChordFour" } as Record<string, MessageKey>)[scope ?? ""] ?? "pathNoData";
export default function Skills({ t, locale, onPractice }: Props) {
  const [data, setData] = useState(readSkillData);
  const [simulated, setSimulated] = useState(false);
  if (!data.ok) return <section className="path-page skills-expression"><h1 className="title">{t("navSkills")}</h1><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={() => setData(readSkillData())}>{t("pathRetry")}</button></section>;
  const source = t(simulated ? "pathSim" : "pathReal");
  const done = courseChapters.filter((c) => {
    const status = learningStatus(c, data.learning, data.drills);
    return simulated ? !!data.learning[c.id]?.simulatedAt || data.drills.some((r) => r.simulated && r.completed && r.key === `learn-v1:${c.id}:12`) : status === "completed";
  }).length;
  return <div className="path-page skills-expression">
    <header><h1 className="title">{t("navSkills")}</h1></header>
    <div className="path-source" role="group" aria-label={t("pathFrom")}>{[false, true].map((value) => <button key={String(value)} className="btn" aria-pressed={simulated === value} onClick={() => setSimulated(value)}>{t(value ? "pathSim" : "pathReal")}</button>)}</div>
    <section className="path-progress skills-completion"><div><span>{t("pathCompleted")} · {source}</span><strong>{done} / {courseChapters.length}</strong></div><p className="small muted">{t("pathNoMastery")}</p></section>
    <div className="skill-grid">{(["notes", "staff", "chords"] as const).map((kind) => {
      const { latest, previous } = skillEvidence(data.drills, simulated, kind);
      const intent = skillPracticeIntent(kind, latest);
      const scope = latest ? skillScope(latest) : kind === "notes" ? "keyboard" : kind === "staff" ? "treble" : "chords";
      return <section className="skill-card" data-kind={kind} key={kind}><div className="skill-card-heading"><span className="skill-mark"><SkillMark kind={kind} /></span><h2>{t(kind === "notes" ? "pathNotes" : kind === "staff" ? "pathStaff" : "pathChords")}</h2></div>
        {latest ? <><span className="eyebrow">{t("pathFamiliar")}</span><div className="skill-value">{latest.trials.filter((q) => q.firstTry).length}<span> / {latest.trials.length}</span></div><span className="small muted">{t("pathFirst")} · {source}</span><dl className="rows"><dt>{t("pathScope")}</dt><dd>{t(scopeMessage(skillScope(latest)))}</dd><dt>{t("pathDate")}</dt><dd>{new Date(latest.at).toLocaleString(locale)}</dd><dt>{t("pathWrong")}</dt><dd>{latest.trials.reduce((sum, q) => sum + q.wrong, 0)}</dd></dl>
          <details><summary>{t("pathEvidence")}</summary><p className="small muted">{t("pathSame")}</p><table className="skill-table"><thead><tr><th>{t("pathDate")}</th><th>{t("pathFirst")}</th></tr></thead><tbody>{[...previous, latest].map((r) => <tr key={r.id}><td>{new Date(r.at).toLocaleDateString(locale)}</td><td>{r.trials.filter((q) => q.firstTry).length} / {r.trials.length}</td></tr>)}</tbody></table><p className="small">{weakTargets(latest).map((w) => `${/^\d+$/.test(w.id)?noteName(Number(w.id)):chordTargets.find((q)=>q.id===w.id)?.name??w.id} × ${w.wrong}`).join(" · ")}</p></details>
        </> : <p className="skill-empty">{t("pathNoData")}</p>}
        <button className="btn" onClick={() => onPractice(intent)} aria-label={`${t("pathPractice")} · ${t(kind === "notes" ? "pathNotes" : kind === "staff" ? "pathStaff" : "pathChords")} · ${t(scopeMessage(scope))}`}>{t("pathPractice")} · {t(scopeMessage(scope))}</button>
      </section>;
    })}</div>
    <ExerciseEvidence t={t} locale={locale} simulated={simulated} />
    <button className="btn primary" onClick={() => onPractice()}>{t("pathPractice")}</button><p className="small muted">{t("pathHistory")} · {t("pathNotMeasured")}</p>
    <details><summary>{t("pathOld")}</summary>{lessons.filter((l) => { const r = recordFor(data.legacy, l); return simulated ? r.screenRuns > 0 : r.pianoRuns > 0; }).map((l) => { const r = recordFor(data.legacy, l); return <p key={l.id}>{l.title[locale]} · {source} · {simulated ? r.screenRuns : r.pianoRuns} {t("pathRound")}</p>; })}</details>
  </div>;
}

function SkillMark({ kind }: { kind: "notes" | "staff" | "chords" }) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none">
    {kind === "notes" ? <><path d="M18 23V7l8-2v6l-8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><ellipse cx="13.5" cy="23.5" rx="5" ry="3.5" transform="rotate(-20 13.5 23.5)" fill="currentColor" /></>
      : kind === "staff" ? <><path d="M4 8h24M4 13h24M4 18h24M4 23h24M4 28h24" stroke="currentColor" strokeWidth="1" opacity=".45" /><path d="M20 21V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><ellipse cx="16" cy="22" rx="5" ry="3.5" transform="rotate(-20 16 22)" fill="currentColor" /></>
        : <><path d="M8 8v17M16 6v17M24 4v17M8 8l16-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 22c5-3 8 2 3 5s-8-2-3-5Zm8-2c5-3 8 2 3 5s-8-2-3-5Zm8-2c5-3 8 2 3 5s-8-2-3-5Z" fill="currentColor" /></>}
  </svg>;
}