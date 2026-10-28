import { expect,it } from "vitest";
import { delayedTrials, independentTrial, nextPathStep } from "./learningPath";
import { questionBank, type ExerciseRecord } from "./exercises";
const q=questionBank("melody")[0].id;
function record(id:string,at:string,patch:Partial<ExerciseRecord>={}):ExerciseRecord{return {id,at,kind:"melody",mode:"check",count:3,completed:true,simulated:false,pauses:0,trials:Array.from({length:3},()=>({question:q,wrong:0,plays:1,helped:false,unseen:false,finished:true})),...patch};}
it("keeps simulated completion while suggesting an uncompleted next step, without making it piano mastery",()=>{
 expect(nextPathStep({},[],[]).id).toBe("keyboard");
 expect(nextPathStep({keyboard:{simulatedAt:"2026-10-28T10:00:00Z"}},[],[]).id).toBe("direction");
});
it("only reports observed same-form delayed review within the same source and assessment mode",()=>{
 const before=record("a","2026-10-25T10:00:00Z"),current=record("b","2026-10-28T10:00:00Z");
 expect(delayedTrials([before],current)[0]).toMatchObject({days:3,firstTry:true});
 expect(delayedTrials([{...before,simulated:true}],current)).toEqual([]);
 expect(delayedTrials([{...before,mode:"learn"}],current)).toEqual([]);
 expect(delayedTrials([record("c","2026-10-28T09:00:00Z")],current)).toEqual([]);
 expect(independentTrial({...current.trials[0],plays:2},"melody")).toBe(false);
 expect(independentTrial({...current.trials[0],helped:true},"melody")).toBe(false);
});
