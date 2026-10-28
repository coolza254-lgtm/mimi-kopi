export type ExerciseKind = "direction" | "melody" | "phrase" | "rhythm";
export interface ExerciseQuestion { id: string; pitches: number[]; answer: string; beats?: number }
export interface ExerciseTrial { question: string; wrong: number; plays: number; helped: boolean; unseen: boolean | null; finished: boolean }
export interface ExerciseRecord { id: string; at: string; kind: ExerciseKind; mode: "learn" | "check"; count: number; completed: boolean; simulated: boolean; pauses: number; trials: ExerciseTrial[] }
export interface ExerciseData { version: 1; records: ExerciseRecord[]; seen: Record<string, string> }
export const EXERCISE_KEY = "mimi-kopi.exercises.v1";
const kinds: ExerciseKind[] = ["direction", "melody", "phrase", "rhythm"];
const pitches = [60,62,64,65,67];
export function questionBank(kind: ExerciseKind): ExerciseQuestion[] {
  if (kind === "rhythm") return [1,2,4].map((beats) => ({ id:`rhythm-v1:${beats}`, pitches:[60], answer:String(beats), beats }));
  if (kind === "direction") return pitches.flatMap((a) => pitches.map((b) => ({id:`direction-v1:${a}-${b}`,pitches:[a,b],answer:b === a ? "same" : b > a ? "up" : "down"})));
  return pitches.flatMap((a) => pitches.flatMap((b) => pitches.filter((c) => a !== b || b !== c).map((c) => ({id:`${kind}-v1:${a}-${b}-${c}`,pitches:[a,b,c],answer:[a,b,c].join(",")}))));
}
/** New forms share a blueprint, not an assumed psychometric difficulty. */
export function exercisePlan(kind: ExerciseKind, count: number, seed: number, seen: Record<string, string>, mode:"learn"|"check"="check"): ExerciseQuestion[] {
  const bank = questionBank(kind).filter((q)=>mode==="check"||kind==="rhythm"||q.pitches.every((p,i)=>i===0||Math.abs(pitches.indexOf(p)-pitches.indexOf(q.pitches[i-1]))<=1));
  let random = seed >>> 0 || 1;
  const next = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 4294967296; };
  const shuffle = (list: ExerciseQuestion[]) => { const copy=[...list]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; };
  const ordered = [...shuffle(bank.filter((q) => !seen[q.id])), ...shuffle(bank.filter((q) => seen[q.id]))];
  const result: ExerciseQuestion[] = [];
  const size = Math.min(24, Math.max(3, Math.trunc(count) || 6));
  while(result.length < size){const bag=shuffle(ordered); if(result.length===0) bag.sort((a,b)=>Number(!!seen[a.id])-Number(!!seen[b.id])); if(bag[0].id===result.at(-1)?.id)[bag[0],bag[1]]=[bag[1],bag[0]];result.push(...bag.slice(0,size-result.length));}
  return result;
}
const validDate = (x: unknown): x is string => typeof x === "string" && Number.isFinite(Date.parse(x));
export function validExerciseRecord(value: unknown): value is ExerciseRecord {
  if (!value || typeof value !== "object") return false;
  const r=value as ExerciseRecord;
  if(typeof r.id!=="string" || r.id.length>100 || !validDate(r.at) || !kinds.includes(r.kind) || !["learn","check"].includes(r.mode) || !Number.isInteger(r.count) || r.count<3 || r.count>24 || typeof r.completed!=="boolean" || typeof r.simulated!=="boolean" || !Number.isSafeInteger(r.pauses) || r.pauses<0 || !Array.isArray(r.trials) || r.trials.length<1 || r.trials.length>r.count || (r.completed && (r.trials.length!==r.count || r.trials.some((t)=>!t.finished))))return false;
  const bank=new Set(questionBank(r.kind).map((q)=>q.id));
  return r.trials.every((t)=>t && bank.has(t.question) && Number.isSafeInteger(t.wrong) && t.wrong>=0 && Number.isSafeInteger(t.plays) && t.plays>=0 && typeof t.finished==="boolean" && typeof t.helped==="boolean" && [true,false,null].includes(t.unseen) && (!(r.kind==="direction" || r.kind==="melody") || t.plays>0));
}
export function readExercises(storage?: Pick<Storage,"getItem">): {ok:true;data:ExerciseData}|{ok:false} {
  try {
    const raw=(storage??globalThis.localStorage).getItem(EXERCISE_KEY);
    if(raw===null)return {ok:true,data:{version:1,records:[],seen:{}}};
    if(raw.length>3000000)throw Error("Oversized history");
    const data=JSON.parse(raw) as ExerciseData;
    if(!data || data.version!==1 || !Array.isArray(data.records) || data.records.length>200 || !data.records.every(validExerciseRecord) || !data.seen || typeof data.seen!=="object" || Array.isArray(data.seen))throw Error("Invalid history");
    const bank=new Set(kinds.flatMap((kind)=>questionBank(kind).map((q)=>q.id)));
    if(Object.entries(data.seen).some(([key,date])=>!bank.has(key)||!validDate(date)))throw Error("Invalid exposure");
    return {ok:true,data};
  }catch{return {ok:false};}
}
export function exposeQuestion(id: string, now: string, storage?: Pick<Storage,"getItem"|"setItem">): boolean | null {
  try{
    const target=storage??globalThis.localStorage;
    const result=readExercises(target);
    if(!result.ok || !validDate(now) || !kinds.some((kind)=>questionBank(kind).some((q)=>q.id===id)))return null;
    const unseen=!result.data.seen[id];
    result.data.seen[id]=now;
    target.setItem(EXERCISE_KEY,JSON.stringify(result.data));
    return unseen;
  }catch{return null;}
}
export function saveExercise(record: ExerciseRecord, storage?: Pick<Storage,"getItem"|"setItem">): boolean {
  try{
    const target=storage??globalThis.localStorage;
    const loaded=readExercises(target);if(!loaded.ok || !validExerciseRecord(record))return false;
    loaded.data.records=[...loaded.data.records.filter((r)=>r.id!==record.id),record].slice(-200);
    target.setItem(EXERCISE_KEY,JSON.stringify(loaded.data));return true;
  }catch{return false;}
}
export interface SequenceInput { cursor:number; wrong:number; held:number[]; release:boolean }
export const sequenceStart = (): SequenceInput => ({cursor:0,wrong:0,held:[],release:false});
/** One new key after a full release, so holding notes never answers a repeated note. */
export function sequenceInput(state: SequenceInput, expected: number[], pitch: number, down: boolean): SequenceInput {
  const held=down?[...new Set([...state.held,pitch])]:state.held.filter((p)=>p!==pitch);
  if(state.cursor>=expected.length)return {...state,held,wrong:state.wrong+(down&&!state.held.includes(pitch)?1:0)};
  if(!down)return {...state,held,release:held.length>0};
  if(state.held.includes(pitch))return state;
  if(state.release || state.held.length>0)return {...state,held,release:true,wrong:state.wrong+1};
  if(pitch!==expected[state.cursor])return {...state,held,release:true,wrong:state.wrong+1};
  return {...state,held,release:true,cursor:state.cursor+1};
}
