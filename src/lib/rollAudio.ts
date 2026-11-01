/** User-requested piano tones only; no interface sound effects. */
export class RollAudio {
  private context: AudioContext | null = null;
  private voices = new Map<
    number,
    { oscillator: OscillatorNode; gain: GainNode }
  >();
  private native = new Set<number>();
  private generation = 0;
  constructor(
    private send:
      | ((pitch: number, down: boolean) => Promise<unknown>)
      | undefined,
    private fail: () => void,
  ) {}
  async arm() {
    if (!this.send) {
      this.context ??= new AudioContext();
      await this.context.resume();
    }
  }
  note(pitch: number, down: boolean) {
    if (this.send) {
      const generation = this.generation;
      if (down) this.native.add(pitch);
      else this.native.delete(pitch);
      void this.send(pitch, down)
        .then(() => {
          if (down && generation !== this.generation)
            void this.send?.(pitch, false).catch(() => undefined);
        })
        .catch(() => {
          if (generation === this.generation) this.fail();
        });
      return;
    }
    const ctx = this.context;
    if (!ctx) return;
    const old = this.voices.get(pitch);
    if (old) {
      old.oscillator.stop();
      old.oscillator.disconnect();
      old.gain.disconnect();
      this.voices.delete(pitch);
    }
    if (!down) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    oscillator.type = "triangle";
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 0.008);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    this.voices.set(pitch, { oscillator, gain });
  }
  stop() {
    this.generation++;
    this.voices.forEach(({ oscillator, gain }) => {
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    });
    this.voices.clear();
    this.native.forEach((p) => {
      void this.send?.(p, false).catch(() => undefined);
    });
    this.native.clear();
  }
  dispose() {
    this.stop();
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
  }
}
