import { describe, expect, it } from "vitest";
import type { MidiEvent } from "../../lib/backend";
import { initialMidiView, LOG_LIMIT, midiReducer, simulatedEvent, type MidiView } from "./midiState";

const apply = (state: MidiView, ...events: MidiEvent[]) =>
  events.reduce((s, event) => midiReducer(s, { type: "event", event }), state);

const pedal = (value: number): MidiEvent => ({
  ...simulatedEvent(0, true),
  kind: "controlChange",
  pitch: null,
  velocity: null,
  control: 64,
  value,
  raw: [0xb0, 64, value],
});

describe("midiReducer", () => {
  it("tracks a chord and its release in pitch order", () => {
    let s = apply(initialMidiView, simulatedEvent(67, true), simulatedEvent(60, true), simulatedEvent(64, true));
    expect(s.held).toEqual([60, 64, 67]);
    s = apply(s, simulatedEvent(64, false));
    expect(s.held).toEqual([60, 67]);
  });

  it("does not duplicate a repeated note on", () => {
    const s = apply(initialMidiView, simulatedEvent(60, true), simulatedEvent(60, true));
    expect(s.held).toEqual([60]);
  });

  it("follows the sustain pedal threshold", () => {
    expect(apply(initialMidiView, pedal(127)).sustain).toBe(true);
    expect(apply(initialMidiView, pedal(127), pedal(10)).sustain).toBe(false);
  });

  it("reset releases keys and pedal but keeps the log", () => {
    const s = midiReducer(apply(initialMidiView, simulatedEvent(60, true), pedal(127)), { type: "reset" });
    expect(s.held).toEqual([]);
    expect(s.sustain).toBe(false);
    expect(s.log).toHaveLength(2);
  });

  it("keeps the newest events up to the limit", () => {
    let s = initialMidiView;
    for (let i = 0; i < LOG_LIMIT + 5; i++) s = apply(s, simulatedEvent(60 + (i % 12), i % 2 === 0));
    expect(s.log).toHaveLength(LOG_LIMIT);
    expect(midiReducer(s, { type: "clearLog" }).log).toEqual([]);
  });

  it("builds simulated events with MIDI bytes", () => {
    expect(simulatedEvent(60, true, 100).raw).toEqual([0x90, 60, 100]);
    expect(simulatedEvent(60, false).raw).toEqual([0x80, 60, 0]);
  });
});
