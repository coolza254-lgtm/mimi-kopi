import { useState } from "react";
import { delayedTrials, independentTrial } from "../features/lessons/learningPath";
import { readExercises } from "../features/lessons/exercises";
import type { Locale, MessageKey } from "../i18n/messages";
const titles={direction:"exDirection",melody:"exMelody",phrase:"exPhrase",rhythm:"exRhythm"} as const;
export default function ExerciseEvidence({t,locale,simulated}:{t:(key:MessageKey)=>string;locale:Locale;simulated:boolean}){
 const [loaded]=useState(readExercises);
 if(!loaded.ok)return <p role="alert">{t("pathLoadError")}</p>;
 const records=loaded.data.records.filter((r)=>r.simulated===simulated).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,12);
 return <section className="exercise-evidence"><h2>{t("exHistory")}</h2><p className="small muted">{t("exNoComparison")}</p>{!records.length&&<p className="muted">{t("exNoResults")}</p>}{records.map((r)=>{
 const review=delayedTrials(loaded.data.records,r);
 return <details className="exercise-card" key={r.id}><summary>{t(titles[r.kind])} · {new Date(r.at).toLocaleString(locale)} · {t(r.completed?"exSaved":"exIncomplete")}</summary><p className="small">{t(r.mode==="learn"?"exPracticeOnly":"exCheck")} · {t(r.kind==="rhythm"?"exRhythmTheoryOnly":r.kind==="direction"?"exDirectionsOnly":"pathPitchOnly")}</p><p>{t(r.mode==="learn"?"pathFirst":"exFirst")}: {r.trials.filter((q)=>q.finished&&(r.mode==="learn"?q.wrong===0:independentTrial(q,r.kind))).length} / {r.trials.filter((q)=>q.finished).length} · {t("exPauses")}: {r.pauses}</p><table className="skill-table"><thead><tr><th>{t("exForm")}</th><th>{t("pathWrong")}</th><th>{t("exPlays")}</th></tr></thead><tbody>{r.trials.map((q,i)=><tr key={i}><td>{q.question.split(":")[1]} · {t(q.finished?"exSaved":"exIncomplete")} · {t(q.unseen===true?"exExposure":q.unseen===false?"exKnown":"exUnknown")}{q.helped?` · ${t("exHintUsed")}`:""}</td><td>{q.wrong}</td><td>{q.plays}</td></tr>)}</tbody></table>{review.map((q,i)=><p className="small" key={i}>{q.question.split(":")[1]} · {t("pathReviewAt").replace("{days}",String(q.days))} · {t("pathFirst")}: {q.firstTry?"1 / 1":"0 / 1"}</p>)}{!!review.length&&<p className="small muted">{t("pathSince")}</p>}<p className="small muted">{t("exFreshHint")}</p></details>;
 })}</section>;
}
