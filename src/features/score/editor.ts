import type { MidiEvent } from "../../lib/backend";
import { unitsPerMeasure, type Song } from "./score";

export function clampMeasureRange(measures: number, range: { from: number; to: number }) {
  const last = Math.max(0, measures - 1);
  const from = Math.max(0, Math.min(last, range.from));
  return { from, to: Math.max(from, Math.min(last, range.to)) };
}

export interface MidiEntry {
  song: Song;
  cursor: number | null;
  last: { time: number; start: number } | null;
}

/** One physical note event; a chord window is anchored at its first note. */
export function enterMidiNote(
  state: MidiEntry,
  event: Pick<MidiEvent, "kind" | "pitch" | "velocity" | "simulated">,
  dur: number,
  id: string,
  time: number,
  now: Date,
): MidiEntry | null {
  const { pitch } = event;
  if (event.simulated || event.kind !== "noteOn" || event.velocity === 0 ||
    pitch === null || !Number.isInteger(pitch) || pitch < 21 || pitch > 108) return null;
  const { song, cursor, last } = state;
  const units = unitsPerMeasure(song);
  const end = song.notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  const together = last !== null && time >= last.time && time - last.time < 90;
  let start = together ? last.start : Math.max(0, cursor ?? end);
  // Sequential entry must never snap backwards onto the preceding note.
  if (!together && dur <= units && start % units + dur > units) start = Math.ceil(start / units) * units;
  const measures = Math.max(song.measures, Math.ceil((start + dur) / units));
  if (measures > 400 || song.notes.length >= 20_000) return null;
  return {
    song: {
      ...song, measures, updatedAt: now.toISOString(),
      notes: [...song.notes, { id, pitch, start, dur, hand: pitch >= 60 ? "R" : "L" }],
    },
    cursor: start + dur,
    last: together ? last : { time, start },
  };
}

export interface PlaybackEvent { at: number; pitch: number; on: boolean }

/** Relative score times, including notes held across the selected boundary.
 * Overlapping voices of one pitch do not release one another early. */
export function playbackEvents(song: Song, hands: "R" | "L" | "both", from: number, to: number): PlaybackEvent[] {
  const raw: PlaybackEvent[] = [];
  for (const n of song.notes) {
    if ((hands !== "both" && n.hand !== hands) || n.start >= to || n.start + n.dur <= from) continue;
    raw.push({ at: Math.max(from, n.start) - from, pitch: n.pitch, on: true });
    raw.push({ at: Math.min(to, n.start + n.dur) - from, pitch: n.pitch, on: false });
  }
  raw.sort((a, b) => a.at - b.at || Number(a.on) - Number(b.on) || a.pitch - b.pitch);
  const active = new Map<number, number>();
  return raw.filter((event) => {
    const count = active.get(event.pitch) ?? 0;
    active.set(event.pitch, count + (event.on ? 1 : -1));
    return event.on || count === 1;
  });
}
