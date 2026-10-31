import { parseSongFile, MAX_SONG_FILE_BYTES } from "./songFile";
import type { ScoreNote, Song } from "./score";

/** Standard MIDI format 0/1, PPQN, fixed tempo/meter. Never silently quantize notes. */
export function parseMidiFile(bytes: Uint8Array, title: string, id: string, now: Date): Song {
  const fail = (): never => { throw new Error("Unsupported or damaged MIDI file"); };
  if (bytes.length > MAX_SONG_FILE_BYTES) fail();
  let p = 0;
  const read = (n: number, end = bytes.length): number => {
    if (p + n > end) return fail();
    let v = 0; for (let i = 0; i < n; i++) v = v * 256 + bytes[p++]; return v;
  };
  const tag = () => String.fromCharCode(read(1), read(1), read(1), read(1));
  if (tag() !== "MThd" || read(4) !== 6) fail();
  const format = read(2), tracks = read(2), division = read(2);
  if (format > 1 || !tracks || tracks > 256 || (format === 0 && tracks !== 1) || !division || division >= 32768) fail();
  let tempo: number | undefined, beats: number | undefined;
  const notes: ScoreNote[] = [];
  for (let track = 0; track < tracks; track++) {
    if (tag() !== "MTrk") fail();
    const length = read(4), end = p + length;
    if (end > bytes.length) fail();
    let tick = 0, running = 0, name = "", ended = false;
    const pending = new Map<number, number[]>();
    const completed: { pitch: number; start: number; stop: number }[] = [];
    const variable = () => {
      let v = 0;
      for (let i = 0; i < 4; i++) { const b = read(1, end); v = v * 128 + (b & 127); if (b < 128) return v; }
      return fail();
    };
    while (p < end) {
      tick += variable();
      if (tick / division > 2400 || ended) fail();
      let status = bytes[p];
      if (status >= 128) { p++; if (status < 240) running = status; else running = 0; }
      else { status = running; if (!status) fail(); }
      if (status === 255) {
        const type = read(1, end), size = variable(), next = p + size;
        if (next > end) fail();
        if (type === 3) name = new TextDecoder().decode(bytes.slice(p, next)).toLowerCase();
        if (type === 81) {
          if (size !== 3 || (tick !== 0 && tempo === undefined)) fail(); const value = read(3, end);
          if (!value || (tempo !== undefined && tempo !== value)) fail(); tempo = value;
        }
        if (type === 88) {
          if (size !== 4 || (tick !== 0 && beats === undefined)) fail(); const value = read(1, end), denominator = read(1, end);
          if (denominator !== 2 || value < 2 || value > 6 || (beats !== undefined && beats !== value)) fail(); beats = value;
        }
        if (type === 47) { if (size !== 0) fail(); ended = true; }
        p = next; continue;
      }
      if (status === 240 || status === 247) { const size = variable(); if (p + size > end) fail(); p += size; continue; }
      if (status < 128 || status >= 240) fail();
      const kind = status & 240, channel = status & 15, a = read(1, end);
      const b = kind === 192 || kind === 208 ? 0 : read(1, end);
      if (a > 127 || b > 127) fail();
      // Pedal changes cannot be represented by the score editor yet.
      if (kind === 176 && a === 64 && b >= 64) fail();
      if (kind === 224 && (a !== 0 || b !== 64)) fail();
      if (kind !== 128 && kind !== 144) continue;
      if (channel === 9) fail();
      const key = channel * 128 + a, queue = pending.get(key) ?? [];
      if (kind === 144 && b > 0) { queue.push(tick); pending.set(key, queue); }
      else {
        const start = queue.shift(); if (start === undefined) fail();
        completed.push({ pitch: a, start: start!, stop: tick });
        if (completed.length + notes.length > 20_000) fail();
      }
    }
    if (!ended || [...pending.values()].some((q) => q.length)) fail();
    const hand = /left|左|ซ้าย/.test(name) ? "L" : /right|右|ขวา/.test(name) ? "R" : null;
    for (const n of completed) notes.push({ id: `${id}-${notes.length}`, pitch: n.pitch, start: n.start * 4 / division, dur: (n.stop - n.start) * 4 / division, hand: hand ?? (n.pitch < 60 ? "L" : "R") });
  }
  if (p !== bytes.length || notes.length === 0) fail();
  const bpm = Math.round(60_000_000 / (tempo ?? 500_000));
  if (bpm < 30 || bpm > 240) fail();
  const meter = beats ?? 4;
  const measures = Math.max(1, Math.ceil(Math.max(...notes.map((n) => n.start + n.dur)) / (meter * 4)));
  // Reuse the storage contract so an imported song always survives reopening/export.
  return parseSongFile(JSON.stringify({ format: "mimi-kopi-song", version: 1, song: { title: title.replace(/\.(mid|midi)$/i, "").slice(0, 200), fifths: 0, beats: meter, tempo: bpm, measures, notes } }), id, now);
}
