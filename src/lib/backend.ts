import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// These mirror the Serialize structs in src-tauri/src (lib.rs, audio.rs, midi_io.rs).

export type CapabilityStatus = "supported" | "not_supported" | "not_yet_tested";

export interface CapabilityReport {
  noteOnOff: CapabilityStatus;
  velocity: CapabilityStatus;
  sustainCc64: CapabilityStatus;
  polyphony: CapabilityStatus;
}

export interface AppInfo {
  version: string;
  phase: number;
  hardwareVerified: boolean;
}

export interface MidiStatus {
  connected: string | null;
  wanted: string | null;
  capabilities: CapabilityReport;
  error: string | null;
}

export interface AudioStatus {
  device: string | null;
  sampleRate: number | null;
  channels: number | null;
  instrument: "basic" | "soundfont" | "sampler";
  soundFont: string | null;
  error: string | null;
}

export type MidiEventKind = "noteOn" | "noteOff" | "controlChange" | "other";

export interface MidiEvent {
  timestampUs: number;
  device: string;
  simulated: boolean;
  kind: MidiEventKind;
  channel: number | null;
  pitch: number | null;
  velocity: number | null;
  control: number | null;
  value: number | null;
  raw: number[];
}

export type GainChannel = "master" | "piano" | "metronome" | "backing";

/** False when the UI runs in a plain browser (`npm run dev`). */
export const inDesktopApp = (): boolean => isTauri();

export const backend = {
  appInfo: () => invoke<AppInfo>("app_info"),
  midiListInputs: () => invoke<string[]>("midi_list_inputs"),
  midiConnect: (name: string) => invoke<MidiStatus>("midi_connect", { name }),
  midiDisconnect: () => invoke<MidiStatus>("midi_disconnect"),
  midiStatus: () => invoke<MidiStatus>("midi_status"),
  midiSimulate: (bytes: number[]) => invoke<void>("midi_simulate", { bytes }),
  audioListOutputs: () => invoke<string[]>("audio_list_outputs"),
  audioOpen: (device: string | null) => invoke<AudioStatus>("audio_open", { device }),
  audioStatus: () => invoke<AudioStatus>("audio_status"),
  audioSetGain: (channel: GainChannel, value: number) => invoke<void>("audio_set_gain", { channel, value }),
  audioLoadSoundFont: (path: string) => invoke<AudioStatus>("audio_load_soundfont", { path }),
  audioTestSound: () => invoke<void>("audio_test_sound"),
  onMidiEvent: (cb: (e: MidiEvent) => void): Promise<UnlistenFn> => listen<MidiEvent>("midi-event", (e) => cb(e.payload)),
  onMidiReset: (cb: () => void): Promise<UnlistenFn> => listen("midi-reset", () => cb()),
  onMidiStatus: (cb: (s: MidiStatus) => void): Promise<UnlistenFn> => listen<MidiStatus>("midi-status", (e) => cb(e.payload)),
};
