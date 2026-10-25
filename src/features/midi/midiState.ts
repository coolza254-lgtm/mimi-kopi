import type { MidiEvent } from "../../lib/backend";

/** How many events the monitor keeps; older ones are dropped. */
export const LOG_LIMIT = 100;

export interface MidiView {
  /** Pitches currently held, ascending. */
  held: number[];
  sustain: boolean;
  /** Newest first. */
  log: MidiEvent[];
}

export const initialMidiView: MidiView = { held: [], sustain: false, log: [] };

export type MidiAction = { type: "event"; event: MidiEvent } | { type: "reset" } | { type: "clearLog" };

export function midiReducer(state: MidiView, action: MidiAction): MidiView {
  switch (action.type) {
    case "event": {
      const e = action.event;
      let { held, sustain } = state;
      if (e.kind === "noteOn" && e.pitch !== null && !held.includes(e.pitch)) {
        held = [...held, e.pitch].sort((a, b) => a - b);
      } else if (e.kind === "noteOff" && e.pitch !== null) {
        held = held.filter((p) => p !== e.pitch);
      } else if (e.kind === "controlChange" && e.control === 64 && e.value !== null) {
        sustain = e.value >= 64;
      }
      return { held, sustain, log: [e, ...state.log].slice(0, LOG_LIMIT) };
    }
    case "reset":
      return { ...state, held: [], sustain: false };
    case "clearLog":
      return { ...state, log: [] };
  }
}

/** An on-screen key press as the backend would report it, for browser-only use. */
export function simulatedEvent(pitch: number, down: boolean, velocity = 90): MidiEvent {
  return {
    timestampUs: Math.round(performance.now() * 1000),
    device: "simulator",
    simulated: true,
    kind: down ? "noteOn" : "noteOff",
    channel: 0,
    pitch,
    velocity: down ? velocity : 0,
    control: null,
    value: null,
    raw: down ? [0x90, pitch, velocity] : [0x80, pitch, 0],
  };
}
