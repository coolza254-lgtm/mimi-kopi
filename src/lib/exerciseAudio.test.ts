import { afterEach, expect, it, vi } from "vitest";
import { ExerciseAudio } from "./exerciseAudio";
afterEach(()=>vi.useRealTimers());
it("cancels a pending native note-on with a matching note-off and never plays the rest after leaving",async()=>{
 vi.useFakeTimers();let finish!:()=>void;const calls:[number,boolean][]=[];
 const player=new ExerciseAudio((p,down)=>{calls.push([p,down]);return down?new Promise<void>((resolve)=>{finish=resolve;}):Promise.resolve();});
 const playing=player.play([60,64,67]);player.dispose();finish();expect(await playing).toBe(false);expect(calls).toEqual([[60,true],[60,false],[60,false]]);
 await vi.runAllTimersAsync();expect(calls.some(([p])=>p!==60)).toBe(false);
});
it("stops a scheduled phrase immediately without leaving timers or hanging promises",async()=>{
 vi.useFakeTimers();const send=vi.fn(async()=>{}),player=new ExerciseAudio(send);const playing=player.play([60,62]);await Promise.resolve();
 player.stop();expect(await playing).toBe(false);expect(vi.getTimerCount()).toBe(0);expect(send).toHaveBeenCalledWith(60,false);
});
