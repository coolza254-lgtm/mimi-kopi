import { isBlackKey } from "../midi/notes";

export const SONG_LOW = 43;
export const SONG_HIGH = 79;

export type SongHand = "left" | "right";
export type SongHands = SongHand | "both";
export interface FallingNote { pitch: number; beat: number; duration: number; hand: SongHand }
export interface PracticeSong {
  id: string;
  title: { th: string; en: string; ja: string };
  composer: string;
  tempo: number;
  notes: readonly FallingNote[];
  source: string;
}

/** Fresh monophonic practice settings of public-domain melodies; no score or recording is bundled. */
function melody(phrases: readonly (readonly [number, number][])[]): FallingNote[] {
  let beat = 0;
  return phrases.flat().map(([pitch, duration]) => {
    const note: FallingNote = { pitch, beat, duration, hand: "right" };
    beat += duration;
    return note;
  });
}
const twinkleA: [number, number][] = [[60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],[65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2]];
const twinkleB: [number, number][] = [[67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2]];
const joyA: [number, number][] = [[64,1],[64,1],[65,1],[67,1],[67,1],[65,1],[64,1],[62,1],[60,1],[60,1],[62,1],[64,1],[64,1.5],[62,.5],[62,2]];
const joyB: [number, number][] = [[64,1],[64,1],[65,1],[67,1],[67,1],[65,1],[64,1],[62,1],[60,1],[60,1],[62,1],[64,1],[62,1.5],[60,.5],[60,2]];
const melodies: PracticeSong[] = [
  { id: "twinkle", title: { th: "ดาวดวงน้อย", en: "Twinkle, Twinkle, Little Star", ja: "きらきら星" }, composer: "Traditional · Ah! vous dirai-je, maman", tempo: 80,
    notes: melody([twinkleA, twinkleB, twinkleB, twinkleA]), source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236" },
  { id: "frere-jacques", title: { th: "Frère Jacques", en: "Frère Jacques", ja: "フレール・ジャック" }, composer: "Traditional · attributed to J.-P. Rameau", tempo: 88,
    notes: melody([
      [[60,1],[62,1],[64,1],[60,1],[60,1],[62,1],[64,1],[60,1]],
      [[64,1],[65,1],[67,2],[64,1],[65,1],[67,2]],
      [[67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1],[67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1]],
      [[60,1],[55,1],[60,2],[60,1],[55,1],[60,2]],
    ]), source: "https://imslp.org/wiki/Fr%C3%A8re_Jacques_(Rameau,_Jean-Philippe)" },
  { id: "ode-to-joy", title: { th: "Ode to Joy · ท่อนหลัก", en: "Ode to Joy · theme", ja: "歓喜の歌 · 主題" }, composer: "Ludwig van Beethoven · 1824", tempo: 84,
    notes: melody([joyA, joyB, [[62,1],[62,1],[64,1],[60,1],[62,1],[64,.5],[65,.5],[64,1],[60,1],[62,1],[64,.5],[65,.5],[64,1],[62,1],[60,1],[62,1],[55,2]], joyB]),
    source: "https://imslp.org/wiki/Symphony_No.9_(Beethoven,_Ludwig_van)" },
];

/** Sparse root notes are a new optional accompaniment, separate from the historical melody. */
export const practiceSongs: readonly PracticeSong[] = melodies.map((song) => {
  const roots = song.id === "twinkle" ? [48,48,53,48,43,48,43,48,43,48,43,48]
    : song.id === "frere-jacques" ? [48,48,48,48,48,48,43,48]
      : [48,43,48,43,48,43,48,48,43,48,43,43,48,43,48,48];
  const end = Math.max(...song.notes.map((n) => n.beat + n.duration));
  const bass: FallingNote[] = Array.from({ length: Math.ceil(end / 4) }, (_, i) => ({ pitch: roots[i % roots.length], beat: i * 4, duration: Math.min(4, end - i * 4), hand: "left" }));
  return { ...song, notes: [...song.notes, ...bass].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch) };
});

export const songEnd = (song: PracticeSong): number => Math.max(0, ...song.notes.map((n) => n.beat + n.duration));
export const notesForHands = (song: PracticeSong, hands: SongHands): readonly FallingNote[] => song.notes.filter((n) => hands === "both" || n.hand === hands);
export const activeSongPitches = (song: PracticeSong, beat: number, hands: SongHands = "both"): number[] => [...new Set(notesForHands(song, hands).filter((n) => beat >= n.beat && beat < n.beat + n.duration * .9).map((n) => n.pitch))];
export const songSeconds = (song: PracticeSong, speed: number): number => songEnd(song) * 60 / song.tempo / speed;

/** Uses the same white-key geometry as PianoKeyboard, including the black-key offset. */
export function fallingKey(pitch: number, low = SONG_LOW, high = SONG_HIGH): { left: number; width: number } {
  const pitches = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const whites = pitches.filter((p) => !isBlackKey(p));
  const width = 100 / whites.length;
  const before = whites.filter((p) => p < pitch).length;
  return isBlackKey(pitch) ? { left: before * width - width * .31, width: width * .62 } : { left: before * width, width };
}
