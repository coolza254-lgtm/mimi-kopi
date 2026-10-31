import { afterEach, expect, it, vi } from "vitest";
import { UiFeedback } from "./uiFeedback";

afterEach(() => vi.unstubAllGlobals());
function audioDevice() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; buffer: { getChannelData: () => Float32Array } | null; onended?: () => void }[] = [];
  const close = vi.fn(async () => {}), resume = vi.fn(async () => {});
  const create = vi.fn(function () {
    return { state: "running", sampleRate: 48000, destination: {}, close, resume,
      createBuffer: (_channels: number, length: number) => { const data = new Float32Array(length); return { getChannelData: () => data }; },
      createBufferSource: () => { const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null }; sources.push(source); return source; },
    };
  });
  vi.stubGlobal("AudioContext", create);
  return { sources, close, create };
}
it("never starts a device before a gesture and respects mute without affecting other audio", () => {
  const device = audioDevice(), feedback = new UiFeedback();
  feedback.play("correct"); expect(device.create).not.toHaveBeenCalled();
  feedback.unlock(); feedback.play("tap");
  expect(device.sources[0].start).toHaveBeenCalledOnce();
  feedback.setEnabled(false);
  expect(device.sources[0].stop).toHaveBeenCalledOnce();
  feedback.play("correct"); feedback.unlock();
  expect(device.sources).toHaveLength(1);
  feedback.setEnabled(true); feedback.play("wrong");
  expect(device.create).toHaveBeenCalledOnce();
  feedback.dispose(); expect(device.close).toHaveBeenCalledOnce();
});
it("replaces rapid effects and produces short bounded original samples", () => {
  const device = audioDevice(), feedback = new UiFeedback(); feedback.unlock();
  for (const cue of ["tap", "correct", "wrong"] as const) feedback.play(cue);
  expect(device.sources[0].stop).toHaveBeenCalledOnce();
  expect(device.sources[1].stop).toHaveBeenCalledOnce();
  for (const source of device.sources) {
    const data = source.buffer!.getChannelData();
    expect(data.length).toBeLessThanOrEqual(48000 * .2);
    expect(data.some((value) => value !== 0)).toBe(true);
    expect(data.every((value) => Number.isFinite(value) && Math.abs(value) <= .12)).toBe(true);
  }
  feedback.dispose(); expect(device.sources[2].stop).toHaveBeenCalledOnce();
});
it("keeps the interface working when web audio is missing or denied", () => {
  vi.stubGlobal("AudioContext", undefined);
  const feedback = new UiFeedback();
  expect(() => { feedback.unlock(); feedback.play("wrong"); feedback.dispose(); }).not.toThrow();
  vi.stubGlobal("AudioContext", vi.fn(function () { throw Error("Device denied"); }));
  expect(() => { feedback.unlock(); feedback.play("correct"); feedback.dispose(); }).not.toThrow();
});
