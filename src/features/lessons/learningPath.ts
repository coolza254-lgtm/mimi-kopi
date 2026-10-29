import { courseChapters, learningStatus, type LearningProgress } from "./course";
import type { DrillRecord } from "./drillHistory";
import type { ExerciseKind, ExerciseRecord, ExerciseTrial } from "./exercises";
import type { MessageKey } from "../../i18n/messages";
export type PathStep={id:string;chapter?:string;exercise?:ExerciseKind;title:MessageKey;goal:MessageKey};
export type LearningLaunchOptions = { mode: "learn" | "check"; count: number };
export const learningPath:readonly PathStep[]=[
 {id:"keyboard",chapter:"keyboard",title:"learnKeyboard",goal:"learnKeyboardIntro"},
 {id:"direction",exercise:"direction",title:"exDirection",goal:"exDirectionHelp"},
 {id:"rhythm",exercise:"rhythm",title:"exRhythm",goal:"exRhythmHelp"},
 {id:"treble",chapter:"treble",title:"learnTreble",goal:"learnTrebleIntro"},
 {id:"phrase",exercise:"phrase",title:"exPhrase",goal:"exPhraseHelp"},
 {id:"melody",exercise:"melody",title:"exMelody",goal:"exMelodyHelp"},
 {id:"bass",chapter:"bass",title:"learnBass",goal:"learnBassIntro"},
 {id:"chords",chapter:"chords",title:"learnChords",goal:"learnChordsIntro"},
];
export function pathStepStatus(step:PathStep,progress:LearningProgress,drills:DrillRecord[],exercises:ExerciseRecord[]):"new"|"completed"|"simulated"{
 if(step.chapter){const chapter=courseChapters.find((c)=>c.id===step.chapter)!;return learningStatus(chapter,progress,drills);}
 const rounds=exercises.filter((r)=>r.kind===step.exercise&&r.completed);
 return rounds.some((r)=>!r.simulated)?"completed":rounds.length?"simulated":"new";
}
export function nextPathStep(progress:LearningProgress,drills:DrillRecord[],exercises:ExerciseRecord[]):PathStep{
 return learningPath.find((s)=>pathStepStatus(s,progress,drills,exercises)==="new")??learningPath.find((s)=>s.id==="phrase")!;
}
export function independentTrial(trial:ExerciseTrial,kind:ExerciseKind):boolean{
 return trial.finished&&!trial.helped&&trial.wrong===0&&((kind==="melody"||kind==="direction")?trial.plays===1:true);
}
/** Repeated forms after an observed gap, with no claim about practice in between. */
export function delayedTrials(records:ExerciseRecord[],current:ExerciseRecord){
 if(!current.completed||current.mode!=="check")return [];
 return current.trials.flatMap((trial)=>{
  const prior=records.filter((r)=>r.id!==current.id&&r.completed&&r.mode==="check"&&r.kind===current.kind&&r.simulated===current.simulated&&Date.parse(r.at)<Date.parse(current.at)&&r.trials.some((q)=>q.question===trial.question&&q.finished)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  const days=prior?Math.floor((Date.parse(current.at)-Date.parse(prior.at))/86400000):0;
  return days>=1?[{question:trial.question,days,firstTry:independentTrial(trial,current.kind)}]:[];
 });
}
