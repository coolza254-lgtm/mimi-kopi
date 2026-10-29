import { useState } from "react";
import { courseChapters, type CourseChapter } from "../features/lessons/course";
import { readSkillData } from "../features/lessons/skills";
import { readExercises, type ExerciseKind } from "../features/lessons/exercises";
import { learningPath, nextPathStep, pathStepStatus } from "../features/lessons/learningPath";
import type { PracticeIntent } from "../features/lessons/practiceNavigation";
import type { MessageKey } from "../i18n/messages";
import "../styles/path.css";
interface Props {t:(key:MessageKey)=>string;onChapter:(chapter:CourseChapter)=>void;onExercise:(kind:ExerciseKind)=>void;onSkills:()=>void;onPractice:(intent:PracticeIntent)=>void;}
export default function LearningPath({t,onChapter,onExercise,onSkills,onPractice}:Props){
 const [pathData,setPathData]=useState(readSkillData),[exerciseData,setExerciseData]=useState(readExercises);
 const progress=pathData.ok?pathData.learning:{},drills=pathData.ok?pathData.drills:[];
 const exercises=exerciseData.ok?exerciseData.data.records:[];
 const next=nextPathStep(progress,drills,exercises);
 const [selected,setSelected]=useState(next.id);
 const current=learningPath.find((s)=>s.id===selected)!;
 const currentStatus=pathStepStatus(current,progress,drills,exercises);
 const detailLabel=current.id===next.id?(currentStatus==="new"?"pathNext":"dailyReviewTopic"):"pathExplore";
 const retry=()=>{const loaded=readSkillData(),loadedExercises=readExercises();setPathData(loaded);setExerciseData(loadedExercises);if(loaded.ok&&loadedExercises.ok)setSelected(nextPathStep(loaded.learning,loaded.drills,loadedExercises.data.records).id);};
 if(!pathData.ok||!exerciseData.ok)return <div className="path-page"><h1 className="title">{t("pathTitle")}</h1><p role="alert">{t("pathLoadError")}</p><button className="btn" onClick={retry}>{t("pathRetry")}</button><button className="btn" onClick={onSkills}>{t("pathLinkSkills")}</button></div>;
 const open=()=>{if(current.chapter)onChapter(courseChapters.find((c)=>c.id===current.chapter)!);else onExercise(current.exercise!);};
 return <div className="path-page"><header><span className="eyebrow">{t("pathGoal")}</span><h1 className="title">{t("pathTitle")}</h1><p className="muted">{t("pathIntro")}</p></header><div className="learning-route"><ol aria-label={t("pathTitle")}>{learningPath.map((item,i)=>{
 const status=pathStepStatus(item,progress,drills,exercises);
 return <li className="route-node" key={item.id}><button aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><span>{String(i+1).padStart(2,"0")}</span><span><strong>{t(item.title)}</strong><small>{status==="new"?t("learnNew"):t(status==="simulated"?"learnSimComplete":"learnComplete")}</small></span></button></li>;
 })}</ol><section className="route-detail" aria-label={t(current.title)}><span className="eyebrow">{t(detailLabel)}</span><h2>{t(current.title)}</h2><p>{t(current.goal)}</p><div className="route-actions"><button className="btn primary" aria-label={`${t("learnOpen")} · ${t(current.title)}`} onClick={open}>{t("pathHelp")}<span aria-hidden="true">→</span></button>{current.chapter&&<button className="btn" onClick={()=>onPractice({kind:"chapter",chapterId:current.chapter!})}>{t("pathPractice")}<span aria-hidden="true">→</span></button>}{current.chapter==="treble"&&<button className="btn" onClick={()=>onExercise("phrase")}>{t("pathApply")}<span aria-hidden="true">→</span></button>}<button className="btn text" onClick={onSkills}>{t("pathLinkSkills")}</button></div><p className="small muted">{t("pathNoMastery")}</p><p className="small muted">{t("pathLater")}</p></section></div></div>;
}
