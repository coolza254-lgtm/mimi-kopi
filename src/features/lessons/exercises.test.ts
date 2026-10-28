import { expect, it } from "vitest";
import { exercisePlan, exposeQuestion, questionBank, readExercises, saveExercise, sequenceInput, sequenceStart, EXERCISE_KEY, type ExerciseRecord } from "./exercises";
function storage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};}
it("varies starting pitches and direction, includes repeated sounds, and prioritizes unexposed forms",()=>{
 const bank=questionBank("direction");expect(new Set(bank.map((q)=>q.answer))).toEqual(new Set(["same","up","down"]));expect(new Set(bank.map((q)=>q.pitches[0])).size).toBe(5);
 const seen=Object.fromEntries(questionBank("melody").slice(1).map((q)=>[q.id,"2026-10-28T00:00:00Z"]));
 const plan=exercisePlan("melody",6,12,seen);expect(plan[0].id).toBe(questionBank("melody")[0].id);expect(new Set(plan.map((q)=>q.id)).size).toBe(6);
 expect(exercisePlan("melody",6,99,{})).not.toEqual(plan);
 const naturals=[60,62,64,65,67];expect(exercisePlan("phrase",24,99,{},"learn").every((q)=>q.pitches.every((p,i)=>i===0||Math.abs(naturals.indexOf(p)-naturals.indexOf(q.pitches[i-1]))<=1))).toBe(true);
});
it("records exposure before an abandoned attempt, preserves it across history rotation, and rejects corrupt storage",()=>{
 const store=storage(), id=questionBank("phrase")[0].id, now="2026-10-28T00:00:00Z";
 expect(exposeQuestion(id,now,store)).toBe(true);expect(exposeQuestion(id,now,store)).toBe(false);
 const record:ExerciseRecord={id:"a",at:now,kind:"phrase",mode:"check",count:3,completed:false,simulated:false,pauses:0,trials:[{question:id,wrong:1,plays:0,helped:false,unseen:true,finished:false}]};
 for(let i=0;i<205;i++)expect(saveExercise({...record,id:String(i)},store)).toBe(true);
 const loaded=readExercises(store);if(!loaded.ok)throw Error();expect(loaded.data.records).toHaveLength(200);expect(loaded.data.seen[id]).toBe(now);
 store.setItem(EXERCISE_KEY,"broken");expect(readExercises(store).ok).toBe(false);expect(saveExercise(record,store)).toBe(false);expect(store.getItem(EXERCISE_KEY)).toBe("broken");
});
it("does not claim a completed assessment when the round is partial or an audio question was never played",()=>{
 const record:ExerciseRecord={id:"a",at:"2026-10-28T00:00:00Z",kind:"melody",mode:"check",count:3,completed:true,simulated:false,pauses:0,trials:[{question:questionBank("melody")[0].id,wrong:0,plays:0,helped:false,unseen:true,finished:true}]};
 expect(saveExercise(record,storage())).toBe(false);
 expect(exposeQuestion("unknown","bad",storage())).toBeNull();
});
it("requires releases between repeated notes, ignores key repeats, and rejects a chord as a melody",()=>{
 const phrase=[60,60,62];let s=sequenceInput(sequenceStart(),phrase,60,true);expect(s.cursor).toBe(1);
 s=sequenceInput(s,phrase,60,true);expect(s.cursor).toBe(1);
 s=sequenceInput(s,phrase,62,true);expect(s.cursor).toBe(1);
 s=sequenceInput(s,phrase,60,false);s=sequenceInput(s,phrase,62,false);
 s=sequenceInput(s,phrase,64,true);expect(s.wrong).toBe(2);expect(s.cursor).toBe(1);
 s=sequenceInput(s,phrase,64,false);s=sequenceInput(s,phrase,60,true);s=sequenceInput(s,phrase,60,false);s=sequenceInput(s,phrase,62,true);expect(s.cursor).toBe(3);
});
