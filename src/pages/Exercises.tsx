import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import PianoKeyboard from "../components/PianoKeyboard";
import PhraseStaff from "../components/PhraseStaff";
import RhythmNote from "../components/RhythmNote";
import { exercisePlan, exposeQuestion, readExercises, saveExercise, sequenceInput, sequenceStart, type ExerciseKind, type ExerciseQuestion, type ExerciseRecord, type ExerciseTrial, type SequenceInput } from "../features/lessons/exercises";
import { noteName } from "../features/midi/notes";
import type { MessageKey } from "../i18n/messages";
import { backend, inDesktopApp } from "../lib/backend";
import { ExerciseAudio } from "../lib/exerciseAudio";
import { independentTrial } from "../features/lessons/learningPath";
import "../styles/path.css";

export const exerciseTitles:Record<ExerciseKind,MessageKey>={direction:"exDirection",melody:"exMelody",phrase:"exPhrase",rhythm:"exRhythm"};
const helpKeys:Record<ExerciseKind,MessageKey>={direction:"exDirectionHelp",melody:"exMelodyHelp",phrase:"exPhraseHelp",rhythm:"exRhythmHelp"};
type Session={id:string;kind:ExerciseKind;mode:"learn"|"check";questions:ExerciseQuestion[];index:number;done:ExerciseTrial[];trial:ExerciseTrial|null;input:SequenceInput;simulated:boolean;sourceKnown:boolean;pauses:number;phase:"ready"|"playing"|"answer"|"feedback"|"paused"|"results";feedback:"good"|"wrong"|null;issue:boolean;saved:boolean;};
interface Props {t:(key:MessageKey)=>string;initialKind:ExerciseKind;onBack:()=>void;onFocusChange?:(focus:boolean)=>void;}
export default function Exercises({t,initialKind,onBack,onFocusChange}:Props){
  const desktop=inDesktopApp();
  const [kind,setKind]=useState(initialKind),[mode,setMode]=useState<"learn"|"check">("learn"),[count,setCount]=useState(6),[keyboard,setKeyboard]=useState(!desktop),[explaining,setExplaining]=useState(true);
  const session=useRef<Session|null>(null),live=useRef(true),screenKeys=useRef(new Set<number>());
  const heading=useRef<HTMLDivElement>(null);
  const [,redraw]=useReducer((n:number)=>n+1,0);
  const audio=useMemo(()=>new ExerciseAudio(desktop?(pitch,down)=>backend.midiSimulate(down?[0x90,pitch,80]:[0x80,pitch,0]):undefined),[desktop]);
  const clearKeys=useCallback(()=>{screenKeys.current.forEach((p)=>{if(desktop)void backend.midiSimulate([0x80,p,0]).catch(()=>undefined);});screenKeys.current.clear();const s=session.current;if(s)s.input={...s.input,held:[],release:false};},[desktop]);
  const persist=useCallback(()=>{
    const s=session.current;if(!s)return;
    const trials=[...s.done,...(s.trial?[s.trial]:[])];if(!trials.length)return;
    const record:ExerciseRecord={id:s.id,at:new Date().toISOString(),kind:s.kind,mode:s.mode,count:s.questions.length,completed:s.phase==="results",simulated:s.simulated,pauses:s.pauses,trials};
    s.saved=saveExercise(record);
  },[]);
  const expose=useCallback(()=>{
    const s=session.current;if(!s||s.trial)return;
    const q=s.questions[s.index],unseen=exposeQuestion(q.id,new Date().toISOString());
    s.trial={question:q.id,wrong:0,plays:0,helped:s.mode==="learn",unseen,finished:false};if(unseen===null)s.saved=false;
  },[]);
  const pause=useCallback(()=>{
    audio.stop();clearKeys();const s=session.current;
    if(s&&s.phase!=="results"&&s.phase!=="paused"){
      if(s.phase!=="feedback"){s.pauses++;s.input=sequenceStart();s.phase="paused";}persist();
      if(live.current)redraw();
    }
  },[audio,clearKeys,persist]);
  useEffect(()=>{live.current=true;return()=>{live.current=false;audio.dispose();clearKeys();persist();};},[audio,clearKeys,persist]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")pause();};const hidden=()=>{if(document.hidden)pause();};window.addEventListener("blur",pause);window.addEventListener("keydown",key);document.addEventListener("visibilitychange",hidden);return()=>{window.removeEventListener("blur",pause);window.removeEventListener("keydown",key);document.removeEventListener("visibilitychange",hidden);};},[pause]);
  const receive=useCallback((pitch:number,down:boolean,simulated:boolean)=>{
    const s=session.current;if(!s||s.phase!=="answer"||!(s.kind==="phrase"||s.kind==="melody"))return;
    expose();if(!s.sourceKnown){s.simulated=simulated;s.sourceKnown=true;}else s.simulated ||= simulated;
    const q=s.questions[s.index],prior=s.input.wrong;
    s.input=sequenceInput({...s.input,wrong:s.trial?.wrong??0},q.pitches,pitch,down);
    if(s.trial)s.trial.wrong=Math.max(s.trial.wrong,s.input.wrong);
    if(s.input.wrong>prior){s.feedback="wrong";persist();}
    if(s.input.cursor===q.pitches.length&&s.input.held.length===0){s.trial!.finished=true;s.feedback="good";s.phase="feedback";persist();}
    if(live.current)redraw();
  },[expose,persist]);
  useEffect(()=>{
    if(!desktop)return;let active=true;
    const subs=[backend.onMidiEvent((e)=>{if(active&&!e.simulated&&e.pitch!==null&&(e.kind==="noteOn"||e.kind==="noteOff"))receive(e.pitch,e.kind==="noteOn",false);}),backend.onMidiReset(()=>{if(active)pause();})];
    subs.forEach((p)=>void p.catch(()=>{if(active){pause();if(session.current)session.current.issue=true;redraw();}}));
    return()=>{active=false;subs.forEach((p)=>void p.then((stop)=>stop(),()=>undefined));};
  },[desktop,receive,pause]);
  const playingFocus=!!session.current&&session.current.phase!=="results";
  const focusKey=session.current?`${session.current.id}:${session.current.index}:${session.current.phase==="paused"?"paused":session.current.phase==="results"?"results":"question"}`:"setup";
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo(0,0);},[focusKey]);
  useEffect(()=>{onFocusChange?.(playingFocus);return()=>onFocusChange?.(false);},[playingFocus,onFocusChange]);
  const listen=async()=>{
    const s=session.current;if(!s||s.phase==="playing"||s.phase==="results"||s.phase==="feedback")return;
    clearKeys();s.input={...sequenceStart(),wrong:s.trial?.wrong??0};s.feedback=null;expose();s.trial!.plays++;s.issue=false;s.phase="playing";persist();redraw();
    const q=s.questions[s.index];
    try{
      const finished=await audio.play(s.kind==="rhythm"?[60]:q.pitches,s.kind==="rhythm"?(q.beats??1)*600:600);
      if(live.current&&session.current===s&&s.phase==="playing"&&finished){s.phase="answer";redraw();}
    }catch{if(live.current&&session.current===s){if(s.phase==="playing")s.phase="ready";s.issue=true;redraw();}}
  };
  const start=()=>{
    const data=readExercises();const values=new Uint32Array(1);crypto.getRandomValues(values);
    const questions=exercisePlan(kind,count,values[0],data.ok?data.data.seen:{},mode);
    session.current={id:crypto.randomUUID(),kind,mode,questions,index:0,done:[],trial:null,input:sequenceStart(),simulated:true,sourceKnown:false,pauses:0,phase:kind==="melody"||kind==="direction"?"ready":"answer",feedback:null,issue:false,saved:data.ok};
    if(kind==="phrase"||kind==="rhythm")expose();setExplaining(false);redraw();window.scrollTo(0,0);
  };
  const answer=(value:string)=>{
    const s=session.current;if(!s||s.phase!=="answer")return;expose();s.simulated=true;s.sourceKnown=true;
    if(value===s.questions[s.index].answer){s.trial!.finished=true;s.phase="feedback";s.feedback="good";}else{s.trial!.wrong++;s.feedback="wrong";}
    persist();redraw();
  };
  const next=()=>{
    const s=session.current;if(!s||s.phase!=="feedback"||!s.trial)return;
    audio.stop();clearKeys();s.done.push(s.trial);s.trial=null;
    if(s.index===s.questions.length-1){s.phase="results";}else{s.index++;s.input=sequenceStart();s.feedback=null;s.phase=s.kind==="direction"||s.kind==="melody"?"ready":"answer";if(s.kind==="phrase"||s.kind==="rhythm")expose();}
    persist();redraw();
  };
  const screenInput=(pitch:number,down:boolean)=>{
    if(down)screenKeys.current.add(pitch);else screenKeys.current.delete(pitch);
    receive(pitch,down,true);
    if(desktop)void backend.midiSimulate(down?[0x90,pitch,80]:[0x80,pitch,0]).catch(()=>{if(live.current&&session.current){session.current.issue=true;redraw();}});
  };
  const s=session.current;
  if(!s)return <div className="path-page exercise-setup"><header><button className="btn text" onClick={onBack}>{t("exBack")}</button><h1 className="title">{t("exTitle")}</h1><p className="muted">{t("exIntro")}</p></header><div className="exercise-setup-grid"><label>{t("pathScope")}<select value={kind} onChange={(e)=>{setKind(e.target.value as ExerciseKind);setExplaining(true);}}>{Object.entries(exerciseTitles).map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select></label><label>{t("exMode")}<select value={mode} onChange={(e)=>setMode(e.target.value as "learn"|"check")}><option value="learn">{t("exLearn")}</option><option value="check">{t("exCheck")}</option></select></label><label>{t("exCount")}<select value={count} onChange={(e)=>setCount(Number(e.target.value))}>{[3,6,12,24].map((n)=><option key={n}>{n}</option>)}</select></label></div><section className="exercise-card"><h2>{t(exerciseTitles[kind])}</h2><p>{t(helpKeys[kind])}</p>{kind==="phrase"&&<PhraseStaff pitches={[60,62,64]} label="C4 D4 E4" />}{kind==="rhythm"&&<div className="exercise-answer-options">{[1,2,4].map((beats)=><div key={beats}><RhythmNote beats={beats} label={t("exBeats").replace("{count}",String(beats))}/><span>{t("exBeats").replace("{count}",String(beats))}</span></div>)}</div>}<p className="small muted">{t(kind==="rhythm"?"exRhythmTheoryOnly":kind==="direction"?"exDirectionsOnly":"pathPitchOnly")}</p>{mode==="check"&&<p className="small muted">{t("exIndependentRule")}</p>}</section><button className="btn primary" onClick={start}>{t("exStart")}</button></div>;
  if(s.phase==="results")return <div className="exercise-results" ref={heading} tabIndex={-1}><span className="eyebrow">{t(exerciseTitles[s.kind])} · {t(s.simulated?"pathSim":"pathReal")}</span><h1>{t("exResults")}</h1><p>{t(s.mode==="learn"?"exPracticeOnly":"exNoTiming")}</p><div className="exercise-summary"><div><strong>{s.done.filter((q)=>s.mode==="learn"?q.wrong===0:independentTrial(q,s.kind)).length} / {s.done.length}</strong>{t(s.mode==="learn"?"pathFirst":"exFirst")}</div><div><strong>{s.done.reduce((n,q)=>n+q.wrong,0)}</strong>{t("pathWrong")}</div><div><strong>{s.pauses}</strong>{t("exPauses")}</div></div><p className="small muted">{t("pathNewForm")}</p><table><thead><tr><th>{t("exForm")}</th><th>{t("pathWrong")}</th><th>{t("exPlays")}</th></tr></thead><tbody>{s.done.map((q,i)=><tr key={i}><td>{i+1} · {s.kind==="rhythm"?t("exBeats").replace("{count}",String(s.questions[i].beats)):s.questions[i].pitches.map(noteName).join(" → ")}<small className="muted"> · {t(q.unseen===true?"exExposure":q.unseen===false?"exKnown":"exUnknown")}{q.helped?` · ${t("exHintUsed")}`:""}</small></td><td>{q.wrong}</td><td>{q.plays}</td></tr>)}</tbody></table><p role="status">{t(s.saved?"exSaved":"exSaveError")}</p><button className="btn primary" onClick={()=>{session.current=null;redraw();}}>{t("exNewRound")}</button><button className="btn" onClick={onBack}>{t("exBack")}</button></div>;
  const q=s.questions[s.index],auditory=s.kind==="direction"||s.kind==="melody",helped=s.trial?.helped??s.mode==="learn";
  return <div className="exercise-focus" ref={heading} tabIndex={-1}><header><button className="btn text" onClick={()=>{pause();onBack();}}>{t("exReturn")}</button><span className="exercise-status">{s.index+1} / {s.questions.length}</span><button className="btn" onClick={pause}>{t("exPause")}</button></header>
    {s.phase==="paused"?<section className="exercise-question"><h1>{t("exPaused")}</h1><p>{t("exResumeHint")}</p><label><input type="checkbox" checked={keyboard} onChange={(e)=>setKeyboard(e.target.checked)} />{t("exShowKeyboard")}</label><button className="btn primary" onClick={()=>{s.input=sequenceStart();s.phase=auditory?"ready":"answer";redraw();}}>{t("exResume")}</button></section>:<>
    <section className="exercise-question"><span className="eyebrow">{t(exerciseTitles[s.kind])} · {t(!s.sourceKnown?"exNoInput":s.simulated?"pathSim":"pathReal")}</span><h1>{t(({direction:"exAnswerDirection",melody:"exAnswerMelody",phrase:"exAnswerPhrase",rhythm:"exAnswerRhythm"} as const)[s.kind])}</h1>
      {s.kind==="phrase"&&<PhraseStaff pitches={q.pitches} label={t("exAnswerPhrase")} />}
      {s.kind==="rhythm"&&<RhythmNote beats={q.beats??1} label={t("exAnswerRhythm")} />}
      {(auditory||s.kind==="rhythm")&&<button className="btn big" disabled={s.phase==="playing"||s.phase==="feedback"} onClick={()=>void listen()}>{t(s.phase==="playing"?"exPlaying":s.trial?.plays?"exReplay":"exListen")}</button>}
      {s.kind==="direction"&&<div className="exercise-answer-options">{["up","down","same"].map((value)=><button className="btn big" key={value} disabled={s.phase!=="answer"} onClick={()=>answer(value)}>{t(value==="up"?"exUp":value==="down"?"exDown":"exSame")}</button>)}</div>}
      {s.kind==="rhythm"&&<div className="exercise-answer-options">{[1,2,4].map((n)=><button className="btn big" key={n} disabled={s.phase!=="answer"} onClick={()=>answer(String(n))}>{t("exBeats").replace("{count}",String(n))}</button>)}</div>}
      {(s.kind==="melody"||s.kind==="phrase")&&s.phase==="answer"&&<span className="exercise-status">{s.input.cursor} / {q.pitches.length} · {t("exInstruction")}</span>}
    </section>
    <div className="exercise-feedback" role="status" aria-live="polite">{s.feedback?t(s.feedback==="good"?"exGood":"exWrong"):s.phase==="ready"?t("exListenFirst"):""}</div>
    {s.phase==="feedback"?<div className="exercise-controls"><button className="btn primary" onClick={next}>{t(s.index===s.questions.length-1?"exFinish":"exNext")}</button></div>:<>
      {keyboard&&(s.kind==="melody"||s.kind==="phrase")&&s.phase==="answer"&&<div><span className="small muted">{t("exShowKeyboard")}</span><PianoKeyboard low={60} high={67} held={s.input.held} onPress={(p)=>screenInput(p,true)} onRelease={(p)=>screenInput(p,false)} /></div>}
      {helped&&s.kind!=="direction"&&s.kind!=="rhythm"&&s.phase!=="playing"&&<p className="small muted" style={{textAlign:"center"}}>{t("exNoteNames")}: {q.pitches.map(noteName).join(" → ")}</p>}
      {helped&&(s.kind==="direction"||s.kind==="rhythm")&&s.phase!=="playing"&&<p className="small muted" style={{textAlign:"center"}}>{t(helpKeys[s.kind])}</p>}
      {s.mode==="check"&&!helped&&s.phase==="answer"&&<button className="btn text" onClick={()=>{expose();s.trial!.helped=true;persist();redraw();}}>{t("exHint")}</button>}
    </>}
    </>}
    {s.issue&&<p role="alert">{t("exAudioError")}</p>}{!s.saved&&<p role="alert">{t("exSaveError")}</p>}
    {explaining&&<p>{t(helpKeys[s.kind])}</p>}
  </div>;
}

