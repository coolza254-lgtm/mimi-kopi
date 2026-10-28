/** Original oscillator tones in the browser; the configured instrument in the app. */
export class ExerciseAudio {
  private context: AudioContext | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wake: (() => void) | null = null;
  private sounding = new Set<number>();
  private oscillators = new Set<OscillatorNode>();
  constructor(private send?: (pitch: number, down: boolean) => Promise<unknown>) {}
  stop() {
    this.generation++;
    if(this.timer)clearTimeout(this.timer);this.timer=null;
    this.wake?.();this.wake=null;
    this.oscillators.forEach((o)=>{try{o.stop();}catch{/* Already stopped. */}});this.oscillators.clear();
    this.sounding.forEach((p)=>{void this.send?.(p,false).catch(()=>undefined);});this.sounding.clear();
  }
  private delay(ms: number) { return new Promise<void>((resolve)=>{this.wake=resolve;this.timer=setTimeout(()=>{this.timer=null;this.wake=null;resolve();},ms);}); }
  async play(pitches: number[], beatMs = 600): Promise<boolean> {
    this.stop();const token=this.generation;
    if(!this.send){this.context??=new AudioContext();await this.context.resume();if(token!==this.generation)return false;}
    try{
      for(const pitch of pitches){
        if(token!==this.generation)return false;
        if(this.send){
          this.sounding.add(pitch);await this.send(pitch,true);
          if(token!==this.generation){await this.send(pitch,false);return false;}
        }else{
          const ctx=this.context!,o=ctx.createOscillator(),g=ctx.createGain();
          o.frequency.value=440*2**((pitch-69)/12);o.type="sine";
          g.gain.setValueAtTime(0,ctx.currentTime);g.gain.linearRampToValueAtTime(.12,ctx.currentTime+.02);g.gain.setValueAtTime(.12,ctx.currentTime+beatMs/1000*.65);g.gain.linearRampToValueAtTime(0,ctx.currentTime+beatMs/1000*.8);
          o.connect(g);g.connect(ctx.destination);this.oscillators.add(o);o.onended=()=>{this.oscillators.delete(o);o.disconnect();g.disconnect();};o.start();o.stop(ctx.currentTime+beatMs/1000*.82);
        }
        await this.delay(beatMs*.85);
        if(token!==this.generation)return false;
        if(this.send){await this.send(pitch,false);this.sounding.delete(pitch);}
        if(token!==this.generation)return false;
        await this.delay(beatMs*.15);
      }
      return token===this.generation;
    }catch(e){this.stop();throw e;}
  }
  dispose(){this.stop();if(this.context){void this.context.close().catch(()=>undefined);this.context=null;}}
}
