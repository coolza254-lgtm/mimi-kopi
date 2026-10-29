// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import Exercises from "./Exercises";
import { readExercises, EXERCISE_KEY, type ExerciseKind } from "../features/lessons/exercises";
import { noteName } from "../features/midi/notes";
import { en } from "../i18n/messages";
import type { MidiEvent } from "../lib/backend";
const {desktop,listeners,resets,play,stop,dispose,send}=vi.hoisted(()=>({desktop:vi.fn(()=>false),listeners:new Set<(e:MidiEvent)=>void>(),resets:new Set<()=>void>(),play:vi.fn(async()=>true),stop:vi.fn(),dispose:vi.fn(),send:vi.fn(async()=>{})}));
vi.mock("../lib/exerciseAudio",()=>({ExerciseAudio:class{play=play;stop=stop;dispose=dispose;}}));
vi.mock("../lib/backend",()=>({inDesktopApp:desktop,backend:{midiSimulate:send,onMidiEvent:async(cb:(e:MidiEvent)=>void)=>{listeners.add(cb);return()=>listeners.delete(cb);},onMidiReset:async(cb:()=>void)=>{resets.add(cb);return()=>resets.delete(cb);}}}));
beforeEach(()=>{localStorage.clear();desktop.mockReturnValue(false);listeners.clear();resets.clear();play.mockReset().mockResolvedValue(true);stop.mockClear();dispose.mockClear();vi.spyOn(window,"scrollTo").mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const t=(key:keyof typeof en)=>en[key];
function start(kind:ExerciseKind){render(<Exercises t={t} initialKind={kind} onBack={()=>{}} />);fireEvent.change(screen.getByLabelText(en.exMode),{target:{value:"check"}});fireEvent.change(screen.getByLabelText(en.exCount),{target:{value:"3"}});fireEvent.click(screen.getByRole("button",{name:en.exStart}));}
function pitches(){const read=readExercises();if(!read.ok)throw Error();return Object.keys(read.data.seen).at(-1)!.split(":")[1].split("-").map(Number);}
function key(p:number){const b=screen.getByLabelText(noteName(p),{exact:true,selector:"button"});fireEvent.keyDown(b,{key:"Enter"});fireEvent.keyUp(b,{key:"Enter"});}
it("stores an independent simulated phrase round only after all released answers, with no hidden note-name help",()=>{
 start("phrase");expect(screen.queryByText(new RegExp(en.exNoteNames))).toBeNull();
 for(let i=0;i<3;i++){const notes=pitches();for(const p of notes)key(p);fireEvent.click(screen.getByRole("button",{name:i===2?en.exFinish:en.exNext}));}
 const data=readExercises();if(!data.ok)throw Error();expect(data.data.records).toHaveLength(1);
 expect(data.data.records[0]).toMatchObject({completed:true,simulated:true,mode:"check"});expect(data.data.records[0].trials.every((q)=>q.finished&&!q.helped&&q.unseen)).toBe(true);
 expect(screen.getByRole("heading",{name:en.exResults})).toBeTruthy();
});
it("preserves errors and partial rounds through pause, help, resume and leaving",()=>{
 start("phrase");const notes=pitches(),wrong=[60,62,64,65,67].find((p)=>p!==notes[0])!;key(wrong);
 fireEvent.click(screen.getByRole("button",{name:en.exHint}));fireEvent.click(screen.getByRole("button",{name:en.exPause}));
 expect(screen.getByRole("heading",{name:en.exPaused})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:en.exResume}));
 key(wrong);notes.forEach(key);fireEvent.click(screen.getByRole("button",{name:en.exNext}));cleanup();
 const data=readExercises();if(!data.ok)throw Error();expect(data.data.records[0]).toMatchObject({completed:false,pauses:1});expect(data.data.records[0].trials[0]).toMatchObject({wrong:2,helped:true,finished:true});expect(dispose).toHaveBeenCalled();
});
it("requires listening and keeps guide events out of MIDI answers; reset cancels sound and subscriptions are cleaned",async()=>{
 desktop.mockReturnValue(true);start("melody");await act(async()=>{});
 expect(screen.getByText(en.exListenFirst)).toBeTruthy();
 expect(screen.getByText(new RegExp(en.exNoInput))).toBeTruthy();
 const guide=(p:number,simulated:boolean,kind="noteOn")=>act(()=>{listeners.forEach((cb)=>cb({pitch:p,simulated,kind} as MidiEvent));});
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:en.exListen}));});const notes=pitches();
 const beforeInput=readExercises();if(!beforeInput.ok)throw Error();expect(beforeInput.data.records[0].simulated).toBe(true);
 for(const p of notes){guide(p,true);guide(p,true,"noteOff");}
 expect(screen.queryByRole("button",{name:en.exNext})).toBeNull();
 for(const p of notes){guide(p,false);guide(p,false,"noteOff");}
 expect(screen.getByRole("button",{name:en.exNext})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:en.exNext}));
 act(()=>resets.forEach((cb)=>cb()));expect(screen.getByRole("heading",{name:en.exPaused})).toBeTruthy();
 const data=readExercises();if(!data.ok)throw Error();expect(data.data.records[0].simulated).toBe(false);expect(stop).toHaveBeenCalled();cleanup();await act(async()=>{});expect(listeners.size).toBe(0);expect(resets.size).toBe(0);
});
it("cannot answer an audio question after failed playback or overwrite malformed history",async()=>{
 localStorage.setItem(EXERCISE_KEY,"broken");play.mockRejectedValue(Error("offline output"));start("direction");
 expect(screen.getByRole("button",{name:en.exUp})).toHaveProperty("disabled",true);
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:en.exListen}));});
 expect(screen.getByText(en.exAudioError)).toBeTruthy();expect(screen.getByRole("button",{name:en.exUp})).toHaveProperty("disabled",true);expect(localStorage.getItem(EXERCISE_KEY)).toBe("broken");
});
it("stays paused when an outstanding audio request fails after pausing",async()=>{
 let reject!: (reason:Error)=>void;play.mockImplementation(()=>new Promise<boolean>((_,fail)=>{reject=fail;}));
 start("direction");fireEvent.click(screen.getByRole("button",{name:en.exListen}));fireEvent.click(screen.getByRole("button",{name:en.exPause}));
 await act(async()=>{reject(Error("late output failure"));});
 expect(screen.getByRole("heading",{name:en.exPaused})).toBeTruthy();
 expect(screen.getByRole("button",{name:en.exResume})).toBeTruthy();
 expect(screen.queryByRole("button",{name:en.exUp})).toBeNull();
});
it("moves focus to feedback and advances released MIDI answers, while pause cancels the transition",async()=>{
 vi.useFakeTimers();
 try {
  start("phrase");
  pitches().forEach(key);
  expect(document.activeElement).toBe(screen.getByRole("button",{name:en.exNext}));
  act(()=>vi.advanceTimersByTime(700));
  expect(screen.getByText("2 / 3")).toBeTruthy();
  pitches().forEach(key);
  fireEvent.click(screen.getByRole("button",{name:en.exPause}));
  act(()=>vi.advanceTimersByTime(1400));
  expect(screen.getByRole("heading",{name:en.exPaused})).toBeTruthy();
  expect(screen.getByText("2 / 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:en.exResume}));
  act(()=>vi.advanceTimersByTime(700));
  expect(screen.getByText("3 / 3")).toBeTruthy();
  cleanup();
  act(()=>vi.runOnlyPendingTimers());
 } finally { vi.useRealTimers(); }
});
it("offers a fresh independent short round after supported practice and keeps the earlier result",()=>{
 render(<Exercises t={t} initialKind="phrase" initialMode="learn" initialCount={3} onBack={()=>{}} />);
 fireEvent.click(screen.getByRole("button",{name:en.exStart}));
 for(let i=0;i<3;i++){pitches().forEach(key);fireEvent.click(screen.getByRole("button",{name:i===2?en.exFinish:en.exNext}));}
 fireEvent.click(screen.getByRole("button",{name:en.dailyIndependentNext}));
 expect(screen.getByText("1 / 3")).toBeTruthy();
 expect(screen.queryByText(new RegExp(en.exNoteNames))).toBeNull();
 expect(screen.queryByLabelText(en.exMode)).toBeNull();
 const nextNotes=pitches();nextNotes.forEach(key);
 const data=readExercises();if(!data.ok)throw Error();
 expect(data.data.records).toHaveLength(2);
 expect(data.data.records.find((r)=>r.completed)).toMatchObject({mode:"learn",simulated:true});
 expect(data.data.records.find((r)=>!r.completed)).toMatchObject({mode:"check",simulated:true});
});
