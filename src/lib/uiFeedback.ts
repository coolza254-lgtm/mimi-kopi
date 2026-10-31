export type FeedbackCue = "tap" | "correct" | "wrong";

/** Short original noise envelopes: no musical pitches, files or MIDI events. */
export class UiFeedback {
  private context: AudioContext | null = null;
  private enabled = true;
  private generation = 0;
  private sources = new Set<AudioBufferSourceNode>();

  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.stop(); }
  unlock() {
    if (!this.enabled || typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
    } catch { /* Visual feedback remains available without an audio device. */ }
  }
  play(cue: FeedbackCue) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    this.stop();
    const token = this.generation;
    try {
      const duration = cue === "correct" ? .18 : cue === "wrong" ? .12 : .035;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let random = 17, smooth = 0;
      for (let i = 0; i < data.length; i++) {
        random = (random * 1664525 + 1013904223) >>> 0;
        const noise = random / 2147483648 - 1;
        smooth = .85 * smooth + .15 * noise;
        const time = i / ctx.sampleRate;
        const pulse = cue === "correct" && time >= .085 ? time - .085 : time;
        const envelope = Math.min(pulse / .003, 1) * Math.exp(-pulse * (cue === "tap" ? 150 : 60));
        data[i] = (cue === "wrong" ? smooth : noise * .4 + smooth * .6) * envelope * .12;
      }
      if (token !== this.generation) return;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
      source.onended = () => { source.disconnect(); this.sources.delete(source); };
      this.sources.add(source); source.start();
    } catch { /* An unavailable effect must never interrupt learning. */ }
  }
  stop() {
    this.generation++;
    this.sources.forEach((source) => { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } });
    this.sources.clear();
  }
  dispose() {
    this.stop();
    const ctx = this.context; this.context = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
export const uiFeedback = new UiFeedback();
